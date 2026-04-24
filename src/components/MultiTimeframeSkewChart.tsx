import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Legend
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

interface ChartPoint {
  date: string;
  '15m': number | null;
  '60m': number | null;
  '1d': number | null;
  '1w': number | null;
}

const TIMEFRAME_COLORS: Record<string, string> = {
  '15m': '#f59e0b',
  '60m': '#3b82f6',
  '1d': '#10b981',
  '1w': '#8b5cf6'
};

export const MultiTimeframeSkewChart: React.FC<MultiTimeframeSkewChartProps> = ({ data, calcWindow }) => {
  const chartData: ChartPoint[] = useMemo(() => {
    const dateMap = new Map<string, ChartPoint>();

    for (const tf of data) {
      for (const item of tf.history) {
        const date = new Date(item.timestamp).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });

        if (!dateMap.has(date)) {
          dateMap.set(date, { date, '15m': null, '60m': null, '1d': null, '1w': null });
        }

        const point = dateMap.get(date)!;
        (point as any)[tf.timeframe] = item.volSkew;
      }
    }

    const points = Array.from(dateMap.values()).sort((a, b) => {
      const aMonth = parseInt(a.date.split('/')[0]);
      const aDay = parseInt(a.date.split('/')[1]);
      const bMonth = parseInt(b.date.split('/')[0]);
      const bDay = parseInt(b.date.split('/')[1]);
      return (aMonth * 100 + aDay) - (bMonth * 100 + bDay);
    });

    return points;
  }, [data]);

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
      details: latestSkews,
      coreDetails: coreSkews
    };
  }, [data]);

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-500 text-xs">
        暂无有效的多周期偏度数据
      </div>
    );
  }

  const displayData = chartData.slice(-Math.max(calcWindow * 2, 30));

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

      <div className="grid grid-cols-4 gap-2">
        {consistencyInfo.details.map(d => (
          <div key={d.timeframe} className="bg-slate-700/50 rounded-lg px-3 py-2 text-center">
            <div className="text-xs text-slate-400 mb-1">{d.label}</div>
            <div className={`text-lg font-bold ${
              d.isBullish ? 'text-emerald-400' : 'text-red-400'
            }`}>{d.skew.toFixed(3)}</div>
          </div>
        ))}
      </div>

      <div className="w-full h-56">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={displayData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis
              dataKey="date"
              stroke="#64748b"
              tick={{ fontSize: 10, fill: '#64748b' }}
              tickLine={false}
            />
            <YAxis
              stroke="#64748b"
              tick={{ fontSize: 10, fill: '#64748b' }}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '6px',
                fontSize: '12px'
              }}
              labelStyle={{ color: '#94a3b8' }}
              formatter={(value: number, name: string) => {
                const labels: Record<string, string> = {
                  '15m': '15分钟',
                  '60m': '60分钟',
                  '1d': '日线',
                  '1w': '周线'
                };
                return [value.toFixed(3), labels[name] || name];
              }}
            />
            <ReferenceLine
              y={1}
              stroke="#f59e0b"
              strokeDasharray="4 4"
            />
            <Legend
              wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
              formatter={(value: string) => {
                const labels: Record<string, string> = {
                  '15m': '15分钟',
                  '60m': '60分钟',
                  '1d': '日线',
                  '1w': '周线'
                };
                return <span style={{ color: '#cbd5e1' }}>{labels[value] || value}</span>;
              }}
            />
            {data.map(tf => (
              <Line
                key={tf.timeframe}
                type="monotone"
                dataKey={tf.timeframe}
                stroke={TIMEFRAME_COLORS[tf.timeframe]}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, stroke: TIMEFRAME_COLORS[tf.timeframe], strokeWidth: 2, fill: '#1e293b' }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
