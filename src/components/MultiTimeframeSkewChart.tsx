import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer
} from 'recharts';
import type { VolatilityData } from '../types/stock';

interface TimeframeSkewResult {
  timeframe: string;
  label: string;
  latestSkew: number;
  isBullish: boolean;
  history: VolatilityData[];
}

interface MultiTimeframeSkewChartProps {
  data: TimeframeSkewResult[];
  calcWindow: number;
}

const TIMEFRAME_COLORS: Record<string, string> = {
  '15m': '#f59e0b',
  '60m': '#3b82f6',
  '1d': '#10b981',
  '1w': '#8b5cf6'
};

interface ChartPoint {
  date: string;
  volSkew: number;
}

const SubChart: React.FC<{ tf: TimeframeSkewResult; calcWindow: number }> = ({ tf, calcWindow }) => {
  const chartData: ChartPoint[] = useMemo(() => {
    return tf.history.map(item => ({
      date: new Date(item.timestamp).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }),
      volSkew: item.volSkew
    }));
  }, [tf.history]);

  const displayData = chartData.slice(-Math.max(calcWindow * 2, 20));

  if (displayData.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-slate-500 text-xs bg-slate-700/30 rounded-lg">
        暂无数据
      </div>
    );
  }

  const allSkews = displayData.map(d => d.volSkew);
  const maxSkew = Math.max(...allSkews);
  const minSkew = Math.min(...allSkews);

  return (
    <div className="bg-slate-700/30 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: TIMEFRAME_COLORS[tf.timeframe] }}></div>
          <span className="text-sm font-medium text-slate-200">{tf.label}</span>
        </div>
        <span className={`text-sm font-bold ${tf.isBullish ? 'text-emerald-400' : 'text-red-400'}`}>
          {tf.latestSkew.toFixed(3)}
        </span>
      </div>
      <div className="w-full h-28">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={displayData} margin={{ top: 2, right: 5, left: 5, bottom: 2 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis
              dataKey="date"
              stroke="#64748b"
              tick={{ fontSize: 9, fill: '#64748b' }}
              tickLine={false}
              tickCount={5}
            />
            <YAxis
              domain={[Math.max(0, minSkew - 0.3), maxSkew + 0.3]}
              stroke="#64748b"
              tick={{ fontSize: 9, fill: '#64748b' }}
              tickLine={false}
              tickCount={4}
              tickFormatter={(value: number) => value.toFixed(2)}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '6px',
                fontSize: '11px',
                padding: '4px 8px'
              }}
              labelStyle={{ color: '#94a3b8' }}
              formatter={(value: number) => [value.toFixed(3), '偏度比']}
            />
            <ReferenceLine y={1} stroke="#f59e0b" strokeDasharray="3 3" />
            <Line
              type="monotone"
              dataKey="volSkew"
              stroke={TIMEFRAME_COLORS[tf.timeframe]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export const MultiTimeframeSkewChart: React.FC<MultiTimeframeSkewChartProps> = ({ data, calcWindow }) => {
  const consistencyInfo = useMemo(() => {
    const coreTimeframes = ['60m', '1d', '1w'];
    const latestSkews = data.map(d => ({
      timeframe: d.timeframe,
      label: d.label,
      skew: d.latestSkew,
      isBullish: d.latestSkew >= 1
    }));

    const coreSkews = latestSkews.filter(s => coreTimeframes.includes(s.timeframe));
    const allBullish = coreSkews.every(s => s.isBullish);
    const allBearish = coreSkews.every(s => !s.isBullish);
    const isConsistent = allBullish || allBearish;

    return {
      isConsistent,
      direction: allBullish ? 'bullish' : allBearish ? 'bearish' : 'mixed',
      details: latestSkews
    };
  }, [data]);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-500 text-xs">
        暂无有效的多周期偏度数据
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className={`px-3 py-2 rounded-lg text-xs flex items-center gap-2 ${
        consistencyInfo.isConsistent
          ? consistencyInfo.direction === 'bullish'
            ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-600/30'
            : 'bg-red-600/20 text-red-400 border border-red-600/30'
          : 'bg-amber-600/20 text-amber-400 border border-amber-600/30'
      }`}>
        <i className={`fas ${
          consistencyInfo.isConsistent
            ? consistencyInfo.direction === 'bullish' ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down'
            : 'fa-code-branch'
        }`}></i>
        <span className="font-medium">
          {consistencyInfo.isConsistent
            ? consistencyInfo.direction === 'bullish'
              ? '中长周期一致看多 - 60m/日线/周线偏度比均 ≥ 1（15m仅作参考）'
              : '中长周期一致看空 - 60m/日线/周线偏度比均 < 1（15m仅作参考）'
            : '中长周期分歧 - 60m/日线/周线偏度比方向不一致（15m仅作参考）'
          }
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {data.map(tf => (
          <SubChart key={tf.timeframe} tf={tf} calcWindow={calcWindow} />
        ))}
      </div>
    </div>
  );
};
