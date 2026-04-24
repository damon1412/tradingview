import React, { useMemo, useState } from 'react';
import type { SectorSkewResult } from '../types/sector';
import { useNavigation } from '../NavigationContext';

interface MultiCycleBlock {
  symbol: string;
  name: string;
  day: any;
  week: any;
  month: any;
}

interface MultiCycleData {
  scanDate: string;
  blocks: MultiCycleBlock[];
}

interface SectorMultiCycleViewProps {
  multiCycleData: MultiCycleData | null;
}

export const SectorMultiCycleView: React.FC<SectorMultiCycleViewProps> = ({ multiCycleData }) => {
  const { navigateToVolume, navigateToSectorVolume } = useNavigation();
  const [signalFilter, setSignalFilter] = useState<'all' | '3strong' | '2strong' | '1strong' | 'weak'>('all');

  const processedBlocks = useMemo(() => {
    if (!multiCycleData || !multiCycleData.blocks) return [];

    return multiCycleData.blocks.map(block => {
      const daySkew = block.day?.volSkew || 0;
      const weekSkew = block.week?.volSkew || 0;
      const monthSkew = block.month?.volSkew || 0;

      const dayStrong = daySkew >= 1;
      const weekStrong = weekSkew >= 1;
      const monthStrong = monthSkew >= 1;

      const strongCount = [dayStrong, weekStrong, monthStrong].filter(Boolean).length;

      let signal: '3strong' | '2strong' | '1strong' | 'weak';
      if (strongCount === 3) signal = '3strong';
      else if (strongCount === 2) signal = '2strong';
      else if (strongCount === 1) signal = '1strong';
      else signal = 'weak';

      return {
        ...block,
        daySkew,
        weekSkew,
        monthSkew,
        dayStrong,
        weekStrong,
        monthStrong,
        strongCount,
        signal
      };
    });
  }, [multiCycleData]);

  const filteredBlocks = useMemo(() => {
    if (signalFilter === 'all') return processedBlocks;
    return processedBlocks.filter(b => b.signal === signalFilter);
  }, [processedBlocks, signalFilter]);

  const stats = useMemo(() => {
    const all = processedBlocks;
    return {
      total: all.length,
      '3strong': all.filter(b => b.signal === '3strong').length,
      '2strong': all.filter(b => b.signal === '2strong').length,
      '1strong': all.filter(b => b.signal === '1strong').length,
      'weak': all.filter(b => b.signal === 'weak').length,
    };
  }, [processedBlocks]);

  const signalLabel = (signal: string) => {
    switch (signal) {
      case '3strong': return '🔥🔥🔥 三周期强势';
      case '2strong': return '🔥🔥 双周期强势';
      case '1strong': return '🔥 短线强势';
      case 'weak': return '❄️ 弱势';
      default: return '';
    }
  };

  if (!multiCycleData || !multiCycleData.blocks) {
    return (
      <div className="space-y-4">
        <h3 className="text-slate-200 font-semibold text-sm">多周期偏度对比</h3>
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-8 text-center">
          <div className="text-slate-500">
            <i className="fas fa-chart-line text-2xl text-violet-500/50 mb-3 block"></i>
            <p className="text-sm mb-1">暂无多周期数据</p>
            <p className="text-xs text-slate-600">运行 <code className="bg-slate-700 px-1 rounded">python3 scripts/scan-sector-skew.py --multi-cycle</code> 生成数据</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-slate-200 font-semibold text-sm">多周期偏度对比</h3>
        <div className="text-xs text-slate-400">
          {multiCycleData.scanDate.slice(0, 10)}
        </div>
      </div>

      <div className="grid grid-cols-5 gap-3">
        <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
          <div className="text-xs text-slate-400 mb-1">总板块</div>
          <div className="text-xl font-bold text-violet-400">{stats.total}</div>
        </div>
        <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
          <div className="text-xs text-slate-400 mb-1">三周期强势</div>
          <div className="text-xl font-bold text-emerald-400">{stats['3strong']}</div>
        </div>
        <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
          <div className="text-xs text-slate-400 mb-1">双周期强势</div>
          <div className="text-xl font-bold text-blue-400">{stats['2strong']}</div>
        </div>
        <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
          <div className="text-xs text-slate-400 mb-1">单周期强势</div>
          <div className="text-xl font-bold text-amber-400">{stats['1strong']}</div>
        </div>
        <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
          <div className="text-xs text-slate-400 mb-1">弱势</div>
          <div className="text-xl font-bold text-red-400">{stats['weak']}</div>
        </div>
      </div>

      <div className="flex gap-1 bg-slate-700 rounded-lg p-0.5 w-fit">
        {[
          { value: 'all' as const, label: '全部' },
          { value: '3strong' as const, label: '🔥🔥🔥 三强' },
          { value: '2strong' as const, label: '🔥🔥 双强' },
          { value: '1strong' as const, label: '🔥 单强' },
          { value: 'weak' as const, label: '❄️ 弱势' },
        ].map(f => (
          <button
            key={f.value}
            onClick={() => setSignalFilter(f.value)}
            className={`px-3 py-1 text-xs rounded-md transition-colors ${
              signalFilter === f.value
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
              <th className="px-3 py-2 text-left text-slate-400 font-medium text-xs w-10">#</th>
              <th className="px-3 py-2 text-left text-slate-400 font-medium text-xs">板块名称</th>
              <th className="px-3 py-2 text-center text-slate-400 font-medium text-xs">信号</th>
              <th className="px-3 py-2 text-right text-slate-400 font-medium text-xs">日线偏度</th>
              <th className="px-3 py-2 text-right text-slate-400 font-medium text-xs">周线偏度</th>
              <th className="px-3 py-2 text-right text-slate-400 font-medium text-xs">月线偏度</th>
            </tr>
          </thead>
          <tbody>
            {filteredBlocks.sort((a, b) => {
              const order = { '3strong': 0, '2strong': 1, '1strong': 2, 'weak': 3 };
              if (order[a.signal] !== order[b.signal]) return order[a.signal] - order[b.signal];
              return b.daySkew - a.daySkew;
            }).map((block, idx) => (
              <tr key={block.symbol} className="border-t border-slate-700/50 hover:bg-slate-700/30">
                <td className="px-3 py-1.5 text-slate-500 text-xs">{idx + 1}</td>
                <td
                  className="px-3 py-1.5 text-slate-200 font-medium text-xs cursor-pointer hover:text-blue-400"
                  onClick={() => navigateToSectorVolume(block.symbol, block.name)}
                >
                  {block.name}
                </td>
                <td className="px-3 py-1.5 text-center text-xs">
                  <span className={`px-1.5 py-0.5 rounded ${
                    block.signal === '3strong' ? 'bg-emerald-600/20 text-emerald-400 font-bold' :
                    block.signal === '2strong' ? 'bg-blue-600/20 text-blue-400 font-bold' :
                    block.signal === '1strong' ? 'bg-amber-600/20 text-amber-400 font-bold' :
                    'bg-red-600/20 text-red-400 font-bold'
                  }`}>
                    {signalLabel(block.signal)}
                  </span>
                </td>
                <td className="px-3 py-1.5 text-right">
                  <span className={`font-mono text-xs ${
                    block.dayStrong ? 'text-emerald-400' : 'text-red-400'
                  }`}>
                    {block.daySkew > 0 ? block.daySkew.toFixed(3) : '—'}
                  </span>
                </td>
                <td className="px-3 py-1.5 text-right">
                  <span className={`font-mono text-xs ${
                    block.weekStrong ? 'text-emerald-400' : 'text-red-400'
                  }`}>
                    {block.weekSkew > 0 ? block.weekSkew.toFixed(3) : '—'}
                  </span>
                </td>
                <td className="px-3 py-1.5 text-right">
                  <span className={`font-mono text-xs ${
                    block.monthStrong ? 'text-emerald-400' : 'text-red-400'
                  }`}>
                    {block.monthSkew > 0 ? block.monthSkew.toFixed(3) : '—'}
                  </span>
                </td>
              </tr>
            ))}
            {filteredBlocks.length === 0 && (
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
