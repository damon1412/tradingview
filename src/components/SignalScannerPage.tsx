import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { getKlineData, convertKlineToStockData } from '../services/stockApi';
import { analyzeVolatilitySkew, generateTradingSignal } from '../utils/stockData';
import type { TradingSignalResult, TradingSignal, VolatilitySkewAnalysis, VolatilityLevel, SkewDriverType, WatchlistItem } from '../types/stock';
import { useNavigation } from '../NavigationContext';
import { LOCAL_INDEX_LIST } from '../config/indices';

interface ScannerTarget {
  code: string;
  name: string;
}

type ScanScope = 'watchlist' | 'sector' | 'index';
type ScanSortBy = 'score' | 'skew' | 'volRatio';
type ScanFilter = 'all' | 'bullish' | 'neutral' | 'bearish';

interface ScanResult {
  code: string;
  name: string;
  analysis: VolatilitySkewAnalysis | null;
  signalResult: TradingSignalResult | null;
  status: 'pending' | 'loading' | 'done' | 'error';
}

const SIGNAL_BADGE_COLORS: Record<TradingSignal, string> = {
  '强势做多': 'bg-emerald-600/30 text-emerald-400 border-emerald-600/40',
  '偏多，可持仓': 'bg-green-600/30 text-green-400 border-green-600/40',
  '中性，观望': 'bg-slate-600/30 text-slate-400 border-slate-600/40',
  '偏空，减仓': 'bg-orange-600/30 text-orange-400 border-orange-600/40',
  '强势做空': 'bg-red-600/30 text-red-400 border-red-600/40'
};

const DRIVER_COLORS: Record<SkewDriverType, string> = {
  '多头进攻型': 'text-emerald-400',
  '波动放大型': 'text-purple-400',
  '波动收缩型': 'text-blue-400',
  '空头进攻型': 'text-red-400',
  '无明显驱动特征': 'text-slate-400'
};

const VOL_LEVEL_COLORS: Record<VolatilityLevel, string> = {
  '极度压缩': 'text-blue-400',
  '低于均值': 'text-cyan-400',
  '正常水平': 'text-slate-400',
  '偏高': 'text-orange-400',
  '极端放大': 'text-red-400'
};

