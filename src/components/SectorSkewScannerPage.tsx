import React, { useState, useCallback, useMemo, useEffect } from 'react';
import type { SectorSkewResult, SkewFilterMode, SkewSortKey, SectorSkewData } from '../types/sector';
import { loadSectorSkewData, loadSectorSkewHistory, loadSectorRotationData, loadSectorMembersData, loadSectorMultiCycleData, getCachedSectorSkewData } from '../services/sectorApi';
import { useNavigation } from '../NavigationContext';
import { SectorTrendChart } from './SectorTrendChart';
import { SectorRotationView } from './SectorRotationView';
import { SectorMembersView } from './SectorMembersView';
import { SectorMultiCycleView } from './SectorMultiCycleView';

const STORAGE_KEY = 'sectorSkewScannerResults';

export const SectorSkewScannerPage: React.FC = () => {
  const { navigateToVolume, navigateToSectorVolume } = useNavigation();
  const [items, setItems] = useState<SectorSkewResult[]>([]);
  const [history, setHistory] = useState<Array<{ date: string; results: SectorSkewResult[] }>>([]);
  const [rotationData, setRotationData] = useState<any>(null);
  const [membersData, setMembersData] = useState<any>(null);
  const [multiCycleData, setMultiCycleData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'list' | 'rotation' | 'members' | 'multi-cycle'>('list');
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanDate, setScanDate] = useState<string>('');
  const [totalBlocks, setTotalBlocks] = useState(0);
  const [sortBy, setSortBy] = useState<SkewSortKey>('volSkew');
  const [filterMode, setFilterMode] = useState<SkewFilterMode>('all');
  const [expandedSymbol, setExpandedSymbol] = useState<string | null>(null);
  const [showTrend, setShowTrend] = useState(false);

  const loadCachedResults = useCallback(() => {
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.results && Array.isArray(parsed.results) && parsed.results.length > 0) {
          setItems(parsed.results);
          setScanDate(parsed.scanDate || '');
          setTotalBlocks(parsed.totalBlocks || 0);
          return true;
        }
      }
    } catch { /* ignore */ }
    return false;
  }, []);

  useEffect(() => {
    handleScan();
  }, []);

  useEffect(() => {
    if (items.length > 0) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          scanDate, totalBlocks, results: items
        }));
      } catch { /* ignore */ }
    }
  }, [items, scanDate, totalBlocks]);

  const handleScan = useCallback(async () => {
    setIsScanning(true);
    setScanProgress(0);
    setExpandedSymbol(null);
    setShowTrend(false);
    setActiveTab('list');

    setScanProgress(20);
    const [data, historyData, rotationRes, membersRes, multiCycleRes] = await Promise.all([
      loadSectorSkewData(),
      loadSectorSkewHistory(),
      loadSectorRotationData(),
      loadSectorMembersData(),
      loadSectorMultiCycleData()
    ]);
    setScanProgress(80);

    if (data) {
      setItems(data.results);
      setScanDate(data.scanDate);
      setTotalBlocks(data.totalBlocks);
    } else {
      const cached = getCachedSectorSkewData();
      if (cached) {
        setItems(cached.results);
        setScanDate(cached.scanDate);
        setTotalBlocks(cached.totalBlocks);
      }
    }

    if (historyData) {
      setHistory(historyData.history);
    }

    if (rotationRes) {
      setRotationData(rotationRes);
    }

    if (membersRes) {
      setMembersData(membersRes);
    }

    if (multiCycleRes) {
      setMultiCycleData(multiCycleRes);
    }

    setScanProgress(100);
    setTimeout(() => setIsScanning(false), 300);
  }, []);

  const sortedAndFilteredItems = useMemo(() => {
    let filtered = items;
    if (filterMode === 'strong') {
      filtered = items.filter(item => item.volSkew >= 1);
    } else if (filterMode === 'weak') {
      filtered = items.filter(item => item.volSkew < 1);
    }

    return [...filtered].sort((a, b) => {
      if (sortBy === 'volSkew') return b.volSkew - a.volSkew;
      if (sortBy === 'upVolatility') return b.upVolatility - a.upVolatility;
      if (sortBy === 'downVolatility') return b.downVolatility - a.downVolatility;
      return b.changePct - a.changePct;
    });
  }, [items, sortBy, filterMode]);

  const scanCompleteCount = items.length;
  const strongCount = items.filter(i => i.volSkew >= 1).length;
  const weakCount = items.filter(i => i.volSkew < 1).length;
  const avgSkew = scanCompleteCount > 0
    ? items.reduce((sum, i) => sum + i.volSkew, 0) / scanCompleteCount
    : 0;

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch {
      return dateStr;
    }
  };

  const formatScanDate = (dateStr: string) => {
    if (!dateStr) return '未扫描';
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);
      if (diffHours < 1) return '刚刚';
      if (diffHours < 24) return `${Math.floor(diffHours)}小时前`;
      return `${Math.floor(diffHours / 24)}天前`;
    } catch {
      return dateStr;
    }
  };

  const isDataStale = useMemo(() => {
    if (!scanDate) return false;
    try {
      const d = new Date(scanDate);
      const now = new Date();
      return (now.getTime() - d.getTime()) > 24 * 60 * 60 * 1000;
    } catch {
      return false;
    }
  }, [scanDate]);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200">
      <header className="bg-slate-800 border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-violet-700 rounded-lg flex items-center justify-center">
                <i className="fas fa-layer-group text-white text-lg"></i>
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">概念板块偏度扫描器</h1>
                <p className="text-xs text-slate-400">扫描全市场概念板块波动率偏度特征</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-xs text-slate-500">上次扫描</div>
                <div className={`text-xs ${isDataStale ? 'text-amber-400' : 'text-slate-400'}`}>
                  {formatScanDate(scanDate)}
                </div>
                {isDataStale && (
                  <div className="text-xs text-amber-500">数据可能已过期</div>
                )}
              </div>

              <button
                onClick={handleScan}
                disabled={isScanning}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                  isScanning
                    ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                    : 'bg-violet-600 hover:bg-violet-500 text-white'
                }`}
              >
                {isScanning ? (
                  <>
                    <i className="fas fa-spinner fa-spin"></i>
                    加载中 {scanProgress}%
                  </>
                ) : (
                  <>
                    <i className="fas fa-bolt"></i>
                    执行扫描
                  </>
                )}
              </button>
            </div>
          </div>

          {isScanning && (
            <div className="mt-3 bg-slate-700 rounded-full h-2 overflow-hidden">
              <div
                className="bg-violet-500 h-full rounded-full transition-all duration-300"
                style={{ width: `${scanProgress}%` }}
              ></div>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setActiveTab('list')}
            className={`px-4 py-2 text-sm rounded-lg transition-colors ${
              activeTab === 'list'
                ? 'bg-violet-600 text-white font-medium'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            <i className="fas fa-list mr-2"></i>
            板块列表
          </button>
          <button
            onClick={() => setActiveTab('rotation')}
            className={`px-4 py-2 text-sm rounded-lg transition-colors ${
              activeTab === 'rotation'
                ? 'bg-violet-600 text-white font-medium'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            <i className="fas fa-exchange-alt mr-2"></i>
            轮动分析
          </button>
          <button
            onClick={() => setActiveTab('members')}
            className={`px-4 py-2 text-sm rounded-lg transition-colors ${
              activeTab === 'members'
                ? 'bg-violet-600 text-white font-medium'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            <i className="fas fa-users mr-2"></i>
            成员股
          </button>
          <button
            onClick={() => setActiveTab('multi-cycle')}
            className={`px-4 py-2 text-sm rounded-lg transition-colors ${
              activeTab === 'multi-cycle'
                ? 'bg-violet-600 text-white font-medium'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            <i className="fas fa-chart-line mr-2"></i>
            多周期
          </button>
        </div>

        {activeTab === 'list' && (
        <>
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
            <div className="text-xs text-slate-400 mb-1">概念板块总数</div>
            <div className="text-2xl font-bold text-violet-400">{totalBlocks || '—'}</div>
          </div>
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
            <div className="text-xs text-slate-400 mb-1">平均偏度比</div>
            <div className={`text-2xl font-bold ${avgSkew >= 1 ? 'text-emerald-400' : 'text-red-400'}`}>
              {scanCompleteCount > 0 ? avgSkew.toFixed(3) : '—'}
            </div>
          </div>
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
            <div className="text-xs text-slate-400 mb-1">强势板块 (≥1)</div>
            <div className="text-2xl font-bold text-emerald-400">{scanCompleteCount > 0 ? strongCount : '—'}</div>
          </div>
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
            <div className="text-xs text-slate-400 mb-1">弱势板块 (&lt;1)</div>
            <div className="text-2xl font-bold text-red-400">{scanCompleteCount > 0 ? weakCount : '—'}</div>
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
            <h2 className="font-semibold text-slate-200 text-sm">
              扫描结果
              {scanCompleteCount > 0 && (
                <span className="ml-2 text-xs text-slate-500">共 {sortedAndFilteredItems.length} 个板块</span>
              )}
            </h2>
            <div className="flex items-center gap-3">
              <div className="flex gap-1 bg-slate-700 rounded-lg p-0.5">
                {[
                  { value: 'all' as const, label: '全部' },
                  { value: 'strong' as const, label: '强势' },
                  { value: 'weak' as const, label: '弱势' },
                ].map(f => (
                  <button
                    key={f.value}
                    onClick={() => setFilterMode(f.value)}
                    className={`px-2 py-1 text-xs rounded-md transition-colors ${
                      filterMode === f.value
                        ? 'bg-violet-600 text-white font-medium'
                        : 'text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1 bg-slate-700 rounded-lg p-0.5">
                {[
                  { value: 'volSkew' as const, label: '偏度比' },
                  { value: 'upVolatility' as const, label: '上行' },
                  { value: 'downVolatility' as const, label: '下行' },
                  { value: 'changePct' as const, label: '涨跌幅' },
                ].map(s => (
                  <button
                    key={s.value}
                    onClick={() => setSortBy(s.value)}
                    className={`px-2 py-1 text-xs rounded-md transition-colors ${
                      sortBy === s.value
                        ? 'bg-violet-600 text-white font-medium'
                        : 'text-slate-300 hover:bg-slate-600'
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
                <th className="px-4 py-2 text-left text-slate-400 font-medium text-xs w-12">#</th>
                <th className="px-4 py-2 text-left text-slate-400 font-medium text-xs">板块名称</th>
                <th className="px-4 py-2 text-left text-slate-400 font-medium text-xs">板块代码</th>
                <th className="px-4 py-2 text-right text-slate-400 font-medium text-xs">收盘价</th>
                <th className="px-4 py-2 text-right text-slate-400 font-medium text-xs">偏度比</th>
                <th className="px-4 py-2 text-right text-slate-400 font-medium text-xs">上行波动率</th>
                <th className="px-4 py-2 text-right text-slate-400 font-medium text-xs">下行波动率</th>
                <th className="px-4 py-2 text-right text-slate-400 font-medium text-xs">涨跌幅</th>
                <th className="px-4 py-2 text-left text-slate-400 font-medium text-xs">状态</th>
              </tr>
            </thead>
            <tbody>
              {sortedAndFilteredItems.map((item, idx) => (
                <React.Fragment key={item.symbol}>
                  <tr
                    className={`border-t border-slate-700/50 hover:bg-slate-700/30 cursor-pointer ${
                      expandedSymbol === item.symbol ? 'bg-slate-700/50' : ''
                    }`}
                    onClick={() => setExpandedSymbol(expandedSymbol === item.symbol ? null : item.symbol)}
                  >
                    <td className="px-4 py-2 text-slate-500">{idx + 1}</td>
                    <td className="px-4 py-2 text-slate-200 font-medium cursor-pointer hover:text-blue-400" onClick={(e) => { e.stopPropagation(); navigateToSectorVolume(item.symbol, item.name); }}>{item.name}</td>
                    <td className="px-4 py-2 font-mono text-blue-400 hover:text-blue-300 hover:underline cursor-pointer" onClick={(e) => { e.stopPropagation(); navigateToSectorVolume(item.symbol, item.name); }}>{item.symbol}</td>
                    <td className="px-4 py-2 text-right font-mono">{item.latestClose.toFixed(2)}</td>
                    <td className="px-4 py-2 text-right">
                      <span className={`px-2 py-0.5 rounded font-bold text-xs ${
                        item.volSkew >= 1
                          ? 'bg-emerald-600/20 text-emerald-400'
                          : 'bg-red-600/20 text-red-400'
                      }`}>
                        {item.volSkew.toFixed(3)}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-emerald-400">{item.upVolatility.toFixed(3)}%</td>
                    <td className="px-4 py-2 text-right font-mono text-red-400">{item.downVolatility.toFixed(3)}%</td>
                    <td className="px-4 py-2 text-right font-mono">
                      <span className={item.changePct >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                        {item.changePct >= 0 ? '+' : ''}{item.changePct.toFixed(2)}%
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        item.volSkew >= 1
                          ? 'bg-emerald-600/20 text-emerald-400'
                          : 'bg-red-600/20 text-red-400'
                      }`}>
                        {item.volSkew >= 1 ? '✓ 上行主导' : '✗ 下行主导'}
                      </span>
                    </td>
                  </tr>
                  {expandedSymbol === item.symbol && (
                    <tr className="bg-slate-800/50">
                      <td colSpan={9} className="px-4 py-3">
                        <div className="flex gap-2 mb-3">
                          <button
                            onClick={(e) => { e.stopPropagation(); setShowTrend(false); }}
                            className={`px-3 py-1 text-xs rounded-md transition-colors ${
                              !showTrend
                                ? 'bg-violet-600 text-white font-medium'
                                : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                            }`}
                          >
                            波动率对比
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setShowTrend(true); }}
                            className={`px-3 py-1 text-xs rounded-md transition-colors ${
                              showTrend
                                ? 'bg-violet-600 text-white font-medium'
                                : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                            }`}
                          >
                            偏度趋势 ({history.length} 天)
                          </button>
                        </div>
                        {showTrend ? (
                          <SectorTrendChart history={history} symbol={item.symbol} name={item.name} />
                        ) : (
                          <>
                            <div className="flex items-center gap-4">
                              <div className="flex-1">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs text-emerald-400">上行波动率</span>
                                  <span className="text-xs text-slate-400">{item.upVolatility.toFixed(3)}%</span>
                                </div>
                                <div className="w-full bg-slate-600 rounded-full h-2">
                                  <div
                                    className="bg-emerald-500 h-2 rounded-full transition-all"
                                    style={{ width: `${Math.min(100, (item.upVolatility / Math.max(item.upVolatility, item.downVolatility)) * 100)}%` }}
                                  ></div>
                                </div>
                              </div>
                              <div className="text-xs text-slate-500">vs</div>
                              <div className="flex-1">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs text-red-400">下行波动率</span>
                                  <span className="text-xs text-slate-400">{item.downVolatility.toFixed(3)}%</span>
                                </div>
                                <div className="w-full bg-slate-600 rounded-full h-2">
                                  <div
                                    className="bg-red-500 h-2 rounded-full transition-all"
                                    style={{ width: `${Math.min(100, (item.downVolatility / Math.max(item.upVolatility, item.downVolatility)) * 100)}%` }}
                                  ></div>
                                </div>
                              </div>
                            </div>
                            <div className="mt-2 flex items-center gap-6 text-xs text-slate-500">
                              <span>数据日期: {item.latestDate}</span>
                              <span>偏度比 = {item.upVolatility.toFixed(2)} / {item.downVolatility.toFixed(2)} = {item.volSkew.toFixed(3)}</span>
                            </div>
                          </>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              {sortedAndFilteredItems.length === 0 && scanCompleteCount === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center">
                    <div className="text-slate-500 mb-2">
                      <i className="fas fa-bolt text-3xl text-violet-500/50 mb-3 block"></i>
                      <p className="text-sm">点击"执行扫描"按钮加载概念板块偏度数据</p>
                      <p className="text-xs text-slate-600 mt-1">需先运行 Python 脚本生成数据: python3 scripts/scan-sector-skew.py</p>
                    </div>
                  </td>
                </tr>
              )}
              {sortedAndFilteredItems.length === 0 && scanCompleteCount > 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                    没有符合条件的板块
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 bg-slate-800 rounded-lg p-4 border border-slate-700">
          <h3 className="text-slate-200 font-semibold text-sm mb-3">使用说明</h3>
          <ul className="space-y-2 text-xs text-slate-400">
            <li className="flex items-start gap-2">
              <i className="fas fa-bolt text-violet-400 mt-0.5"></i>
              <span>点击"执行扫描"加载概念板块偏度数据（数据来源于收盘后预计算的 JSON 文件）</span>
            </li>
            <li className="flex items-start gap-2">
              <i className="fas fa-filter text-violet-400 mt-0.5"></i>
              <span>使用"强势/弱势"过滤器筛选偏度比 ≥1 或 &lt;1 的板块</span>
            </li>
            <li className="flex items-start gap-2">
              <i className="fas fa-sort text-violet-400 mt-0.5"></i>
              <span>按偏度比、上行波动率、下行波动率或涨跌幅排序</span>
            </li>
            <li className="flex items-start gap-2">
              <i className="fas fa-expand text-violet-400 mt-0.5"></i>
              <span>点击板块行展开查看上下波动率对比图，点击板块代码跳转到筹码分析页</span>
            </li>
            <li className="flex items-start gap-2">
              <i className="fas fa-sync text-violet-400 mt-0.5"></i>
              <span>收盘后运行 <code className="bg-slate-700 px-1 rounded">python3 scripts/scan-sector-skew.py</code> 更新数据，再点击"执行扫描"加载最新结果</span>
            </li>
          </ul>
        </div>
        </>
        )}

        {activeTab === 'rotation' && (
          <SectorRotationView rotationData={rotationData} onNavigate={(symbol) => {
            const block = items.find(i => i.symbol === symbol);
            navigateToSectorVolume(symbol, block?.name || symbol);
          }} />
        )}

        {activeTab === 'members' && (
          <SectorMembersView
            membersData={membersData}
            blockList={items.map(item => ({ symbol: item.symbol, name: item.name }))}
            onBlockSelect={() => {}}
          />
        )}

        {activeTab === 'multi-cycle' && (
          <SectorMultiCycleView multiCycleData={multiCycleData} />
        )}
      </main>
    </div>
  );
};
