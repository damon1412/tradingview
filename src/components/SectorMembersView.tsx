import React, { useState, useMemo, useCallback } from 'react';
import type { SectorSkewResult } from '../types/sector';
import { useNavigation } from '../NavigationContext';

interface MembersData {
  scanDate: string;
  totalBlocks: number;
  totalStocks: number;
  blocks: Record<string, Array<{
    symbol: string;
    stockName: string;
    latestClose: number;
    changePct: number;
    volSkew: number;
    upVolatility: number;
    downVolatility: number;
    volatility: number;
    blockName: string;
  }>>;
}

interface SectorMembersViewProps {
  membersData: MembersData | null;
  blockList: Array<{ symbol: string; name: string }>;
  onBlockSelect: (symbol: string) => void;
}

export const SectorMembersView: React.FC<SectorMembersViewProps> = ({ membersData, blockList, onBlockSelect }) => {
  const { navigateToVolume, navigateToSectorVolume } = useNavigation();
  const [selectedBlock, setSelectedBlock] = useState<string>('');
  const [memberFilter, setMemberFilter] = useState<'all' | 'strong'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const blockNames = useMemo(() => {
    const nameMap = new Map<string, string>();
    blockList.forEach(b => nameMap.set(b.symbol, b.name));
    return nameMap;
  }, [blockList]);

  const selectedMembers = useMemo(() => {
    if (!selectedBlock || !membersData || !membersData.blocks[selectedBlock]) return [];
    let members = membersData.blocks[selectedBlock];
    if (memberFilter === 'strong') {
      members = members.filter(m => m.volSkew >= 1);
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      members = members.filter(m => m.symbol.toLowerCase().includes(term));
    }
    return members;
  }, [selectedBlock, membersData, memberFilter, searchTerm]);

  const handleSelectBlock = useCallback((symbol: string) => {
    setSelectedBlock(symbol);
    onBlockSelect(symbol);
  }, [onBlockSelect]);

  const handleNavigateToSectorVolume = useCallback((symbol: string, name: string) => {
    navigateToSectorVolume(symbol, name);
  }, [navigateToSectorVolume]);

  if (!membersData) {
    return (
      <div className="space-y-4">
        <h3 className="text-slate-200 font-semibold text-sm">板块成员股扫描</h3>
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-8 text-center">
          <div className="text-slate-500">
            <i className="fas fa-users text-2xl text-violet-500/50 mb-3 block"></i>
            <p className="text-sm mb-1">暂无成员股数据</p>
            <p className="text-xs text-slate-600">运行 <code className="bg-slate-700 px-1 rounded">python3 scripts/scan-sector-skew.py --members</code> 生成数据</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-slate-200 font-semibold text-sm">板块成员股扫描</h3>
        <div className="text-xs text-slate-400">
          {membersData.totalBlocks} 个板块 · {membersData.totalStocks} 条成员关系 · {membersData.scanDate.slice(0, 10)}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
          <div className="px-4 py-2 border-b border-slate-700 bg-slate-700/50">
            <h4 className="text-xs text-slate-300 font-medium">选择板块</h4>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {blockList.map(block => {
              const members = membersData.blocks[block.symbol];
              const strongCount = members ? members.filter(m => m.volSkew >= 1).length : 0;
              const totalCount = members ? members.length : 0;
              return (
                <div
                  key={block.symbol}
                  className={`px-3 py-2 border-t border-slate-700/50 cursor-pointer transition-colors hover:bg-slate-700/30 ${
                    selectedBlock === block.symbol ? 'bg-slate-700/50' : ''
                  }`}
                  onClick={() => handleSelectBlock(block.symbol)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-slate-200 font-medium">{block.name}</div>
                      <div className="text-xs text-slate-500 font-mono">{block.symbol}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-slate-300">{totalCount} 只</div>
                      <div className="text-xs text-emerald-400">{strongCount} 强势</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
          <div className="px-4 py-2 border-b border-slate-700 bg-slate-700/50 flex items-center justify-between">
            <h4 className="text-xs text-slate-300 font-medium">
              成员股
              {selectedBlock && (
                <span className="ml-2 text-slate-500">({blockNames.get(selectedBlock) || selectedBlock})</span>
              )}
              <span className="ml-2 text-slate-500">({selectedMembers.length} 只)</span>
            </h4>
            <div className="flex gap-1">
              <input
                type="text"
                placeholder="搜索代码..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-slate-600 text-xs text-slate-200 px-2 py-1 rounded w-24 placeholder-slate-400"
              />
              <div className="flex gap-0.5 bg-slate-600 rounded p-0.5">
                <button
                  onClick={() => setMemberFilter('all')}
                  className={`px-2 py-0.5 text-xs rounded ${
                    memberFilter === 'all' ? 'bg-violet-600 text-white' : 'text-slate-300'
                  }`}
                >
                  全部
                </button>
                <button
                  onClick={() => setMemberFilter('strong')}
                  className={`px-2 py-0.5 text-xs rounded ${
                    memberFilter === 'strong' ? 'bg-violet-600 text-white' : 'text-slate-300'
                  }`}
                >
                  强势
                </button>
              </div>
            </div>
          </div>

          {selectedBlock && selectedMembers.length > 0 ? (
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-700/50 sticky top-0">
                  <tr>
                    <th className="px-3 py-1.5 text-left text-slate-400 font-medium">#</th>
                    <th className="px-3 py-1.5 text-left text-slate-400 font-medium">代码</th>
                    <th className="px-3 py-1.5 text-left text-slate-400 font-medium">名称</th>
                    <th className="px-3 py-1.5 text-right text-slate-400 font-medium">收盘价</th>
                    <th className="px-3 py-1.5 text-right text-slate-400 font-medium">偏度比</th>
                    <th className="px-3 py-1.5 text-right text-slate-400 font-medium">上行波动</th>
                    <th className="px-3 py-1.5 text-right text-slate-400 font-medium">下行波动</th>
                    <th className="px-3 py-1.5 text-right text-slate-400 font-medium">涨跌幅</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedMembers.map((m, idx) => (
                    <tr key={m.symbol} className="border-t border-slate-700/50 hover:bg-slate-700/30">
                      <td className="px-3 py-1.5 text-slate-500">{idx + 1}</td>
                      <td
                        className="px-3 py-1.5 text-blue-400 cursor-pointer hover:text-blue-300 hover:underline font-mono"
                        onClick={() => navigateToVolume(m.symbol, m.stockName)}
                      >
                        {m.symbol}
                      </td>
                      <td className="px-3 py-1.5 text-slate-300">{m.stockName}</td>
                      <td className="px-3 py-1.5 text-right font-mono text-slate-300">{m.latestClose.toFixed(2)}</td>
                      <td className="px-3 py-1.5 text-right">
                        <span className={`px-1 py-0.5 rounded font-bold ${
                          m.volSkew >= 1 ? 'bg-emerald-600/20 text-emerald-400' : 'bg-red-600/20 text-red-400'
                        }`}>
                          {m.volSkew.toFixed(3)}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono text-emerald-400">{m.upVolatility.toFixed(2)}%</td>
                      <td className="px-3 py-1.5 text-right font-mono text-red-400">{m.downVolatility.toFixed(2)}%</td>
                      <td className="px-3 py-1.5 text-right font-mono">
                        <span className={m.changePct >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                          {m.changePct >= 0 ? '+' : ''}{m.changePct.toFixed(2)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : selectedBlock ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              没有符合条件的成员股
            </div>
          ) : (
            <div className="p-8 text-center text-slate-500 text-xs">
              <i className="fas fa-arrow-left text-xl text-violet-500/50 mb-2 block"></i>
              请在左侧选择一个板块
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