export const SignalScannerPage: React.FC = () => {
  const { navigateToVolume } = useNavigation();
  const [scope, setScope] = useState<ScanScope>('watchlist');
  const [scanCount, setScanCount] = useState(10);
  const [window, setWindow] = useState(60);
  const [sortBy, setSortBy] = useState<ScanSortBy>('score');
  const [filter, setFilter] = useState<ScanFilter>('all');
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [results, setResults] = useState<ScanResult[]>([]);
  const [expandedCode, setExpandedCode] = useState<string | null>(null);
  const [watchlist, setWatchlist] = useState<ScannerTarget[]>([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('watchlist');
      if (saved) {
        const parsed: WatchlistItem[] = JSON.parse(saved);
        const uniqueCodes = [...new Set(parsed.map(item => item.code))];
        const targets: ScannerTarget[] = uniqueCodes.map(code => {
          const item = parsed.find(i => i.code === code);
          return { code, name: item?.name || code };
        });
        if (targets.length > 0) {
          setWatchlist(targets);
          return;
        }
      }
    } catch { /* ignore */ }
    setWatchlist(LOCAL_INDEX_LIST.slice(0, 10).map(item => ({ code: item.code, name: item.name })));
  }, []);

  const sectorIndices: ScannerTarget[] = useMemo(() => {
    return LOCAL_INDEX_LIST.map(item => ({ code: item.code, name: item.name }));
  }, []);

  const mainIndices: ScannerTarget[] = useMemo(() => {
    return LOCAL_INDEX_LIST.filter(item => item.code.startsWith('sh000') || item.code.startsWith('sz399')).map(item => ({ code: item.code, name: item.name }));
  }, []);

  const targets: ScannerTarget[] = useMemo(() => {
    const list = scope === 'watchlist' ? watchlist : scope === 'sector' ? sectorIndices : mainIndices;
    return list.slice(0, scanCount);
  }, [scope, scanCount, watchlist, sectorIndices, mainIndices]);

  useEffect(() => {
    setResults(prev => {
      const codes = new Set(targets.map(t => t.code));
      const kept = prev.filter(r => codes.has(r.code));
      const added = targets.filter(t => !prev.find(r => r.code === t.code));
      return [
        ...kept,
        ...added.map(t => ({
          code: t.code,
          name: t.name,
          analysis: null,
          signalResult: null,
          status: 'pending' as const
        }))
      ];
    });
  }, [targets]);

  const scanSingle = useCallback(async (target: ScannerTarget) => {
    const result = await getKlineData(target.code, 'day');
    if (result.error || !result.data) return { target, analysis: null, signalResult: null };
    const stockData = convertKlineToStockData(result.data.List);
    const analysis = analyzeVolatilitySkew(stockData, window, 0.05);
    if (!analysis) return { target, analysis: null, signalResult: null };
    const signal = generateTradingSignal(analysis);
    return { target, analysis, signalResult: signal };
  }, [window]);

  const startScan = useCallback(async () => {
    setIsScanning(true);
    setScanProgress(0);
    setExpandedCode(null);
    setResults(prev => prev.map(r => ({ ...r, status: 'pending' as const, analysis: null, signalResult: null })));

    const total = targets.length;
    for (let i = 0; i < total; i++) {
      const t = targets[i];
      setResults(prev => prev.map(r => r.code === t.code ? { ...r, status: 'loading' as const } : r));
      const { target, analysis, signalResult } = await scanSingle(t);
      setResults(prev => prev.map(r =>
        r.code === target.code ? {
          ...r,
          status: analysis ? 'done' as const : 'error' as const,
          analysis,
          signalResult
        } : r
      ));
      setScanProgress(Math.round(((i + 1) / total) * 100));
    }
    setIsScanning(false);
  }, [targets, scanSingle]);

  const sortedAndFiltered = useMemo(() => {
    let items = results.filter(r => r.status === 'done' && r.signalResult);
    if (filter === 'bullish') {
      items = items.filter(r => r.signalResult!.score > 0);
    } else if (filter === 'bearish') {
      items = items.filter(r => r.signalResult!.score < 0);
    } else if (filter === 'neutral') {
      items = items.filter(r => r.signalResult!.score === 0);
    }
    return [...items].sort((a, b) => {
      const sa = a.signalResult!, sb = b.signalResult!;
      if (sortBy === 'score') return sb.score - sa.score;
      if (sortBy === 'skew') return b.analysis!.currentSkew - a.analysis!.currentSkew;
      if (sortBy === 'volRatio') return b.analysis!.volRatio - a.analysis!.volRatio;
      return 0;
    });
  }, [results, sortBy, filter]);

  const doneCount = results.filter(r => r.status === 'done').length;
  const bullishCount = results.filter(r => r.status === 'done' && r.signalResult && r.signalResult.score > 0).length;
  const bearishCount = results.filter(r => r.status === 'done' && r.signalResult && r.signalResult.score < 0).length;
  const neutralCount = results.filter(r => r.status === 'done' && r.signalResult && r.signalResult.score === 0).length;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200">
      <header className="bg-slate-800 border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-700 rounded-lg flex items-center justify-center">
                <i className="fas fa-chart-line text-white text-lg"></i>
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">信号扫描器</h1>
                <p className="text-xs text-slate-400">基于六层偏度分析框架的综合信号扫描</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex gap-1 bg-slate-700 rounded-lg p-0.5">
                {([
                  { value: 'watchlist' as const, label: '自选股' },
                  { value: 'sector' as const, label: '板块指数' },
                  { value: 'index' as const, label: '主要指数' },
                ]).map(s => (
                  <button
                    key={s.value}
                    onClick={() => setScope(s.value)}
                    className={`px-2 py-1 text-xs rounded-md transition-colors ${
                      scope === s.value ? 'bg-cyan-600 text-white font-medium' : 'text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">窗口:</span>
                <input
                  type="number"
                  value={window}
                  onChange={(e) => setWindow(Math.max(10, Math.min(120, parseInt(e.target.value) || 60)))}
                  className="bg-slate-700 text-slate-200 text-sm px-2 py-1 rounded border border-slate-600 w-14 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  min={10}
                  max={120}
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">数量:</span>
                <input
                  type="number"
                  value={scanCount}
                  onChange={(e) => {
                    const max = scope === 'watchlist' ? watchlist.length : scope === 'sector' ? sectorIndices.length : mainIndices.length;
                    setScanCount(Math.max(3, Math.min(max || 20, parseInt(e.target.value) || 10)));
                  }}
                  className="bg-slate-700 text-slate-200 text-sm px-2 py-1 rounded border border-slate-600 w-14 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  min={3}
                  max={20}
                />
              </div>
              <button
                onClick={startScan}
                disabled={isScanning || targets.length === 0}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                  isScanning || targets.length === 0 ? 'bg-slate-600 text-slate-400 cursor-not-allowed' : 'bg-cyan-600 hover:bg-cyan-500 text-white'
                }`}
              >
                {isScanning ? (
                  <><i className="fas fa-spinner fa-spin"></i> {scanProgress}%</>
                ) : (
                  <><i className="fas fa-play"></i> 开始扫描</>
                )}
              </button>
            </div>
          </div>
          {isScanning && (
            <div className="mt-3 bg-slate-700 rounded-full h-2 overflow-hidden">
              <div className="bg-cyan-500 h-full rounded-full transition-all duration-300" style={{ width: `${scanProgress}%` }}></div>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
            <div className="text-xs text-slate-400 mb-1">已扫描</div>
            <div className="text-2xl font-bold text-blue-400">{doneCount} <span className="text-sm text-slate-500">/ {targets.length}</span></div>
          </div>
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
            <div className="text-xs text-slate-400 mb-1">偏多信号</div>
            <div className="text-2xl font-bold text-emerald-400">{bullishCount}</div>
          </div>
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
            <div className="text-xs text-slate-400 mb-1">中性观望</div>
            <div className="text-2xl font-bold text-slate-400">{neutralCount}</div>
          </div>
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
            <div className="text-xs text-slate-400 mb-1">偏空信号</div>
            <div className="text-2xl font-bold text-red-400">{bearishCount}</div>
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
            <h2 className="font-semibold text-slate-200 text-sm">扫描结果</h2>
            <div className="flex items-center gap-3">
              <div className="flex gap-1 bg-slate-700 rounded-lg p-0.5">
                {([
                  { value: 'all' as const, label: '全部' },
                  { value: 'bullish' as const, label: '偏多' },
                  { value: 'neutral' as const, label: '中性' },
                  { value: 'bearish' as const, label: '偏空' },
                ]).map(f => (
                  <button
                    key={f.value}
                    onClick={() => setFilter(f.value)}
                    className={`px-2 py-1 text-xs rounded-md transition-colors ${
                      filter === f.value ? 'bg-cyan-600 text-white font-medium' : 'text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <div className="flex gap-1 bg-slate-700 rounded-lg p-0.5">
                {([
                  { value: 'score' as const, label: '评分' },
                  { value: 'skew' as const, label: '偏度' },
                  { value: 'volRatio' as const, label: '量比' },
                ]).map(s => (
                  <button
                    key={s.value}
                    onClick={() => setSortBy(s.value)}
                    className={`px-2 py-1 text-xs rounded-md transition-colors ${
                      sortBy === s.value ? 'bg-cyan-600 text-white font-medium' : 'text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <table className="w-full text-sm">
            <thead className="bg-slate-700/50">
              <tr>
                <th className="px-4 py-2 text-left text-slate-400 font-medium text-xs">#</th>
                <th className="px-4 py-2 text-left text-slate-400 font-medium text-xs">代码</th>
                <th className="px-4 py-2 text-left text-slate-400 font-medium text-xs">名称</th>
                <th className="px-4 py-2 text-center text-slate-400 font-medium text-xs">信号</th>
                <th className="px-4 py-2 text-right text-slate-400 font-medium text-xs">评分</th>
                <th className="px-4 py-2 text-right text-slate-400 font-medium text-xs">偏度比</th>
                <th className="px-4 py-2 text-left text-slate-400 font-medium text-xs">偏度方向</th>
                <th className="px-4 py-2 text-left text-slate-400 font-medium text-xs">驱动类型</th>
                <th className="px-4 py-2 text-right text-slate-400 font-medium text-xs">量比</th>
                <th className="px-4 py-2 text-left text-slate-400 font-medium text-xs">量价确认</th>
              </tr>
            </thead>
            <tbody>
              {sortedAndFiltered.map((item, idx) => {
                const a = item.analysis!;
                const s = item.signalResult!;
                const isExpanded = expandedCode === item.code;
                return (
                  <React.Fragment key={item.code}>
                    <tr
                      className={`border-t border-slate-700/50 hover:bg-slate-700/30 cursor-pointer ${isExpanded ? 'bg-slate-700/50' : ''}`}
                      onClick={() => setExpandedCode(isExpanded ? null : item.code)}
                    >
                      <td className="px-4 py-2 text-slate-500">{idx + 1}</td>
                      <td className="px-4 py-2 font-mono text-blue-400 hover:text-blue-300 hover:underline cursor-pointer" onClick={(e) => { e.stopPropagation(); navigateToVolume(item.code, item.name); }}>{item.code}</td>
                      <td className="px-4 py-2 text-slate-300">{item.name}</td>
                      <td className="px-4 py-2 text-center">
                        <span className={`px-2 py-0.5 rounded border text-xs font-medium ${SIGNAL_BADGE_COLORS[s.signal]}`}>
                          {s.signal}
                        </span>
                      </td>
                      <td className={`px-4 py-2 text-right font-mono font-semibold ${s.score > 0 ? 'text-emerald-400' : s.score < 0 ? 'text-red-400' : 'text-slate-400'}`}>
                        {s.score > 0 ? '+' : ''}{s.score}
                      </td>
                      <td className="px-4 py-2 text-right font-mono">
                        <span className={`px-1.5 py-0.5 rounded ${a.currentSkew >= 1 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {a.currentSkew.toFixed(3)}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <span className={`text-xs ${a.skewDirection === '上行主导' ? 'text-emerald-400' : a.skewDirection === '下行主导' ? 'text-red-400' : 'text-slate-400'}`}>
                          {a.skewDirection}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <span className={`text-xs ${DRIVER_COLORS[a.driverType]}`}>
                          {a.driverType}
                        </span>
                      </td>
                      <td className={`px-4 py-2 text-right font-mono text-xs ${VOL_LEVEL_COLORS[a.volLevel]}`}>
                        {a.volumeRatio.toFixed(2)}
                      </td>
                      <td className="px-4 py-2">
                        <span className="text-xs text-slate-300">{a.volumeConfirmation}</span>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-slate-800/50">
                        <td colSpan={10} className="px-4 py-3">
                          <div className="grid grid-cols-3 gap-4 text-xs">
                            <div>
                              <div className="text-slate-400 mb-1">波动率水平</div>
                              <div className={`font-medium ${VOL_LEVEL_COLORS[a.volLevel]}`}>{a.volLevel}</div>
                              <div className="text-slate-500 mt-0.5">当前: {(a.currentVolatility * 100).toFixed(2)}% / 均值: {(a.meanVolatility * 100).toFixed(2)}%</div>
                            </div>
                            <div>
                              <div className="text-slate-400 mb-1">偏度偏离度</div>
                              <div className="text-slate-200 font-mono">{(a.skewDeviation * 100).toFixed(1)}%</div>
                              <div className="text-slate-500 mt-0.5">当前偏度: {a.currentSkew.toFixed(3)} / 历史均值: {a.meanSkew.toFixed(3)}</div>
                            </div>
                            <div>
                              <div className="text-slate-400 mb-1">上下行偏离</div>
                              <div className="text-emerald-400">上行: {(a.upVolDeviation * 100).toFixed(1)}%</div>
                              <div className="text-red-400">下行: {(a.downVolDeviation * 100).toFixed(1)}%</div>
                            </div>
                            {s.coverageReason && (
                              <div className="col-span-3">
                                <div className="bg-amber-900/20 border border-amber-700/30 rounded p-2">
                                  <span className="text-amber-400 font-medium">警告: </span>
                                  <span className="text-amber-200/80">{s.coverageReason}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              {sortedAndFiltered.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-slate-500">
                    {doneCount === 0 ? '选择扫描范围后点击"开始扫描"' : '没有符合条件的结果'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 bg-slate-800 rounded-lg p-4 border border-slate-700">
          <h3 className="text-slate-200 font-semibold text-sm mb-3">使用说明</h3>
          <ul className="space-y-2 text-xs text-slate-400">
            <li className="flex items-start gap-2"><i className="fas fa-bullseye text-cyan-400 mt-0.5"></i><span>支持自选股、板块指数、主要指数三种扫描范围</span></li>
            <li className="flex items-start gap-2"><i className="fas fa-chart-pie text-cyan-400 mt-0.5"></i><span>使用六层偏度分析框架计算综合信号（评分-3~+5）</span></li>
            <li className="flex items-start gap-2"><i className="fas fa-filter text-cyan-400 mt-0.5"></i><span>可按偏多/中性/偏空过滤，按评分/偏度/量比排序</span></li>
            <li className="flex items-start gap-2"><i className="fas fa-expand text-cyan-400 mt-0.5"></i><span>点击行展开查看完整分析明细，点击代码跳转到筹码分析页</span></li>
          </ul>
        </div>
      </main>
    </div>
  );
};
