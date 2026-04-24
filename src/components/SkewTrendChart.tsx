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

interface SkewTrendChartProps {
  data: VolatilityData[];
  window: number;
}

interface ChartPoint {
  date: string;
  volSkew: number;
  upVolatility: number;
  downVolatility: number;
  timestamp: number;
}

export const SkewTrendChart: React.FC<SkewTrendChartProps> = ({ data, window }) => {
  const chartData: ChartPoint[] = useMemo(() => {
    const validData = data.filter(v => v.upVolatility > 0 && v.downVolatility > 0);
    return validData.map(v => ({
      date: new Date(v.timestamp).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }),
      volSkew: v.volSkew,
      upVolatility: v.upVolatility,
      downVolatility: v.downVolatility,
      timestamp: v.timestamp
    }));
  }, [data]);

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-500 text-xs">
        暂无有效的偏度趋势数据
      </div>
    );
  }

  const displayData = chartData.slice(-Math.max(window * 2, 30));
  const maxSkew = Math.max(...displayData.map(d => d.volSkew));
  const minSkew = Math.min(...displayData.map(d => d.volSkew));

  return (
    <div className="w-full h-48">
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
            domain={[Math.max(0, minSkew - 0.5), maxSkew + 0.5]}
            stroke="#64748b"
            tick={{ fontSize: 10, fill: '#64748b' }}
            tickLine={false}
            tickFormatter={(value: number) => value.toFixed(2)}
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
              if (name === 'volSkew') return [value.toFixed(3), '偏度比'];
              if (name === 'upVolatility') return [`${value.toFixed(2)}%`, '上行波动率'];
              if (name === 'downVolatility') return [`${value.toFixed(2)}%`, '下行波动率'];
              return [value, name];
            }}
          />
          <ReferenceLine
            y={1}
            stroke="#f59e0b"
            strokeDasharray="4 4"
            label={{ value: '分界线', position: 'right', fill: '#f59e0b', fontSize: 10 }}
          />
          <Line
            type="monotone"
            dataKey="volSkew"
            stroke="#8b5cf6"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, stroke: '#8b5cf6', strokeWidth: 2, fill: '#1e293b' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
