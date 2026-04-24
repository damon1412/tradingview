import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Area, AreaChart } from 'recharts';
import type { SectorSkewResult } from '../types/sector';

interface TrendDataPoint {
  date: string;
  volSkew: number;
  upVolatility: number;
  downVolatility: number;
}

interface SectorTrendChartProps {
  history: Array<{
    date: string;
    results: Array<{
      symbol: string;
      name: string;
      volSkew: number;
      upVolatility: number;
      downVolatility: number;
      latestClose: number;
      changePct: number;
    }>;
  }>;
  symbol: string;
  name: string;
}

export const SectorTrendChart: React.FC<SectorTrendChartProps> = ({ history, symbol, name }) => {
  const chartData = useMemo(() => {
    if (!history || history.length === 0) return [];

    const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
    const sampled = sampleData(sorted);

    return sampled.map(entry => {
      const result = entry.results.find((r: SectorSkewResult) => r.symbol === symbol);
      if (!result) return null;
      return {
        date: entry.date,
        volSkew: result.volSkew,
        upVolatility: result.upVolatility,
        downVolatility: result.downVolatility,
        changePct: result.changePct,
        latestClose: result.latestClose
      };
    }).filter(Boolean) as TrendDataPoint[];
  }, [history, symbol]);

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-500 text-sm">
        暂无历史数据
      </div>
    );
  }

  const currentSkew = chartData[chartData.length - 1].volSkew;
  const avgSkew = chartData.reduce((sum, d) => sum + d.volSkew, 0) / chartData.length;
  const trend = currentSkew > avgSkew ? '上升' : '下降';

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs">
        <div className="text-slate-400">
          板块: <span className="text-slate-200 font-medium">{name}</span> ({symbol})
        </div>
        <div className="flex gap-4">
          <div className="text-slate-400">
            当前偏度: <span className={`font-bold ${currentSkew >= 1 ? 'text-emerald-400' : 'text-red-400'}`}>{currentSkew.toFixed(3)}</span>
          </div>
          <div className="text-slate-400">
            平均偏度: <span className="font-bold text-slate-300">{avgSkew.toFixed(3)}</span>
          </div>
          <div className="text-slate-400">
            趋势: <span className={`font-bold ${trend === '上升' ? 'text-emerald-400' : 'text-red-400'}`}>{trend}</span>
          </div>
        </div>
      </div>

      <div className="h-64 bg-slate-900/50 rounded-lg p-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: '#64748b' }}
              tickFormatter={(v) => v.slice(5)}
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#64748b' }}
              domain={[0, 'dataMax + 0.5']}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '6px',
                fontSize: '12px'
              }}
              formatter={(value: number, name: string) => [
                typeof value === 'number' ? value.toFixed(3) : value,
                name === 'volSkew' ? '偏度比' : name === 'upVolatility' ? '上行波动率' : '下行波动率'
              ]}
            />
            <ReferenceLine y={1} stroke="#10b981" strokeDasharray="3 3" label={{ value: '强势线', position: 'right', fill: '#10b981', fontSize: 10 }} />
            <Line
              type="monotone"
              dataKey="volSkew"
              stroke="#8b5cf6"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: '#8b5cf6' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="h-32 bg-slate-900/50 rounded-lg p-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: '#64748b' }}
              tickFormatter={(v) => v.slice(5)}
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#64748b' }}
              domain={[0, 'dataMax + 0.5']}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '6px',
                fontSize: '12px'
              }}
            />
            <Area type="monotone" dataKey="upVolatility" stackId="1" stroke="#10b981" fill="#10b981" fillOpacity={0.3} name="上行波动率" />
            <Area type="monotone" dataKey="downVolatility" stackId="1" stroke="#ef4444" fill="#ef4444" fillOpacity={0.3} name="下行波动率" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

function sampleData(data: any[], maxPoints = 60) {
  if (data.length <= maxPoints) return data;
  const step = Math.ceil(data.length / maxPoints);
  const sampled = [];
  for (let i = 0; i < data.length; i += step) {
    sampled.push(data[i]);
  }
  if (sampled[sampled.length - 1] !== data[data.length - 1]) {
    sampled.push(data[data.length - 1]);
  }
  return sampled;
}
