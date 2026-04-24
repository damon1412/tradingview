import React, { useMemo, useState } from 'react';
import type { SectorSkewResult } from '../types/sector';

interface RotationData {
  date: string;
  scanTime: string;
  results: SectorSkewResult[];
  rotations: Array<{
    symbol: string;
    name: string;
    currentRank: number;
    prevRank: number;
    rankChange: number;
    trend: 'rising' | 'falling' | 'stable';
    volSkew: number;
  }>;
}

interface SectorRotationViewProps {
  rotationData: RotationData | null;
  onNavigate: (symbol: string) => void;
}

export const SectorRotationView: React.FC<SectorRotationViewProps> = ({ rotationData, onNavigate }) => {
  const [rotationFilter, setRotationFilter] = useState<'all' | 'rising' | 'falling'>('all');

  const stats = useMemo(() => {
    if (!rotationData || rotationData.rotations.length === 0) return null;
    const rotations = rotationData.rotations;
    const rising = rotations.filter(r => r.trend === 'rising');
    const falling = rotations.filter(r => r.trend === 'falling');
    const stable = rotations.filter(r => r.trend === 'stable');
    const maxRise = rising.length > 0 ? Math.max(...rising.map(r => r.rankChange)) : 0;
    const maxFall = falling.length > 0 ? Math.min(...falling.map(r => r.rankChange)) : 0;
    return { rising: rising.length, falling: falling.length, stable: stable.length, maxRise, maxFall };
  }, [rotationData]);

  const filteredRotations = useMemo(() => {
    if (!rotationData || rotationData.rotations.length === 0) return [];
    let rotations = [...rotationData.rotations];
    if (rotationFilter === 'rising') rotations = rotations.filter(r => r.trend === 'rising');
    if (rotationFilter === 'falling') rotations = rotations.filter(r => r.trend === 'falling');
    return rotations;
  }, [rotationData, rotationFilter]);

  if (!rotationData || rotationData.rotations.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-slate-200 font-semibold text-sm">板块轮动分析</h3>
        </div>
        <div className="bg-slate-900/50 rounded-lg p-8 text-center">
          <div className="text-slate-500">
            <i className="fas fa-exchange-alt text-2xl text-violet-500/50 mb-3 block"></i>
            <p className="text-sm mb-1">暂无轮动数据</p>
            <p className="text-xs text-slate-600">需要至少2天扫描数据才能生成轮动分析</p>
          </div>
        </div>
        {rotationData && rotationData.results && rotationData.results.length > 0 && (
          <div>
            <h4 className="text-xs text-slate-400 mb-2">当前排名 (基于偏度比)</h4>
            <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-700/50">
                  <tr>
                    <th className="px-3 py-2 text-left text-slate-400 font-medium text-xs w-10">#</th>
                    <th className="px-3 py-2 text-left text-slate-400 font-medium text-xs">板块</th>
                    <th className="px-3 py-2 text-right text-slate-400 font-medium text-xs">偏度比</th>
                    <th className="px-3 py-2 text-right text-slate-400 font-medium text-xs">涨跌幅</th>
                  </tr>
                </thead>
                <tbody>
                  {[...rotationData.results]
                    .sort((a, b) => b.volSkew - a.volSkew)
                    .slice(0, 20)
                    .map((item, idx) => (
                      <tr key={item.symbol} className="border-t border-slate-700/50 hover:bg-slate-700/30">
                        <td className="px-3 py-1.5 text-slate-500 text-xs">{idx + 1}</td>
                        <td
                          className="px-3 py-1.5 text-slate-200 font-medium text-xs cursor-pointer hover:text-blue-400"
                          onClick={() => onNavigate(item.symbol)}
                        >
                          {item.name}
                        </td>
                        <td className="px-3 py-1.5 text-right">
                          <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${
                            item.volSkew >= 1 ? 'bg-emerald-600/20 text-emerald-400' : 'bg-red-600/20 text-red-400'
                          }`}>
                            {item.volSkew.toFixed(3)}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono text-xs">
                          <span className={item.changePct >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                            {item.changePct >= 0 ? '+' : ''}{item.changePct.toFixed(2)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-slate-200 font-semibold text-sm">板块轮动分析</h3>
        <div className="text-xs text-slate-400">
          数据日期: {rotationData.date}
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-5 gap-3">
          <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
            <div className="text-xs text-slate-400 mb-1">排名上升</div>
            <div className="text-xl font-bold text-emerald-400">{stats.rising}</div>
          </div>
          <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
            <div className="text-xs text-slate-400 mb-1">排名下降</div>
            <div className="text-xl font-bold text-red-400">{stats.falling}</div>
          </div>
          <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
            <div className="text-xs text-slate-400 mb-1">持平</div>
            <div className="text-xl font-bold text-slate-400">{stats.stable}</div>
          </div>
          <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
            <div className="text-xs text-slate-400 mb-1">最大上升</div>
            <div className="text-xl font-bold text-emerald-400">+{stats.maxRise}</div>
          </div>
          <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
            <div className="text-xs text-slate-400 mb-1">最大下降</div>
            <div className="text-xl font-bold text-red-400">{stats.maxFall}</div>
          </div>
        </div>
      )}

      <div className="flex gap-1 bg-slate-700 rounded-lg p-0.5 w-fit">
        {[
          { value: 'all' as const, label: '全部' },
          { value: 'rising' as const, label: '上升' },
          { value: 'falling' as const, label: '下降' },
        ].map(f => (
          <button
            key={f.value}
            onClick={() => setRotationFilter(f.value)}
            className={`px-3 py-1 text-xs rounded-md transition-colors ${
              rotationFilter === f.value
                ? 'bg-violet-600 text-white font-medium'
                : 'text-slate-300 hover:bg-slate-600'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-700/50">
            <tr>
              <th className="px-3 py-2 text-left text-slate-400 font-medium text-xs">板块</th>
              <th className="px-3 py-2 text-center text-slate-400 font-medium text-xs">趋势</th>
              <th className="px-3 py-2 text-right text-slate-400 font-medium text-xs">当前排名</th>
              <th className="px-3 py-2 text-right text-slate-400 font-medium text-xs">昨日排名</th>
              <th className="px-3 py-2 text-right text-slate-400 font-medium text-xs">排名变化</th>
              <th className="px-3 py-2 text-right text-slate-400 font-medium text-xs">偏度比</th>
            </tr>
          </thead>
          <tbody>
            {filteredRotations.map((r) => (
              <tr key={r.symbol} className="border-t border-slate-700/50 hover:bg-slate-700/30">
                <td
                  className="px-3 py-2 text-slate-200 font-medium text-xs cursor-pointer hover:text-blue-400"
                  onClick={() => onNavigate(r.symbol)}
                >
                  {r.name}
                </td>
                <td className="px-3 py-2 text-center">
                  {r.trend === 'rising' && (
                    <span className="text-emerald-400 text-sm">↑</span>
                  )}
                  {r.trend === 'falling' && (
                    <span className="text-red-400 text-sm">↓</span>
                  )}
                  {r.trend === 'stable' && (
                    <span className="text-slate-400 text-sm">→</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right text-slate-300 font-mono text-xs">{r.currentRank}</td>
                <td className="px-3 py-2 text-right text-slate-500 font-mono text-xs">{r.prevRank}</td>
                <td className="px-3 py-2 text-right font-mono text-xs">
                  <span className={`font-bold ${
                    r.rankChange > 0 ? 'text-emerald-400' : r.rankChange < 0 ? 'text-red-400' : 'text-slate-400'
                  }`}>
                    {r.rankChange > 0 ? '+' : ''}{r.rankChange}
                  </span>
                </td>
                <td className="px-3 py-2 text-right">
                  <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${
                    r.volSkew >= 1 ? 'bg-emerald-600/20 text-emerald-400' : 'bg-red-600/20 text-red-400'
                  }`}>
                    {r.volSkew.toFixed(3)}
                  </span>
                </td>
              </tr>
            ))}
            {filteredRotations.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-slate-500 text-xs">
                  没有符合条件的板块
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
