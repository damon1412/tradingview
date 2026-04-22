import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { CandlestickChart } from './components/CandlestickChart';
import { VolumeProfile, calculateVolumeProfileStats } from './components/VolumeProfile';
import { IndicatorChart } from './components/IndicatorChart';
import { StatsPanel } from './components/StatsPanel';
import { TimeFrameSelector } from './components/TimeFrameSelector';
import { TradeAnalysisPanel } from './components/TradeAnalysisPanel';
import { generateMockStockData, calculateVolumeProfile, getTimeFrameLabel } from './utils/stockData';
import { searchStocks, getStockDataWithFallback, get1MinuteDataForVolumeProfile, getApiTypeFromTimeFrame, getMinuteData, getQuote, convertMinuteToStockData } from './services/stockApi';
import type { StockData, SelectedRange, VolumeProfileStats, TimeFrame, PinnedProfile } from './types/stock';

const CHART_HEIGHT = 360;
const VOLUME_HEIGHT = 100;
const PROFILE_WIDTH = 120;

const App: React.FC = () => {
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('1d');
  const [dataRange, setDataRange] = useState<string>('1y'); // 数据显示范围
  const [selectedIndicator, setSelectedIndicator] = useState<'volume' | 'macd' | 'rsi'>('volume'); // 选中的技术指标
  const [data, setData] = useState<StockData[]>([]);
  const [selectedRange, setSelectedRange] = useState<SelectedRange | null>(null);
  const [pinnedProfiles, setPinnedProfiles] = useState<PinnedProfile[]>([]);
  const [containerWidth, setContainerWidth] = useState(0);
  const [priceLevels, setPriceLevels] = useState(40);
  const [stockCode, setStockCode] = useState('000001');
  const [stockName, setStockName] = useState('平安银行');
  const [searchInput, setSearchInput] = useState('');
  const [searchResults, setSearchResults] = useState<{code: string; name: string}[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [zoomRange, setZoomRange] = useState<{startIndex: number; endIndex: number} | null>(null);
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

  useEffect(() => {
    loadStockData(stockCode, timeFrame);
    setSelectedRange(null);
    setZoomRange(null);
    setPriceLevels(40);
    // 只在切换股票时清空固定点位，切换周期时保留
  }, [timeFrame, stockCode, dataRange]);

  const displayData = useMemo(() => {
    if (!zoomRange) return data;
    return data.slice(zoomRange.startIndex, zoomRange.endIndex + 1);
  }, [data, zoomRange]);

  const activeProfileRange = selectedRange;

  const selectedData = useMemo(() => {
    if (!activeProfileRange) {
      // 没有选中范围，返回 displayData（已根据 zoomRange 过滤）
      return displayData;
    }
    // 有选中范围，从 displayData 中切片
    return displayData.slice(activeProfileRange.startIndex, activeProfileRange.endIndex + 1);
  }, [displayData, activeProfileRange]);

  const [volumeProfileData, setVolumeProfileData] = useState<StockData[]>([]);

  useEffect(() => {
    const loadVolumeProfileData = async () => {
      if (selectedData.length === 0) {
        setVolumeProfileData([]);
        return;
      }

      // 先立即用当前选中周期的数据更新，避免显示固定不变
      setVolumeProfileData(selectedData);

      // 非1分钟周期，异步加载更精确的1分钟数据
      if (stockCode !== 'DEMO' && timeFrame !== '1m') {
        const startDate = new Date(selectedData[0].timestamp);
        const endDate = new Date(selectedData[selectedData.length - 1].timestamp);
        // 格式化日期为YYYYMMDD（本地时区，避免UTC时差问题）
        const formatDate = (date: Date) => {
          const year = date.getFullYear();
          const month = (date.getMonth() + 1).toString().padStart(2, '0');
          const day = date.getDate().toString().padStart(2, '0');
          return `${year}${month}${day}`;
        };
        const startDateStr = formatDate(startDate);
        const endDateStr = formatDate(endDate);

        try {
          const { data: minuteData, error } = await get1MinuteDataForVolumeProfile(stockCode, startDateStr, endDateStr);
          if (error) {
            console.error('获取1分钟数据失败:', error);
            return;
          }
          if (minuteData.length > 0) {
            // 过滤1分钟数据，只保留选中区间内的数据
            const filteredMinuteData = minuteData.filter(
              item => item.timestamp >= selectedData[0].timestamp && item.timestamp <= selectedData[selectedData.length - 1].timestamp
            );
            if (filteredMinuteData.length > 0) {
              setVolumeProfileData(filteredMinuteData);
            }
          }
        } catch (err) {
          console.error('加载1分钟数据失败:', err);
        }
      }
    };

    loadVolumeProfileData();
  }, [selectedData, stockCode, timeFrame]);

  const stats = useMemo<VolumeProfileStats | null>(() => {
    if (volumeProfileData.length === 0) return null;
    const { profile } = calculateVolumeProfile(volumeProfileData, priceLevels);
    return calculateVolumeProfileStats(profile);
  }, [volumeProfileData, priceLevels]);

  const priceRange = useMemo(() => {
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

  const loadStockData = async (code: string, tf: TimeFrame) => {
    setIsLoading(true);
    try {
      if (tf === 'minute') {
        const { data: quoteData, error: quoteError } = await getQuote(code);
        if (quoteError) {
          alert(`获取行情数据失败: ${quoteError.message}`);
          return;
        }
        const previousClose = quoteData?.Last || 0;
        
        const { data: minuteData, error: minuteError } = await getMinuteData(code);
        if (minuteError) {
          alert(`获取分时数据失败: ${minuteError.message}`);
          return;
        }
        if (minuteData && minuteData.list.length > 0) {
          const stockData = convertMinuteToStockData(minuteData.list, previousClose);
          setData(stockData);
        } else {
          alert('未找到该股票分时数据');
        }
        return;
      }

      const { data: stockData, error } = await getStockDataWithFallback(code, tf);
      if (error) {
        alert(`获取股票数据失败: ${error.message}`);
        return;
      }
      if (stockData.length > 0) {
        let filteredData = stockData;
        if (dataRange !== 'all') {
          const now = Date.now();
          let rangeMs: number;
          switch (dataRange) {
            case '1m': rangeMs = 30 * 24 * 60 * 60 * 1000; break;
            case '3m': rangeMs = 90 * 24 * 60 * 60 * 1000; break;
            case '6m': rangeMs = 180 * 24 * 60 * 60 * 1000; break;
            case '1y': rangeMs = 365 * 24 * 60 * 60 * 1000; break;
            case '3y': rangeMs = 3 * 365 * 24 * 60 * 60 * 1000; break;
            case '5y': rangeMs = 5 * 365 * 24 * 60 * 60 * 1000; break;
            default: rangeMs = 365 * 24 * 60 * 60 * 1000;
          }
          const cutoffTime = now - rangeMs;
          filteredData = stockData.filter(item => item.timestamp >= cutoffTime);
        }
        setData(filteredData);
      } else {
        alert('未找到该股票数据，请检查股票代码');
      }
    } catch (error) {
      console.error('加载股票数据失败:', error);
      alert('获取股票数据失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchInputChange = async (value: string) => {
    setSearchInput(value);
    if (value.trim().length >= 2) {
      const { data: results, error } = await searchStocks(value.trim());
      if (error) {
        console.error('搜索失败:', error);
        setSearchResults([]);
        setShowSearchResults(false);
        return;
      }
      setSearchResults(results);
      setShowSearchResults(results.length > 0);
    } else {
      setShowSearchResults(false);
    }
  };

  const handleSelectStock = (code: string, name: string) => {
    setStockCode(code);
    setStockName(name);
    setSearchInput('');
    setShowSearchResults(false);
    setSearchResults([]);
    setSelectedRange(null);
    setPinnedProfiles([]);
    setPriceLevels(40);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && searchResults.length > 0) {
      handleSelectStock(searchResults[0].code, searchResults[0].name);
    }
  };

  const chartWidth = Math.max(0, containerWidth - PROFILE_WIDTH - 32);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200">
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
                    onKeyDown={handleKeyDown}
                    placeholder="输入股票代码或名称"
                    className="bg-transparent text-sm text-white placeholder-slate-400 outline-none w-32"
                  />
                  {isLoading && <i className="fas fa-spinner fa-spin text-slate-400 text-xs"></i>}
                </div>
                {showSearchResults && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
                    {searchResults.map((result) => (
                      <button
                        key={result.code}
                        onClick={() => handleSelectStock(result.code, result.name)}
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

              {/* 数据范围选择 */}
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
                      // 切换范围后重新加载数据
                      loadStockData(stockCode, timeFrame);
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
        <div className="grid grid-cols-1 gap-6 mb-6">
          {/* 逐笔分析面板始终显示 */}
          <TradeAnalysisPanel stockCode={stockCode} pinnedProfiles={pinnedProfiles} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
                <div className="flex items-center gap-4">
                  <h2 className="font-semibold text-slate-200">{stockCode} {stockName && <span className="text-slate-400 text-sm">({stockName})</span>}</h2>
                  <span className="text-xs text-slate-500">{getTimeFrameLabel(timeFrame)}</span>
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
                            // 计算相对于原始数据的索引
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

          <div className="lg:col-span-1">
            <StatsPanel
              data={data}
              stats={stats}
              selectedRange={selectedRange}
            />

            <div className="mt-4 bg-slate-800 rounded-lg p-4 border border-slate-700">
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
        </div>
      </main>
    </div>
  );
};

export default App;
