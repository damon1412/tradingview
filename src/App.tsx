import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { CandlestickChart } from './components/CandlestickChart';
import { VolumeProfile, calculateVolumeProfileStats } from './components/VolumeProfile';
import { IndicatorChart } from './components/IndicatorChart';
import { StatsPanel } from './components/StatsPanel';
import { TimeFrameSelector } from './components/TimeFrameSelector';
import { TradeAnalysisPanel } from './components/TradeAnalysisPanel';
import { Toast, useToast } from './components/Toast';
import { WatchlistPanel } from './components/WatchlistPanel';
import { AddWatchlistModal } from './components/AddWatchlistModal';
import { GroupManagerModal } from './components/GroupManagerModal';
import { FinancePanel } from './components/FinancePanel';
import { useStockData } from './hooks/useStockData';
import { useSearch } from './hooks/useSearch';
import { useVolumeProfile } from './hooks/useVolumeProfile';
import { getTimeFrameLabel } from './utils/stockData';
import type { SelectedRange, VolumeProfileStats, TimeFrame, PinnedProfile, WatchlistItem, WatchlistGroup } from './types/stock';

const CHART_HEIGHT = 360;
const VOLUME_HEIGHT = 100;
const PROFILE_WIDTH = 120;

const App: React.FC = () => {
  const { showToast, toasts, dismissToast } = useToast();
  const { data, displayData, stockCode, setStockCode, stockName, setStockName, isLoading, setIsLoading, zoomRange, setZoomRange, loadStockData: loadStockDataRaw } = useStockData(showToast);
  const { searchInput, searchResults, showSearchResults, showPopularIndices, handleSearchFocus, handleSearchInputChange, handleSelectStock: handleSelectStockRaw, handleKeyDown, popularIndices } = useSearch();
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('1d');
  const [dataRange, setDataRange] = useState<string>('1y');
  const [selectedIndicator, setSelectedIndicator] = useState<'volume' | 'macd' | 'rsi'>('volume');
  const [selectedRange, setSelectedRange] = useState<SelectedRange | null>(null);
  const [pinnedProfiles, setPinnedProfiles] = useState<PinnedProfile[]>([]);
  const [containerWidth, setContainerWidth] = useState(0);
  const [priceLevels, setPriceLevels] = useState(100);
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
  const containerRef = useRef<HTMLDivElement>(null);

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
    loadStockData(stockCode, timeFrame);
    setSelectedRange(null);
    setZoomRange(null);
    setPriceLevels(100);
  }, [timeFrame, stockCode, dataRange]);

  const selectedData = useMemo(() => {
    if (!selectedRange) return displayData;
    return displayData.slice(selectedRange.startIndex, selectedRange.endIndex + 1);
  }, [displayData, selectedRange]);

  const { volumeProfileData, volumeProfile, dataSourceLabel } = useVolumeProfile(selectedData, stockCode, timeFrame, priceLevels);

  const stats = useMemo<VolumeProfileStats | null>(() => {
    if (!volumeProfile) return null;
    return calculateVolumeProfileStats(volumeProfile);
  }, [volumeProfile]);

  const priceRange = useMemo(() => {
    if (displayData.length === 0) return { min: 0, max: 1 };
    const min = Math.min(...displayData.map(d => d.low));
    const max = Math.max(...displayData.map(d => d.high));
    return { min, max };
  }, [displayData]);

  const priceToY = useCallback((price: number) => {
    const range = priceRange.max - priceRange.min;
    if (range === 0) return CHART_HEIGHT / 2;
    return CHART_HEIGHT - ((price - priceRange.min) / range) * CHART_HEIGHT;
  }, [priceRange]);

  const handleRangeSelect = useCallback((range: SelectedRange | null) => {
    setSelectedRange(range);
  }, []);

  const handleClearSelection = () => {
    setSelectedRange(null);
    setPinnedProfiles([]);
  };

  const handlePinProfile = () => {
    if (selectedRange && stats) {
      const colors = ['#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];
      const newProfile: PinnedProfile = {
        id: Date.now().toString(),
        range: selectedRange,
        stats,
        color: colors[pinnedProfiles.length % colors.length]
      };
      setPinnedProfiles(prev => [...prev, newProfile]);
    }
  };

  const handleUnpinProfile = (id: string) => {
    setPinnedProfiles(prev => prev.filter(p => p.id !== id));
  };

  const handleClearAllPinned = () => {
    setPinnedProfiles([]);
  };

  const handleTimeFrameChange = (newTimeFrame: TimeFrame) => {
    setTimeFrame(newTimeFrame);
  };

  const handleSelectStock = (code: string, name: string) => {
    setStockCode(code);
    setStockName(name);
    setSelectedRange(null);
    setPinnedProfiles([]);
    setPriceLevels(100);
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

  const filteredWatchlist = watchlist.filter(item => item.group === activeGroup);

  const chartWidth = Math.max(0, containerWidth - PROFILE_WIDTH - 32);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200">
      <Toast toasts={toasts} onDismiss={dismissToast} />
      <header className="bg-slate-800 border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-700 rounded-lg flex items-center justify-center">
                <i className="fas fa-chart-line text-white text-lg"></i>
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">TradeView Pro</h1>
                <p className="text-xs text-slate-400">股票筹码分布分析工具</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="flex items-center gap-2 bg-slate-700/50 rounded-lg px-3 py-1.5">
                  <i className="fas fa-search text-slate-400 text-sm"></i>
                  <input
                    type="text"
                    value={searchInput}
                    onChange={(e) => handleSearchInputChange(e.target.value)}
                    onFocus={handleSearchFocus}
                    onKeyDown={(e) => handleKeyDown(e, (code, name) => handleSelectStockRaw(code, name, handleSelectStock))}
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
                            onClick={() => handleSelectStockRaw(item.code, item.name, handleSelectStock)}
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
                        onClick={() => handleSelectStockRaw(result.code, result.name, handleSelectStock)}
                        className="w-full px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-700 transition-colors flex items-center justify-between"
                      >
                        <span className="font-mono text-blue-400">{result.code}</span>
                        <span className="text-slate-300">{result.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <TimeFrameSelector value={timeFrame} onChange={handleTimeFrameChange} />
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
                        ? 'bg-blue-600 text-white font-medium'
                        : 'text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {range.label}
                  </button>
                ))}
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
          onClose={() => {}}
          onSwitchGroup={handleSwitchGroup}
          onManageGroups={() => setShowGroupManager(true)}
          isMobile={false}
          visible={true}
        />

        <div className="mt-4">
          <FinancePanel stockCode={stockCode} />
        </div>

        <div className="grid grid-cols-1 gap-6 mb-6 mt-4">
          <TradeAnalysisPanel stockCode={stockCode} pinnedProfiles={pinnedProfiles} />
        </div>

        <div className="grid gap-6">
          <div className="space-y-4">
            <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
                <div className="flex items-center gap-4">
                  <h2 className="font-semibold text-slate-200">{stockCode} {stockName && <span className="text-slate-400 text-sm">({stockName})</span>}</h2>
                  <span className="text-xs text-slate-500">{getTimeFrameLabel(timeFrame)}</span>
                  {dataSourceLabel && (
                    <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded" title="筹码分布使用此数据计算">
                      <i className="fas fa-database mr-1"></i>
                      使用{dataSourceLabel}
                    </span>
                  )}
                  {selectedRange && (
                    <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded">
                      已选中 {selectedRange.endIndex - selectedRange.startIndex + 1} 根K线
                    </span>
                  )}
                  {pinnedProfiles.length > 0 && (
                    <div className="flex items-center gap-1">
                      {pinnedProfiles.map((p, i) => (
                        <span
                          key={p.id}
                          className="text-xs px-2 py-1 rounded flex items-center gap-1 group"
                          style={{ backgroundColor: `${p.color}30`, color: p.color }}
                        >
                          <i className="fas fa-thumbtack text-xs"></i>
                          #{i + 1} POC:{p.stats.poc.toFixed(2)}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUnpinProfile(p.id);
                            }}
                            className="ml-1 hover:bg-white/20 rounded px-0.5 leading-tight transition-colors"
                            title="移除"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {selectedRange && (
                    <button
                      onClick={handlePinProfile}
                      className="text-xs bg-amber-600 hover:bg-amber-500 text-white px-3 py-1.5 rounded transition-colors flex items-center gap-1"
                    >
                      <i className="fas fa-thumbtack"></i>
                      固定筹码分布
                    </button>
                  )}
                  {pinnedProfiles.length > 0 && (
                    <button
                      onClick={handleClearAllPinned}
                      className="text-xs bg-amber-700 hover:bg-amber-600 text-white px-3 py-1.5 rounded transition-colors flex items-center gap-1"
                    >
                      <i className="fas fa-times"></i>
                      清除全部固定
                    </button>
                  )}
                  {selectedRange && (
                    <button
                      onClick={handleClearSelection}
                      className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-1.5 rounded transition-colors"
                    >
                      清除选择
                    </button>
                  )}
                  <span className="text-xs text-slate-500">
                    <i className="fas fa-mouse-pointer mr-1"></i>
                    拖拽框选区间
                  </span>
                </div>
              </div>

              <div ref={containerRef} className="p-4">
                {containerWidth > 0 && (
                  <div className="flex">
                    <div className="flex-1">
                      <CandlestickChart
                        data={displayData}
                        width={chartWidth}
                        height={CHART_HEIGHT}
                        selectedRange={selectedRange}
                        onRangeSelect={handleRangeSelect}
                        onZoom={(range) => {
                          if (range) {
                            const baseIndex = zoomRange ? zoomRange.startIndex : 0;
                            setZoomRange({
                              startIndex: baseIndex + range.startIndex,
                              endIndex: baseIndex + range.endIndex
                            });
                          } else {
                            setZoomRange(null);
                          }
                        }}
                        pinnedProfiles={pinnedProfiles}
                      />
                    </div>
                    <div className="border-l border-slate-700">
                      <VolumeProfile
                        data={volumeProfileData.length > 0 ? volumeProfileData : selectedData}
                        width={PROFILE_WIDTH}
                        height={CHART_HEIGHT}
                        minPrice={priceRange.min}
                        maxPrice={priceRange.max}
                        priceToY={priceToY}
                        priceLevels={priceLevels}
                        onPriceLevelsChange={setPriceLevels}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="px-4 pb-4">
                <div className="flex items-center gap-6 text-xs text-slate-400 border-t border-slate-700 pt-3">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 bg-emerald-500 rounded-sm"></span>
                    <span>上涨</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 bg-red-500 rounded-sm"></span>
                    <span>下跌</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-0.5 bg-amber-500"></span>
                    <span>POC (最大成交价位)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-0.5 bg-emerald-500 border-dashed"></span>
                    <span>VAH (价值区高点)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-0.5 bg-red-500 border-dashed"></span>
                    <span>VAL (价值区低点)</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
                <h2 className="font-semibold text-slate-200">
                  {selectedIndicator === 'volume' ? '成交量' : selectedIndicator === 'macd' ? 'MACD' : 'RSI'}
                </h2>
                <div className="relative">
                  <select
                    value={selectedIndicator}
                    onChange={(e) => setSelectedIndicator(e.target.value as 'volume' | 'macd' | 'rsi')}
                    className="bg-slate-700 text-slate-200 text-sm px-3 py-1 rounded border border-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="volume">成交量</option>
                    <option value="macd">MACD</option>
                    <option value="rsi">RSI</option>
                  </select>
                </div>
              </div>
              <div className="flex">
                <div className="flex-1 p-4">
                  {containerWidth > 0 && (
                    <IndicatorChart
                      data={displayData}
                      width={chartWidth}
                      height={VOLUME_HEIGHT}
                      selectedRange={selectedRange}
                      indicator={selectedIndicator}
                    />
                  )}
                </div>
                <div className="w-[120px] border-l border-slate-700"></div>
              </div>
            </div>
          </div>

          <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-700">
              <h3 className="font-semibold text-slate-200 text-sm">数据统计</h3>
            </div>
            <StatsPanel
              data={data}
              stats={stats}
              selectedRange={selectedRange}
            />
          </div>

          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <h3 className="text-slate-200 font-semibold text-sm mb-3">使用说明</h3>
            <ul className="space-y-2 text-xs text-slate-400">
              <li className="flex items-start gap-2">
                <i className="fas fa-clock text-blue-400 mt-0.5"></i>
                <span>顶部切换时间周期（1分钟到周线）</span>
              </li>
              <li className="flex items-start gap-2">
                <i className="fas fa-hand-pointer text-blue-400 mt-0.5"></i>
                <span>在K线图上拖拽鼠标框选时间区间</span>
              </li>
              <li className="flex items-start gap-2">
                <i className="fas fa-chart-bar text-blue-400 mt-0.5"></i>
                <span>右侧显示选中区间的筹码分布</span>
              </li>
              <li className="flex items-start gap-2">
                <i className="fas fa-thumbtack text-amber-400 mt-0.5"></i>
                <span>点击"固定筹码分布"可锁定当前分布，可固定多个区间进行对比</span>
              </li>
              <li className="flex items-start gap-2">
                <i className="fas fa-bullseye text-amber-400 mt-0.5"></i>
                <span><strong>POC</strong>: 成交量最大的价位</span>
              </li>
              <li className="flex items-start gap-2">
                <i className="fas fa-arrows-alt-v text-emerald-400 mt-0.5"></i>
                <span><strong>VAH/VAL</strong>: 70%成交量分布的价值区上下边界</span>
              </li>
              <li className="flex items-start gap-2">
                <i className="fas fa-undo text-slate-400 mt-0.5"></i>
                <span>双击图表或点击"清除选择"重置</span>
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
    </div>
  );
};

export default App;
