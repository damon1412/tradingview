import React from 'react';
import type { StockData, VolumeProfileStats } from '../types/stock';
import { formatPrice, formatVolume } from '../utils/stockData';

interface StatsPanelProps {
  data: StockData[];
  stats: VolumeProfileStats | null;
  selectedRange: { startIndex: number; endIndex: number } | null;
}

export const StatsPanel: React.FC<StatsPanelProps> = ({ data, stats, selectedRange }) => {
  const displayData = selectedRange
    ? data.slice(selectedRange.startIndex, selectedRange.endIndex + 1)
    : data;

  const priceStats = React.useMemo(() => {
    if (displayData.length === 0) return null;
    const prices = displayData.map(d => d.close);
    const volumes = displayData.map(d => d.volume);
    return {
      high: Math.max(...displayData.map(d => d.high)),
      low: Math.min(...displayData.map(d => d.low)),
      open: displayData[0].open,
      close: displayData[displayData.length - 1].close,
      totalVolume: volumes.reduce((a, b) => a + b, 0),
      avgVolume: volumes.reduce((a, b) => a + b, 0) / volumes.length,
      change: displayData[displayData.length - 1].close - displayData[0].open,
      changePercent: ((displayData[displayData.length - 1].close - displayData[0].open) / displayData[0].open) * 100
    };
  }, [displayData]);

  if (!priceStats) return null;

  return (
    <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-slate-200 font-semibold text-sm">
          {selectedRange ? '选中区间统计' : '全部数据统计'}
        </h3>
        {selectedRange && (
          <span className="text-xs text-slate-400">
            {displayData.length} 个交易日
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-700/50 rounded p-2">
          <div className="text-xs text-slate-400 mb-1">最高价</div>
          <div className="text-emerald-400 font-mono font-semibold">
            {formatPrice(priceStats.high)}
          </div>
        </div>

        <div className="bg-slate-700/50 rounded p-2">
          <div className="text-xs text-slate-400 mb-1">最低价</div>
          <div className="text-red-400 font-mono font-semibold">
            {formatPrice(priceStats.low)}
          </div>
        </div>

        <div className="bg-slate-700/50 rounded p-2">
          <div className="text-xs text-slate-400 mb-1">开盘价</div>
          <div className="text-slate-200 font-mono">
            {formatPrice(priceStats.open)}
          </div>
        </div>

        <div className="bg-slate-700/50 rounded p-2">
          <div className="text-xs text-slate-400 mb-1">收盘价</div>
          <div className="text-slate-200 font-mono">
            {formatPrice(priceStats.close)}
          </div>
        </div>

        <div className="bg-slate-700/50 rounded p-2 col-span-2">
          <div className="text-xs text-slate-400 mb-1">涨跌幅</div>
          <div className={`font-mono font-semibold ${priceStats.change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {priceStats.change >= 0 ? '+' : ''}{formatPrice(priceStats.change)} ({priceStats.changePercent >= 0 ? '+' : ''}{priceStats.changePercent.toFixed(2)}%)
          </div>
        </div>

        <div className="bg-slate-700/50 rounded p-2">
          <div className="text-xs text-slate-400 mb-1">总成交量</div>
          <div className="text-blue-400 font-mono">
            {formatVolume(priceStats.totalVolume)}
          </div>
        </div>

        <div className="bg-slate-700/50 rounded p-2">
          <div className="text-xs text-slate-400 mb-1">平均成交量</div>
          <div className="text-blue-400 font-mono">
            {formatVolume(priceStats.avgVolume)}
          </div>
        </div>
      </div>

      {stats && (
        <div className="mt-4 pt-4 border-t border-slate-700">
          <h4 className="text-slate-300 font-medium text-xs mb-3">筹码分布指标</h4>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-amber-900/30 rounded p-2 border border-amber-700/30">
              <div className="text-xs text-amber-400 mb-1">POC</div>
              <div className="text-amber-300 font-mono font-semibold text-sm">
                {formatPrice(stats.poc)}
              </div>
              <div className="text-xs text-slate-500 mt-1">最大成交价位</div>
            </div>

            <div className="bg-emerald-900/30 rounded p-2 border border-emerald-700/30">
              <div className="text-xs text-emerald-400 mb-1">VAH</div>
              <div className="text-emerald-300 font-mono font-semibold text-sm">
                {formatPrice(stats.vah)}
              </div>
              <div className="text-xs text-slate-500 mt-1">价值区高点</div>
            </div>

            <div className="bg-red-900/30 rounded p-2 border border-red-700/30">
              <div className="text-xs text-red-400 mb-1">VAL</div>
              <div className="text-red-300 font-mono font-semibold text-sm">
                {formatPrice(stats.val)}
              </div>
              <div className="text-xs text-slate-500 mt-1">价值区低点</div>
            </div>
          </div>

          <div className="mt-3 bg-slate-700/30 rounded p-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">价值区范围 (70%成交量)</span>
              <span className="text-slate-300 font-mono">
                {formatPrice(stats.val)} - {formatPrice(stats.vah)}
              </span>
            </div>
            <div className="flex justify-between text-xs mt-1">
              <span className="text-slate-400">区间总成交量</span>
              <span className="text-blue-400 font-mono">
                {formatVolume(stats.totalVolume)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
