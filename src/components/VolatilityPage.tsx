import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { VolatilityChart } from './VolatilityChart';
import { Toast, useToast } from './Toast';
import { WatchlistPanel } from './WatchlistPanel';
import { AddWatchlistModal } from './AddWatchlistModal';
import { GroupManagerModal } from './GroupManagerModal';
import { CacheManagerModal } from './CacheManagerModal';
import { useStockData } from '../hooks/useStockData';
import { useSearch } from '../hooks/useSearch';
import { calculateVolatility, getTimeFrameLabel, calculateGrid } from '../utils/stockData';
import { saveVolatilityCache, getVolatilityCache, clearVolatilityCache } from '../utils/analysisCache';
import type { TimeFrame, WatchlistItem, WatchlistGroup, VolatilityIndicator, GridConfig } from '../types/stock';

const CHART_HEIGHT = 500;

interface VolatilityPageProps {
  initialStockCode?: string;
  initialStockName?: string;
}

export const VolatilityPage: React.FC<VolatilityPageProps> = ({ initialStockCode, initialStockName }) => {
  const { showToast, toasts, dismissToast } = useToast();
  const { data, displayData, stockCode, setStockCode, stockName, setStockName, isLoading, loadStockData: loadStockDataRaw } = useStockData(showToast);
  const { searchInput, searchResults, showSearchResults, showPopularIndices, handleSearchFocus, handleSearchInputChange, handleSelectStock: handleSelectStockRaw, handleKeyDown, closeSearchDropdown, popularIndices } = useSearch();
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('1d');
  const [dataRange, setDataRange] = useState<string>('6m');
  const [volatilityWindow, setVolatilityWindow] = useState(20);
  const [selectedIndicator, setSelectedIndicator] = useState<VolatilityIndicator>('volatility');
  const [showBollingerBands, setShowBollingerBands] = useState(false);
  const [bbMultiplier, setBbMultiplier] = useState(2);
  const [showGridTrading, setShowGridTrading] = useState(false);
  const [gridConfig, setGridConfig] = useState<GridConfig>({
    atrMultiplier: 1,
    gridCount: 5,
    gridType: 'atr',
    volatilityMultiplier: 1
  });
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>(() => {
    try {
      const saved = localStorage.getItem('watchlist');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [showAddWatchlistModal, setShowAddWatchlistModal] = useState(false);
  const [watchlistGroups, setWatchlistGroups] = useState<WatchlistGroup[]>(() => {
    try {
      const saved = localStorage.getItem('watchlistGroups');
      return saved ? JSON.parse(saved) : [
        { id: 'default', name: '默认', color: '#3b82f6' }
      ];
    } catch {
      return [{ id: 'default', name: '默认', color: '#3b82f6' }];
    }
  });
  const [activeGroup, setActiveGroup] = useState<string>(() => {
    try {
      return localStorage.getItem('activeWatchlistGroup') || 'default';
    } catch {
      return 'default';
    }
  });
  const [showGroupManager, setShowGroupManager] = useState(false);
  const [showCacheManager, setShowCacheManager] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth);
      }
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  const loadStockData = useCallback((code: string, tf: TimeFrame, range?: string) => {
    loadStockDataRaw(code, tf, range ?? dataRange);
  }, [loadStockDataRaw, dataRange]);

  useEffect(() => {
    if (initialStockCode && initialStockName) {
      setStockCode(initialStockCode);
      setStockName(initialStockName);
      loadStockData(initialStockCode, timeFrame);
    }
  }, [initialStockCode, initialStockName]);

  useEffect(() => {
    if (!initialStockCode) {
      loadStockData(stockCode, timeFrame);
    }
  }, [timeFrame]);

  const volatilityData = useMemo(() => {
    const result = calculateVolatility(displayData, volatilityWindow, bbMultiplier);
    
    if (result.length > 0 && stockCode !== 'DEMO') {
      const latest = result[result.length - 1];
      if (latest.upVolatility > 0 && latest.downVolatility > 0) {
        saveVolatilityCache(
          stockCode,
          timeFrame,
          dataRange,
          volatilityWindow,
          bbMultiplier,
          { upVolatility: latest.upVolatility, downVolatility: latest.downVolatility, volSkew: latest.volSkew },
          latest.volatility,
          latest.atr
        );
      }
    }
    
    return result;
  }, [displayData, volatilityWindow, bbMultiplier, stockCode, timeFrame, dataRange]);

  const handleTimeFrameChange = (newTimeFrame: TimeFrame) => {
    setTimeFrame(newTimeFrame);
    loadStockData(stockCode, newTimeFrame, dataRange);
  };

  const onSelectStock = (code: string, name: string) => {
    setStockCode(code);
    setStockName(name);
    loadStockData(code, timeFrame, dataRange);
  };

  const handleSelectStock = (code: string, name: string) => {
    onSelectStock(code, name);
  };

  const handleAddToWatchlist = (code: string, name: string, groupName?: string) => {
    const targetGroup = groupName || activeGroup;
    if (!watchlist.find(item => item.code === code && item.group === targetGroup)) {
      const newItem: WatchlistItem = { code, name, addedAt: Date.now(), group: targetGroup };
      setWatchlist((prev: WatchlistItem[]) => {
        const updated = [...prev, newItem];
        localStorage.setItem('watchlist', JSON.stringify(updated));
        return updated;
      });
      setShowAddWatchlistModal(false);
    }
  };

  const handleRemoveFromWatchlist = (code: string) => {
    setWatchlist((prev: WatchlistItem[]) => {
      const updated = prev.filter(item => !(item.code === code && item.group === activeGroup));
      localStorage.setItem('watchlist', JSON.stringify(updated));
      return updated;
    });
  };

  const handleAddGroup = (name: string, color: string) => {
    const newGroup: WatchlistGroup = {
      id: `group_${Date.now()}`,
      name,
      color
    };
    setWatchlistGroups(prev => {
      const updated = [...prev, newGroup];
      localStorage.setItem('watchlistGroups', JSON.stringify(updated));
      return updated;
    });
  };

  const handleRemoveGroup = (groupId: string) => {
    if (groupId === 'default') return;
    setWatchlistGroups(prev => {
      const updated = prev.filter(g => g.id !== groupId);
      localStorage.setItem('watchlistGroups', JSON.stringify(updated));
      return updated;
    });
    setWatchlist(prev => {
      const updated = prev.filter(item => item.group !== groupId);
      localStorage.setItem('watchlist', JSON.stringify(updated));
      return updated;
    });
    if (activeGroup === groupId) {
      setActiveGroup('default');
      localStorage.setItem('activeWatchlistGroup', 'default');
    }
  };

  const handleSwitchGroup = (groupId: string) => {
    setActiveGroup(groupId);
    localStorage.setItem('activeWatchlistGroup', groupId);
  };

  const handleReorderWatchlist = (newItems: WatchlistItem[]) => {
    const otherItems = watchlist.filter(item => item.group !== activeGroup);
    const updated = [...otherItems, ...newItems];
    setWatchlist(updated);
    localStorage.setItem('watchlist', JSON.stringify(updated));
  };

  const filteredWatchlist = watchlist.filter(item => item.group === activeGroup);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.search-container')) {
        closeSearchDropdown();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [closeSearchDropdown]);

  useEffect(() => {
    if (filteredWatchlist.length > 0 && stockCode === '000001') {
      const firstItem = filteredWatchlist[0];
      setStockCode(firstItem.code);
      setStockName(firstItem.name);
      loadStockData(firstItem.code, timeFrame, dataRange);
    }
  }, []);

  const lastSkewData = useMemo(() => {
    if (volatilityData.length === 0) return null;
    const validSkew = volatilityData.filter(v => v.upVolatility > 0 && v.downVolatility > 0);
    if (validSkew.length === 0) return null;
    return {
      upVolatility: validSkew[validSkew.length - 1]?.upVolatility || 0,
      downVolatility: validSkew[validSkew.length - 1]?.downVolatility || 0,
      volSkew: validSkew[validSkew.length - 1]?.volSkew || 0
    };
  }, [volatilityData]);

  useEffect(() => {
    if (lastSkewData && stockCode) {
      try {
        const cache = JSON.parse(localStorage.getItem('skewCache') || '{}');
        cache[stockCode] = { ...lastSkewData, name: stockName, updatedAt: Date.now() };
        localStorage.setItem('skewCache', JSON.stringify(cache));
      } catch { /* ignore */ }
    }
  }, [lastSkewData, stockCode, stockName]);

  const skewCache = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('skewCache') || '{}');
    } catch {
      return {};
    }
  }, [lastSkewData, stockCode]);

  const stats = useMemo(() => {
    if (volatilityData.length === 0) return null;
    const validVol = volatilityData.filter(v => v.volatility > 0);
    const validAtr = volatilityData.filter(v => v.atr > 0);
    const validHv = volatilityData.filter(v => v.hv > 0);
    
    return {
      volatility: validVol.length > 0 ? {
        avg: validVol.reduce((sum, v) => sum + v.volatility, 0) / validVol.length,
        max: Math.max(...validVol.map(v => v.volatility)),
        min: Math.min(...validVol.map(v => v.volatility)),
        current: validVol[validVol.length - 1]?.volatility || 0
      } : null,
      atr: validAtr.length > 0 ? {
        avg: validAtr.reduce((sum, v) => sum + v.atr, 0) / validAtr.length,
        max: Math.max(...validAtr.map(v => v.atr)),
        min: Math.min(...validAtr.map(v => v.atr)),
        current: validAtr[validAtr.length - 1]?.atr || 0
      } : null,
      hv: validHv.length > 0 ? {
        avg: validHv.reduce((sum, v) => sum + v.hv, 0) / validHv.length,
        max: Math.max(...validHv.map(v => v.hv)),
        min: Math.min(...validHv.map(v => v.hv)),
        current: validHv[validHv.length - 1]?.hv || 0
      } : null
    };
  }, [volatilityData]);

  const skewStats = useMemo(() => {
    if (volatilityData.length === 0) return null;
    const validSkew = volatilityData.filter(v => v.upVolatility > 0 && v.downVolatility > 0);
    if (validSkew.length === 0) return null;

    const currentSkew = validSkew[validSkew.length - 1]?.volSkew || 0;
    const avgSkew = validSkew.reduce((sum, v) => sum + v.volSkew, 0) / validSkew.length;
    const currentUpVol = validSkew[validSkew.length - 1]?.upVolatility || 0;
    const currentDownVol = validSkew[validSkew.length - 1]?.downVolatility || 0;
    const avgUpVol = validSkew.reduce((sum, v) => sum + v.upVolatility, 0) / validSkew.length;
    const avgDownVol = validSkew.reduce((sum, v) => sum + v.downVolatility, 0) / validSkew.length;
    const maxSkew = Math.max(...validSkew.map(v => v.volSkew));
    const minSkew = Math.min(...validSkew.map(v => v.volSkew));

    return {
      currentSkew, avgSkew, currentUpVol, currentDownVol, avgUpVol, avgDownVol, maxSkew, minSkew,
      ratio: avgUpVol / avgDownVol
    };
  }, [volatilityData]);

  const INDICATOR_LABELS: Record<VolatilityIndicator, string> = { volatility: '波动率', atr: 'ATR', hv: '历史波动率' };
  const INDICATOR_COLORS: Record<VolatilityIndicator, string> = { volatility: 'text-purple-400', atr: 'text-cyan-400', hv: 'text-amber-400' };
  const INDICATOR_UNITS: Record<VolatilityIndicator, string> = { volatility: '%', atr: '', hv: '%' };

  const gridResult = useMemo(() => {
    const latestClose = displayData.length > 0 ? displayData[displayData.length - 1].close : 0;
    return calculateGrid(gridConfig, latestClose, volatilityData);
  }, [gridConfig, displayData, volatilityData]);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200">
      <Toast toasts={toasts} onDismiss={dismissToast} />
      <header className="bg-slate-800 border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-700 rounded-lg flex items-center justify-center">
                <i className="fas fa-chart-area text-white text-lg"></i>
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">波动率分析</h1>
                <p className="text-xs text-slate-400">K线与波动率关系研究</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative search-container">
                <div className="flex items-center gap-2 bg-slate-700/50 rounded-lg px-3 py-1.5">
                  <i className="fas fa-search text-slate-400 text-sm"></i>
                  <input
                    type="text"
                    value={searchInput}
                    onChange={(e) => handleSearchInputChange(e.target.value)}
                    onFocus={handleSearchFocus}
                    onKeyDown={(e) => handleKeyDown(e, onSelectStock)}
                    placeholder="输入股票代码或名称"
                    className="bg-transparent text-sm text-white placeholder-slate-400 outline-none w-32"
                  />
                  {isLoading && <i className="fas fa-spinner fa-spin text-slate-400 text-xs"></i>}
                </div>
                {(showSearchResults || showPopularIndices) && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
                    {showPopularIndices && (
                      <div className="p-2 border-b border-slate-700">
                        <div className="text-xs text-slate-500 px-1 mb-1">主要指数</div>
                        {popularIndices.map((item) => (
                          <button
                            key={item.code}
                            onClick={() => onSelectStock(item.code, item.name)}
                            className="w-full px-2 py-1.5 text-left text-sm text-slate-200 hover:bg-slate-700 transition-colors flex items-center justify-between rounded"
                          >
                            <span className="font-mono text-blue-400">{item.code}</span>
                            <span className="text-slate-300">{item.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {showSearchResults && searchResults.map((result) => (
                      <button
                        key={result.code}
                        onClick={() => onSelectStock(result.code, result.name)}
                        className="w-full px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-700 transition-colors flex items-center justify-between"
                      >
                        <span className="font-mono text-blue-400">{result.code}</span>
                        <span className="text-slate-300">{result.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowGridTrading(!showGridTrading)}
                  className={`px-2 py-1 text-xs rounded-md border transition-colors flex items-center gap-1 ${
                    showGridTrading
                      ? 'bg-green-600/20 border-green-500 text-green-400'
                      : 'border-slate-600 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <i className="fas fa-th text-[10px]"></i>
                  网格
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowBollingerBands(!showBollingerBands)}
                  className={`px-2 py-1 text-xs rounded-md border transition-colors flex items-center gap-1 ${
                    showBollingerBands
                      ? 'bg-amber-600/20 border-amber-500 text-amber-400'
                      : 'border-slate-600 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <i className="fas fa-chart-line text-[10px]"></i>
                  BOLL
                </button>
                {showBollingerBands && (
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-slate-500">×</span>
                    <input
                      type="number"
                      value={bbMultiplier}
                      onChange={(e) => setBbMultiplier(Math.max(1, Math.min(4, parseFloat(e.target.value) || 2)))}
                      className="bg-slate-700 text-slate-200 text-sm px-1.5 py-0.5 rounded border border-slate-600 w-12 text-center focus:outline-none focus:ring-2 focus:ring-amber-500"
                      min={1}
                      max={4}
                      step={0.5}
                    />
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">指标:</span>
                <div className="flex gap-1 bg-slate-800 rounded-lg p-0.5 border border-slate-700">
                  {[
                    { value: 'volatility' as VolatilityIndicator, label: '波动率' },
                    { value: 'atr' as VolatilityIndicator, label: 'ATR' },
                    { value: 'hv' as VolatilityIndicator, label: 'HV' },
                  ].map(ind => (
                    <button
                      key={ind.value}
                      onClick={() => setSelectedIndicator(ind.value)}
                      className={`px-2 py-1 text-xs rounded-md transition-colors ${
                        selectedIndicator === ind.value
                          ? 'bg-purple-600 text-white font-medium'
                          : 'text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {ind.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">周期:</span>
                <select
                  value={timeFrame}
                  onChange={(e) => handleTimeFrameChange(e.target.value as TimeFrame)}
                  className="bg-slate-700 text-slate-200 text-sm px-2 py-1 rounded border border-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="1m">1分钟</option>
                  <option value="5m">5分钟</option>
                  <option value="10m">10分钟</option>
                  <option value="15m">15分钟</option>
                  <option value="30m">30分钟</option>
                  <option value="60m">60分钟</option>
                  <option value="1d">日线</option>
                  <option value="1w">周线</option>
                </select>
              </div>
              <div className="flex gap-1 bg-slate-800 rounded-lg p-1 border border-slate-700">
                {[
                  { value: '1m', label: '1月' },
                  { value: '3m', label: '3月' },
                  { value: '6m', label: '6月' },
                  { value: '1y', label: '1年' },
                  { value: '3y', label: '3年' },
                  { value: '5y', label: '5年' },
                  { value: 'all', label: '全部' },
                ].map(range => (
                  <button
                    key={range.value}
                    onClick={() => {
                      setDataRange(range.value);
                      loadStockData(stockCode, timeFrame, range.value);
                    }}
                    className={`px-2 py-1 text-sm rounded-md transition-colors ${
                      dataRange === range.value
                        ? 'bg-purple-600 text-white font-medium'
                        : 'text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {range.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">窗口:</span>
                <input
                  type="number"
                  value={volatilityWindow}
                  onChange={(e) => setVolatilityWindow(Math.max(5, Math.min(100, parseInt(e.target.value) || 20)))}
                  className="bg-slate-700 text-slate-200 text-sm px-2 py-1 rounded border border-slate-600 w-16 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  min={5}
                  max={100}
                />
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <WatchlistPanel
          items={filteredWatchlist}
          currentCode={stockCode}
          currentName={stockName}
          groups={watchlistGroups}
          activeGroup={activeGroup}
          onAdd={() => setShowAddWatchlistModal(true)}
          onAddCurrent={() => handleAddToWatchlist(stockCode, stockName)}
          onSelect={handleSelectStock}
          onRemove={handleRemoveFromWatchlist}
          onReorder={handleReorderWatchlist}
          onClose={() => {}}
          onSwitchGroup={handleSwitchGroup}
          onManageGroups={() => setShowGroupManager(true)}
          onManageCache={() => setShowCacheManager(true)}
          isMobile={false}
          visible={true}
          skewCache={skewCache}
          showSkew={true}
        />

        <div className="grid gap-6 mt-4">
          <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
              <div className="flex items-center gap-4">
                <h2 className="font-semibold text-slate-200">
                  {stockCode} {stockName && <span className="text-slate-400 text-sm">({stockName})</span>}
                </h2>
                <span className="text-xs text-slate-500">{getTimeFrameLabel(timeFrame)}</span>
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-emerald-500 rounded-sm"></span>
                  <span>上涨</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-red-500 rounded-sm"></span>
                  <span>下跌</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-8 h-0.5 bg-purple-500"></span>
                  <span>波动率 (%)</span>
                </div>
                {showBollingerBands && (
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-0.5 bg-amber-500"></span>
                    <span>BOLL ({bbMultiplier}×ATR)</span>
                  </div>
                )}
              </div>
            </div>

            <div ref={containerRef} className="p-4">
              {containerWidth > 0 && (
                <VolatilityChart
                  stockData={displayData}
                  volatilityData={volatilityData}
                  width={containerWidth}
                  height={CHART_HEIGHT}
                  indicator={selectedIndicator}
                  showBollingerBands={showBollingerBands}
                  gridResult={showGridTrading ? gridResult : null}
                />
              )}
            </div>
          </div>

          {stats && stats[selectedIndicator] && (
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
                <div className="text-xs text-slate-400 mb-1">当前{INDICATOR_LABELS[selectedIndicator]}</div>
                <div className={`text-2xl font-bold ${INDICATOR_COLORS[selectedIndicator]}`}>{stats[selectedIndicator]!.current.toFixed(2)}{INDICATOR_UNITS[selectedIndicator]}</div>
              </div>
              <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
                <div className="text-xs text-slate-400 mb-1">平均{INDICATOR_LABELS[selectedIndicator]}</div>
                <div className={`text-2xl font-bold ${INDICATOR_COLORS[selectedIndicator]}`}>{stats[selectedIndicator]!.avg.toFixed(2)}{INDICATOR_UNITS[selectedIndicator]}</div>
              </div>
              <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
                <div className="text-xs text-slate-400 mb-1">最大{INDICATOR_LABELS[selectedIndicator]}</div>
                <div className="text-2xl font-bold text-red-400">{stats[selectedIndicator]!.max.toFixed(2)}{INDICATOR_UNITS[selectedIndicator]}</div>
              </div>
              <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
                <div className="text-xs text-slate-400 mb-1">最小{INDICATOR_LABELS[selectedIndicator]}</div>
                <div className="text-2xl font-bold text-emerald-400">{stats[selectedIndicator]!.min.toFixed(2)}{INDICATOR_UNITS[selectedIndicator]}</div>
              </div>
            </div>
          )}

          {showGridTrading && gridResult.grids.length > 0 && (
            <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-slate-200 font-semibold text-sm flex items-center gap-2">
                  <i className="fas fa-th text-green-400"></i>
                  网格交易基准步长
                  <span className="text-xs text-slate-500 font-normal">({gridResult.gridType})</span>
                </h3>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                <div className="bg-slate-700/50 rounded-lg p-3">
                  <div className="text-xs text-slate-400 mb-1">基准步长</div>
                  <div className="text-xl font-bold text-green-400">{gridResult.stepSize.toFixed(2)}</div>
                </div>
                <div className="bg-slate-700/50 rounded-lg p-3">
                  <div className="text-xs text-slate-400 mb-1">步长百分比</div>
                  <div className="text-xl font-bold text-blue-400">{gridResult.stepPercent.toFixed(2)}%</div>
                </div>
                <div className="bg-slate-700/50 rounded-lg p-3">
                  <div className="text-xs text-slate-400 mb-1">上边界</div>
                  <div className="text-xl font-bold text-emerald-400">{gridResult.upperBound.toFixed(2)}</div>
                </div>
                <div className="bg-slate-700/50 rounded-lg p-3">
                  <div className="text-xs text-slate-400 mb-1">下边界</div>
                  <div className="text-xl font-bold text-red-400">{gridResult.lowerBound.toFixed(2)}</div>
                </div>
                <div className="bg-slate-700/50 rounded-lg p-3">
                  <div className="text-xs text-slate-400 mb-1">网格层级</div>
                  <div className="text-xl font-bold text-purple-400">{gridResult.totalLevels} 层</div>
                </div>
              </div>

              <div className="bg-slate-700/30 rounded-lg p-3 mb-4">
                <div className="flex items-center gap-4 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">类型:</span>
                    <div className="flex gap-1 bg-slate-800 rounded-lg p-0.5 border border-slate-700">
                      {[
                        { value: 'atr' as const, label: 'ATR' },
                        { value: 'volatility' as const, label: 'HV' },
                      ].map(t => (
                        <button
                          key={t.value}
                          onClick={() => setGridConfig(prev => ({ ...prev, gridType: t.value }))}
                          className={`px-2 py-0.5 text-xs rounded-md transition-colors ${
                            gridConfig.gridType === t.value
                              ? 'bg-green-600 text-white font-medium'
                              : 'text-slate-300 hover:bg-slate-700'
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">网格数:</span>
                    <input
                      type="number"
                      value={gridConfig.gridCount}
                      onChange={(e) => setGridConfig(prev => ({ ...prev, gridCount: Math.max(1, Math.min(20, parseInt(e.target.value) || 5)) }))}
                      className="bg-slate-700 text-slate-200 text-sm px-1.5 py-0.5 rounded border border-slate-600 w-12 text-center focus:outline-none focus:ring-2 focus:ring-green-500"
                      min={1}
                      max={20}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">倍数:</span>
                    {gridConfig.gridType === 'atr' ? (
                      <input
                        type="number"
                        value={gridConfig.atrMultiplier}
                        onChange={(e) => setGridConfig(prev => ({ ...prev, atrMultiplier: Math.max(0.5, Math.min(3, parseFloat(e.target.value) || 1)) }))}
                        className="bg-slate-700 text-slate-200 text-sm px-1.5 py-0.5 rounded border border-slate-600 w-12 text-center focus:outline-none focus:ring-2 focus:ring-green-500"
                        min={0.5}
                        max={3}
                        step={0.5}
                      />
                    ) : (
                      <input
                        type="number"
                        value={gridConfig.volatilityMultiplier}
                        onChange={(e) => setGridConfig(prev => ({ ...prev, volatilityMultiplier: Math.max(0.5, Math.min(3, parseFloat(e.target.value) || 1)) }))}
                        className="bg-slate-700 text-slate-200 text-sm px-1.5 py-0.5 rounded border border-slate-600 w-12 text-center focus:outline-none focus:ring-2 focus:ring-green-500"
                        min={0.5}
                        max={3}
                        step={0.5}
                      />
                    )}
                  </div>
                </div>
              </div>

              <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-700">
                <table className="w-full text-xs">
                  <thead className="bg-slate-700/50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left text-slate-400 font-medium">层级</th>
                      <th className="px-3 py-2 text-right text-slate-400 font-medium">网格价格</th>
                      <th className="px-3 py-2 text-right text-slate-400 font-medium">偏离度</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...gridResult.grids].reverse().map((grid, idx) => {
                      const deviation = ((grid.price - gridResult.grids[gridResult.grids.length - 1].price) / gridResult.grids[gridResult.grids.length - 1].price * 100);
                      return (
                        <tr key={idx} className={`border-t border-slate-700/50 ${
                          grid.level === 0 ? 'bg-green-600/10' : 'hover:bg-slate-700/30'
                        }`}>
                          <td className="px-3 py-2">
                            <span className={`px-1.5 py-0.5 rounded font-mono ${
                              grid.level > 0 ? 'bg-emerald-600/20 text-emerald-400' :
                              grid.level < 0 ? 'bg-red-600/20 text-red-400' :
                              'bg-green-600/30 text-green-400 font-bold'
                            }`}>
                              {grid.level > 0 ? `卖${grid.level}` : grid.level < 0 ? `买${Math.abs(grid.level)}` : '基准'}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right font-mono">{grid.price.toFixed(2)}</td>
                          <td className="px-3 py-2 text-right font-mono text-slate-500">{deviation > 0 ? '+' : ''}{deviation.toFixed(2)}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {skewStats && (
            <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-slate-200 font-semibold text-sm flex items-center gap-2">
                  <i className="fas fa-balance-scale text-blue-400"></i>
                  波动率偏度分析
                </h3>
                <div className={`px-3 py-1 rounded-full text-sm font-bold ${
                  skewStats.ratio >= 1
                    ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-red-600/20 text-red-400 border border-red-500/30'
                }`}>
                  {skewStats.ratio >= 1 ? '✓ 上行波动率主导' : '✗ 下行波动率主导'}
                </div>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="bg-slate-700/50 rounded-lg p-3">
                  <div className="text-xs text-slate-400 mb-1">当前偏度比</div>
                  <div className={`text-2xl font-bold ${skewStats.currentSkew >= 1 ? 'text-emerald-400' : 'text-red-400'}`}>{skewStats.currentSkew.toFixed(3)}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">上/下波动率比</div>
                </div>
                <div className="bg-slate-700/50 rounded-lg p-3">
                  <div className="text-xs text-slate-400 mb-1">平均偏度比</div>
                  <div className={`text-2xl font-bold ${skewStats.ratio >= 1 ? 'text-emerald-400' : 'text-red-400'}`}>{skewStats.ratio.toFixed(3)}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">趋势判断</div>
                </div>
                <div className="bg-slate-700/50 rounded-lg p-3">
                  <div className="text-xs text-slate-400 mb-1">上行波动率</div>
                  <div className="text-2xl font-bold text-emerald-400">{skewStats.currentUpVol.toFixed(2)}%</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">当前</div>
                </div>
                <div className="bg-slate-700/50 rounded-lg p-3">
                  <div className="text-xs text-slate-400 mb-1">下行波动率</div>
                  <div className="text-2xl font-bold text-red-400">{skewStats.currentDownVol.toFixed(2)}%</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">当前</div>
                </div>
              </div>

              <div className="flex items-center gap-4 p-3 bg-slate-700/30 rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-emerald-400">上行波动率</span>
                    <span className="text-xs text-slate-400">{skewStats.avgUpVol.toFixed(2)}%</span>
                  </div>
                  <div className="w-full bg-slate-600 rounded-full h-2">
                    <div className="bg-emerald-500 h-2 rounded-full" style={{ width: `${Math.min(100, (skewStats.avgUpVol / Math.max(skewStats.avgUpVol, skewStats.avgDownVol)) * 100)}%` }}></div>
                  </div>
                </div>
                <div className="text-xs text-slate-500">vs</div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-red-400">下行波动率</span>
                    <span className="text-xs text-slate-400">{skewStats.avgDownVol.toFixed(2)}%</span>
                  </div>
                  <div className="w-full bg-slate-600 rounded-full h-2">
                    <div className="bg-red-500 h-2 rounded-full" style={{ width: `${Math.min(100, (skewStats.avgDownVol / Math.max(skewStats.avgUpVol, skewStats.avgDownVol)) * 100)}%` }}></div>
                  </div>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2 text-[10px] text-slate-500">
                <i className="fas fa-lightbulb text-yellow-500"></i>
                <span>偏度比 ≥ 1：涨时波动温和，资金介入坚决 | 偏度比 &lt; 1：跌时波动剧烈，抛压较重，筹码结构不稳定</span>
              </div>
            </div>
          )}

          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <h3 className="text-slate-200 font-semibold text-sm mb-3">使用说明</h3>
            <ul className="space-y-2 text-xs text-slate-400">
              <li className="flex items-start gap-2">
                <i className="fas fa-chart-line text-purple-400 mt-0.5"></i>
                <span>上方K线蜡烛图显示价格走势，下方显示选中指标的走势</span>
              </li>
              <li className="flex items-start gap-2">
                <i className="fas fa-sliders-h text-purple-400 mt-0.5"></i>
                <span>支持三种指标：波动率(年化标准差)、ATR(平均真实波动范围)、HV(历史波动率)</span>
              </li>
              <li className="flex items-start gap-2">
                <i className="fas fa-mouse-pointer text-purple-400 mt-0.5"></i>
                <span>鼠标悬停在图表上查看具体价格和指标数值</span>
              </li>
              <li className="flex items-start gap-2">
                <i className="fas fa-info-circle text-purple-400 mt-0.5"></i>
                <span>波动率 = 收益率标准差 × √252 × 100% | ATR = N日真实波动范围均值</span>
              </li>
              <li className="flex items-start gap-2">
                <i className="fas fa-balance-scale text-purple-400 mt-0.5"></i>
                <span>波动率偏度 = 上行波动率 ÷ 下行波动率，≥1 代表资金介入坚决，&lt;1 代表下行风险主导</span>
              </li>
            </ul>
          </div>
        </div>
      </main>

      {showAddWatchlistModal && (
        <AddWatchlistModal
          existingCodes={filteredWatchlist.map(item => item.code)}
          onAdd={handleAddToWatchlist}
          onClose={() => setShowAddWatchlistModal(false)}
        />
      )}

      {showGroupManager && (
        <GroupManagerModal
          groups={watchlistGroups}
          onAdd={handleAddGroup}
          onRemove={handleRemoveGroup}
          onClose={() => setShowGroupManager(false)}
        />
      )}

      {showCacheManager && (
        <CacheManagerModal
          stockCode={stockCode}
          onClose={() => setShowCacheManager(false)}
          onClearStock={(code) => {
            clearVolatilityCache(code);
          }}
        />
      )}
    </div>
  );
};
