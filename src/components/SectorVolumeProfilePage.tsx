import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { CandlestickChart } from './CandlestickChart';
import { VolumeProfile } from './VolumeProfile';
import { IndicatorChart } from './IndicatorChart';
import { StatsPanel } from './StatsPanel';

interface SectorKlineData {
  symbol: string;
  open: number;
  high: number;
  low: number;
  close: number;
  amount: number;
  volume: number;
  date: string;
}

interface DisplayDataItem {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  amount?: number;
}

interface VolumeProfileStats {
  poc: number;
  vah: number;
  val: number;
  totalVolume: number;
}

interface SelectedRange {
  startIndex: number;
  endIndex: number;
}

interface PinnedProfile {
  id: string;
  color: string;
  stats: VolumeProfileStats;
  range: SelectedRange;
}

interface SectorVolumeProfilePageProps {
  sectorCode: string;
  sectorName: string;
}

const CHART_HEIGHT = 360;
const VOLUME_HEIGHT = 100;
const PROFILE_WIDTH = 120;

const COLORS = ['#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

function getTimeFrameLabel(tf: string): string {
  const map: Record<string, string> = {
    '1d': '日线',
    '1w': '周线',
    '1m': '月线'
  };
  return map[tf] || tf;
}

export const SectorVolumeProfilePage: React.FC<SectorVolumeProfilePageProps> = ({ sectorCode, sectorName }) => {
  const [data, setData] = useState<SectorKlineData[]>([]);
  const [displayData, setDisplayData] = useState<DisplayDataItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [priceLevels, setPriceLevels] = useState(100);
  const [dataRange, setDataRange] = useState<string>('6m');
  const [timeFrame, setTimeFrame] = useState<string>('1d');
  const [selectedIndicator, setSelectedIndicator] = useState<'volume' | 'macd' | 'rsi'>('volume');
  const [selectedRange, setSelectedRange] = useState<SelectedRange | null>(null);
  const [pinnedProfiles, setPinnedProfiles] = useState<PinnedProfile[]>([]);
  const [containerWidth, setContainerWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current && containerRef.current.clientWidth > 0) {
        setContainerWidth(containerRef.current.clientWidth);
      }
    };
    
    updateWidth();
    
    const observer = new ResizeObserver(() => {
      updateWidth();
    });
    
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    
    window.addEventListener('resize', updateWidth);
    return () => {
      window.removeEventListener('resize', updateWidth);
      observer.disconnect();
    };
  }, [displayData.length]);

  const fetchSectorKlineData = useCallback(async () => {
    if (!sectorCode) {
      setError('未选择板块');
      return;
    }

    setLoading(true);
    setError(null);
    setData([]);
    setDisplayData([]);
    setSelectedRange(null);

    try {
      const response = await fetch(`/sector-kline-data/${sectorCode}.json`);
      
      if (!response.ok) {
        throw new Error(`获取数据失败 (${response.status})`);
      }
      
      const result = await response.json();
      
      if (result.code === 0 && result.data && result.data.klines && result.data.klines.length > 0) {
        let klines = result.data.klines;
        
        const rangeMap: Record<string, number> = {
          '1m': 20,
          '3m': 60,
          '6m': 120,
          '1y': 250,
          '3y': 750,
          '5y': 1250,
          'all': klines.length
        };
        
        const days = rangeMap[dataRange] || klines.length;
        if (days < klines.length) {
          klines = klines.slice(-days);
        }
        
        setData(klines);
        
        const displayItems = klines.map((k: SectorKlineData) => ({
          timestamp: new Date(k.date).getTime(),
          open: k.open,
          high: k.high,
          low: k.low,
          close: k.close,
          volume: k.volume,
          amount: k.amount
        }));
        
        setDisplayData(displayItems);
      } else {
        throw new Error(result.message || '获取板块K线数据失败');
      }
    } catch (err: any) {
      setError(err.message || '获取板块筹码数据失败');
    } finally {
      setLoading(false);
    }
  }, [sectorCode, dataRange]);

  useEffect(() => {
    fetchSectorKlineData();
  }, [fetchSectorKlineData]);

  useEffect(() => {
    if (data.length > 0) {
      const rangeMap: Record<string, number> = {
        '1m': 20,
        '3m': 60,
        '6m': 120,
        '1y': 250,
        '3y': 750,
        '5y': 1250,
        'all': data.length
      };
      
      const days = rangeMap[dataRange] || data.length;
      const sliced = days < data.length ? data.slice(-days) : data;
      
      const displayItems = sliced.map((k: SectorKlineData) => ({
        timestamp: new Date(k.date).getTime(),
        open: k.open,
        high: k.high,
        low: k.low,
        close: k.close,
        volume: k.volume,
        amount: k.amount
      }));
      
      setDisplayData(displayItems);
      setSelectedRange(null);
      setPinnedProfiles([]);
    }
  }, [dataRange, data]);

  const selectedData = useMemo(() => {
    if (!selectedRange || selectedRange.startIndex === selectedRange.endIndex) {
      return displayData;
    }
    return displayData.slice(selectedRange.startIndex, selectedRange.endIndex + 1);
  }, [displayData, selectedRange]);

  const volumeProfile = useMemo(() => {
    if (selectedData.length === 0) return [];
    
    const minPrice = Math.min(...selectedData.map(d => d.low));
    const maxPrice = Math.max(...selectedData.map(d => d.high));
    const priceRange = maxPrice - minPrice;
    const levelSize = priceRange / priceLevels;

    const profile: Array<{ price: number; volume: number }> = [];

    for (let i = 0; i < priceLevels; i++) {
      const levelPrice = minPrice + i * levelSize + levelSize / 2;
      const levelLow = minPrice + i * levelSize;
      const levelHigh = minPrice + (i + 1) * levelSize;
      
      let levelVolume = 0;
      for (const candle of selectedData) {
        const candleRange = candle.high - candle.low;
        if (candleRange === 0) continue;
        
        const overlapLow = Math.max(candle.low, levelLow);
        const overlapHigh = Math.min(candle.high, levelHigh);
        const overlap = Math.max(0, overlapHigh - overlapLow);
        const ratio = overlap / candleRange;
        levelVolume += candle.volume * ratio;
      }

      profile.push({ price: levelPrice, volume: levelVolume });
    }

    return profile;
  }, [selectedData, priceLevels]);

  const volumeProfileStats = useMemo<VolumeProfileStats | null>(() => {
    if (volumeProfile.length === 0) return null;

    const totalVolume = volumeProfile.reduce((sum, p) => sum + p.volume, 0);
    const poc = volumeProfile.reduce((max, p) => p.volume > max.volume ? p : max, volumeProfile[0]);
    
    const sortedByPrice = [...volumeProfile].sort((a, b) => a.price - b.price);
    const pocIndex = sortedByPrice.findIndex(p => p.price === poc.price);
    const valueAreaVolume = totalVolume * 0.7;
    
    let upperIndex = pocIndex;
    let lowerIndex = pocIndex;
    let cumulativeVolume = poc.volume;

    while (cumulativeVolume < valueAreaVolume && (upperIndex < sortedByPrice.length - 1 || lowerIndex > 0)) {
      const upperVolume = upperIndex < sortedByPrice.length - 1 ? sortedByPrice[upperIndex + 1].volume : 0;
      const lowerVolume = lowerIndex > 0 ? sortedByPrice[lowerIndex - 1].volume : 0;

      if (upperVolume >= lowerVolume && upperIndex < sortedByPrice.length - 1) {
        upperIndex++;
        cumulativeVolume += upperVolume;
      } else if (lowerIndex > 0) {
        lowerIndex--;
        cumulativeVolume += lowerVolume;
      } else {
        break;
      }
    }

    return {
      poc: poc.price,
      vah: sortedByPrice[upperIndex].price,
      val: sortedByPrice[lowerIndex].price,
      totalVolume
    };
  }, [volumeProfile]);

  const priceRange = useMemo(() => {
    if (selectedData.length === 0) return { min: 0, max: 1 };
    const min = Math.min(...selectedData.map(d => d.low));
    const max = Math.max(...selectedData.map(d => d.high));
    return { min, max };
  }, [selectedData]);

  const priceToY = useCallback((price: number) => {
    const range = priceRange.max - priceRange.min;
    if (range === 0) return CHART_HEIGHT / 2;
    return CHART_HEIGHT - ((price - priceRange.min) / range) * CHART_HEIGHT;
  }, [priceRange]);

  const chartWidth = Math.max(0, containerWidth - PROFILE_WIDTH - 32);

  const handleRangeSelect = useCallback((range: SelectedRange | null) => {
    setSelectedRange(range);
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedRange(null);
  }, []);

  const handlePinProfile = useCallback(() => {
    if (!selectedRange || !volumeProfileStats) return;
    
    const newPinned: PinnedProfile = {
      id: `pinned-${Date.now()}`,
      color: COLORS[pinnedProfiles.length % COLORS.length],
      stats: volumeProfileStats,
      range: selectedRange
    };
    
    setPinnedProfiles(prev => [...prev, newPinned]);
    setSelectedRange(null);
  }, [selectedRange, volumeProfileStats, pinnedProfiles.length]);

  const handleUnpinProfile = useCallback((id: string) => {
    setPinnedProfiles(prev => prev.filter(p => p.id !== id));
  }, []);

  const handleClearAllPinned = useCallback(() => {
    setPinnedProfiles([]);
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200">
      <header className="bg-slate-800 border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-bold text-white">{sectorName}</h1>
              <span className="text-sm text-slate-400 font-mono">{sectorCode}</span>
              <span className="text-xs text-slate-500">共 {displayData.length} 个交易日</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex gap-1 bg-slate-700 rounded-lg p-0.5">
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
                    onClick={() => setDataRange(range.value)}
                    className={`px-3 py-1 text-sm rounded-md transition-colors ${
                      dataRange === range.value
                        ? 'bg-blue-600 text-white font-medium'
                        : 'text-slate-300 hover:bg-slate-600'
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
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-500 mx-auto mb-4"></div>
              <p className="text-slate-400 text-sm">正在加载板块筹码数据...</p>
            </div>
          </div>
        )}

        {!loading && error && (
          <div className="flex items-center justify-center py-20">
            <div className="text-center max-w-md">
              <i className="fas fa-exclamation-triangle text-4xl text-red-500 mb-4"></i>
              <p className="text-slate-300 text-sm mb-2">数据加载失败</p>
              <p className="text-slate-500 text-xs">{error}</p>
              <button
                onClick={fetchSectorKlineData}
                className="mt-4 px-4 py-2 text-xs font-medium bg-violet-600 hover:bg-violet-700 text-white rounded"
              >
                重试
              </button>
            </div>
          </div>
        )}

        {!loading && !error && displayData.length === 0 && (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <i className="fas fa-chart-bar text-4xl text-slate-600 mb-4"></i>
              <p className="text-slate-400 text-sm">暂无筹码数据</p>
            </div>
          </div>
        )}

        {!loading && !error && displayData.length > 0 && (
          <div className="space-y-6">
            <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
                <div className="flex items-center gap-4">
                  <h2 className="font-semibold text-slate-200">{sectorCode} {sectorName}</h2>
                  <span className="text-xs text-slate-500">{getTimeFrameLabel(timeFrame)}</span>
                  <span className="text-xs text-slate-500">
                    使用{displayData.length}日日线数据
                  </span>
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
                {containerWidth > 100 && displayData.length > 0 && (
                  <div className="flex">
                    <div className="flex-1">
                      <CandlestickChart
                        data={displayData}
                        width={chartWidth}
                        height={CHART_HEIGHT}
                        selectedRange={selectedRange}
                        onRangeSelect={handleRangeSelect}
                        onZoom={() => {}}
                        pinnedProfiles={pinnedProfiles}
                      />
                    </div>
                    <div className="border-l border-slate-700">
                      <VolumeProfile
                        data={selectedData}
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
                  {containerWidth > 100 && displayData.length > 0 && (
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

            <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-700">
                <h3 className="font-semibold text-slate-200 text-sm">数据统计</h3>
              </div>
              <StatsPanel
                data={displayData}
                stats={volumeProfileStats}
                selectedRange={selectedRange}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
