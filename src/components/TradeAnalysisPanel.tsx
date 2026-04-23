import React, { useState, useEffect, useRef } from 'react';
import { TradeTrendChart } from './TradeTrendChart';
import { TradeIndicatorChart } from './TradeIndicatorChart';
import { getSinaTickData, getQuote, getTodayTradeData, getMinuteData, MinuteData } from '../services/stockApi';
import { convertTradeTickData, calculateTradeIndicators, generateSimulatedTicks } from '../utils/tradeData';
import type { TradeTick, TradeIndicatorData, PinnedProfile } from '../types/stock';

interface TradeAnalysisPanelProps {
  stockCode: string;
  pinnedProfiles?: PinnedProfile[];
}

export const TradeAnalysisPanel: React.FC<TradeAnalysisPanelProps> = ({ stockCode, pinnedProfiles = [] }) => {
  const [tradeTicks, setTradeTicks] = useState<TradeTick[]>([]);
  const [indicatorData, setIndicatorData] = useState<TradeIndicatorData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdateTime, setLastUpdateTime] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<'tick' | 'minute' | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState(0);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    setDataSource(null);
    
    try {
      const { data: quoteData, error: quoteError } = await getQuote(stockCode);
      if (quoteError) {
        setError('获取行情数据失败');
        return;
      }
      const previousClose = quoteData?.Last || 0;
      
      let tradeData = null;
      let tradeError = null;
      
      const { data: tdxData, error: tdxError } = await getTodayTradeData(stockCode);
      if (tdxData && tdxData.length > 0 && previousClose > 0) {
        const tdxPriceRaw = tdxData[0].Price;
        const tdxPriceInCloseUnit = tdxPriceRaw > 1000 ? tdxPriceRaw : tdxPriceRaw * 1000;
        const priceDiff = Math.abs(tdxPriceInCloseUnit - previousClose) / previousClose;
        if (priceDiff < 0.1) {
          tradeData = tdxData;
          setDataSource('tick');
        }
      }
      if (!tradeData) {
        const { data: sinaData, error: sinaError } = await getSinaTickData(stockCode, 1000);
        if (sinaData && sinaData.length > 0) {
          tradeData = sinaData;
          setDataSource('tick');
        } else {
          tradeError = sinaError;
        }
      }
      
      let ticks: TradeTick[] = [];
      if (tradeData && tradeData.length > 0) {
        ticks = convertTradeTickData(tradeData, previousClose);
      } else {
        const { data: minuteResult } = await getMinuteData(stockCode);
        if (minuteResult && minuteResult.list.length > 0 && previousClose > 0) {
          ticks = generateSimulatedTicks(minuteResult.list, previousClose);
          setDataSource('minute');
        } else {
          setError('该标的无逐笔和分时数据');
          return;
        }
      }
      
      if (ticks.length > 0) {
        setTradeTicks(ticks);
        
        const indicators = calculateTradeIndicators(ticks);
        setIndicatorData(indicators);
        
        setLastUpdateTime(new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      } else {
        setError('今日无数据');
        setTradeTicks([]);
      }
    } catch (err) {
      setError('加载数据失败');
      console.error('加载逐笔数据失败:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!stockCode) return;
    fetchData();
  }, [stockCode]);

  const handleRefresh = () => {
    fetchData();
  };

  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setChartWidth(containerRef.current.clientWidth);
      }
    };
    
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  if (isLoading) {
    return (
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-8">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
          <span className="ml-3 text-slate-400">加载逐笔数据...</span>
        </div>
      </div>
    );
  }

  if (error && tradeTicks.length === 0) {
    return (
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-8">
        <div className="text-center text-slate-500">
          <i className="fas fa-exclamation-circle text-3xl mb-3"></i>
          <p>{error}</p>
          <p className="text-sm mt-2">请在交易日查看逐笔数据</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
        <h2 className="font-semibold text-slate-200 flex items-center gap-2">
          <i className="fas fa-chart-line text-purple-500"></i>
          {dataSource === 'minute' ? '分时交易分析（模拟逐笔）' : '逐笔交易分析'}
        </h2>
        <div className="flex items-center gap-3">
          {lastUpdateTime && (
            <span className="text-xs text-slate-500">
              更新于 {lastUpdateTime}
            </span>
          )}
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="flex items-center gap-1 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-600 text-white text-xs px-3 py-1.5 rounded transition-colors"
          >
            <i className={`fas fa-sync-alt text-xs ${isLoading ? 'animate-spin' : ''}`}></i>
            {isLoading ? '更新中...' : '更新'}
          </button>
        </div>
      </div>
      
      <div className="p-4 space-y-4">
        {tradeTicks.length > 0 && (
          <>
            <div className="bg-slate-900/50 rounded-lg p-3">
              <h3 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
                <i className="fas fa-wave-square text-blue-500"></i>
                逐笔价格走势图
              </h3>
              <TradeTrendChart
                data={tradeTicks}
                width={chartWidth}
                height={200}
                pinnedProfiles={pinnedProfiles}
                onHoverIndexChange={setHoverIndex}
                hoverIndex={hoverIndex}
              />
            </div>

            <div className="bg-slate-900/50 rounded-lg p-3">
              <h3 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
                <i className="fas fa-chart-area text-green-500"></i>
                累计买卖/加速度指标
              </h3>
              {indicatorData && (
                <TradeIndicatorChart
                  data={indicatorData}
                  width={chartWidth}
                  height={180}
                  onHoverIndexChange={setHoverIndex}
                  hoverIndex={hoverIndex}
                />
              )}
            </div>

            <div className="flex items-center gap-4 text-xs text-slate-400 border-t border-slate-700 pt-3">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-emerald-500 rounded-sm"></span>
                <span>买入</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-red-500 rounded-sm"></span>
                <span>卖出</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-slate-500 rounded-sm"></span>
                <span>中性</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
