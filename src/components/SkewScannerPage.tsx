import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { calculateVolatility } from '../utils/stockData';
import { getKlineData, convertKlineToStockData } from '../services/stockApi';
import type { StockData } from '../types/stock';
import { useNavigation } from '../NavigationContext';

interface SkewItem {
  code: string;
  name: string;
  volSkew: number;
  upVolatility: number;
  downVolatility: number;
  volatility: number;
  latestClose: number;
  status: 'pending' | 'loading' | 'done' | 'error';
}

interface ScanSuccessResult {
  code: string;
  volSkew: number;
  upVolatility: number;
  downVolatility: number;
  volatility: number;
  latestClose: number;
  error: false;
}

interface ScanErrorResult {
  code: string;
  error: true;
}

type ScanResult = ScanSuccessResult | ScanErrorResult;

const ALL_STOCKS = [
  { code: '000001', name: '平安银行' },
  { code: '600519', name: '贵州茅台' },
  { code: '000333', name: '美的集团' },
  { code: '601318', name: '中国平安' },
  { code: '300750', name: '宁德时代' },
  { code: '002415', name: '海康威视' },
  { code: '600036', name: '招商银行' },
  { code: '000858', name: '五粮液' },
  { code: '601888', name: '中国中免' },
  { code: '000651', name: '格力电器' },
  { code: '002594', name: '比亚迪' },
  { code: '600900', name: '长江电力' },
  { code: '300059', name: '东方财富' },
  { code: '600030', name: '中信证券' },
  { code: '600276', name: '恒瑞医药' },
  { code: '000002', name: '万科A' },
  { code: '601166', name: '兴业银行' },
  { code: '002304', name: '洋河股份' },
  { code: '601012', name: '隆基绿能' },
  { code: '601899', name: '紫金矿业' },
];

const STORAGE_KEY = 'skewScannerResults';

export const SkewScannerPage: React.FC = () => {
  const { navigateToVolume } = useNavigation();
  const [scanCount, setScanCount] = useState(10);
  const [calcWindow, setCalcWindow] = useState(20);
  const [sortBy, setSortBy] = useState<'skew' | 'up' | 'down'>('skew');
  const [filterMode, setFilterMode] = useState<'all' | 'good' | 'bad'>('all');
  const [expandedCode, setExpandedCode] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);

  const initialItems = useMemo(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((item: SkewItem) => ({ ...item, status: item.volSkew > 0 ? 'done' as const : item.status }));
        }
      }
    } catch { /* ignore */ }
    return ALL_STOCKS.map(s => ({
      ...s,
      volSkew: 0,
      upVolatility: 0,
      downVolatility: 0,
      volatility: 0,
      latestClose: 0,
      status: 'pending' as const
    }));
  }, []);

  const [items, setItems] = useState<SkewItem[]>(initialItems);

  useEffect(() => {
    const doneItems = items.filter(i => i.status === 'done' && i.volSkew > 0);
    if (doneItems.length > 0) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
      } catch { /* ignore */ }
    }
  }, [items]);

  const stocksToScan = ALL_STOCKS.slice(0, scanCount);

  useEffect(() => {
    setItems(prev => {
      const existingCodes = new Set(prev.map(i => i.code));
      const newItems = stocksToScan.map(s => {
        const existing = prev.find(i => i.code === s.code);
        if (existing) return existing;
        return {
          ...s,
          volSkew: 0,
          upVolatility: 0,
          downVolatility: 0,
          volatility: 0,
          latestClose: 0,
          status: 'pending' as const
        };
      });
      const keptPrev = prev.filter(i => existingCodes.has(i.code) && !newItems.find(n => n.code === i.code));
      return [...newItems, ...keptPrev];
    });
  }, [scanCount]);

  const scanStock = useCallback(async (code: string) => {
    try {
      const prefix = code.startsWith('6') ? 'sh' : 'sz';
      const symbol = `${prefix}${code}`;
      const result = await getKlineData(symbol, 'day');
      
      if (result.error || !result.data) {
        return { code, error: true };
      }

      const stockData = convertKlineToStockData(result.data.List);
      if (stockData.length < calcWindow + 1) {
        return { code, error: true };
      }

      const volData = calculateVolatility(stockData, calcWindow);
      const validSkew = volData.filter(v => v.upVolatility > 0 && v.downVolatility > 0);
      
      if (validSkew.length === 0) {
        return { code, error: true };
      }

      const latest = validSkew[validSkew.length - 1];
      return {
        code,
        volSkew: latest.volSkew,
        upVolatility: latest.upVolatility,
        downVolatility: latest.downVolatility,
        volatility: latest.volatility,
        latestClose: latest.close,
        error: false
      };
    } catch {
      return { code, error: true };
    }
  }, [calcWindow]);

  const startScan = useCallback(async () => {
    setIsScanning(true);
    setScanProgress(0);
    setExpandedCode(null);
    
    const codes = stocksToScan.map(s => s.code);
    const total = codes.length;
    
    setItems(prev => prev.map(item => 
      codes.includes(item.code) ? { ...item, status: 'pending' as const, volSkew: 0 } : item
    ));
    
    for (let i = 0; i < total; i++) {
      const code = codes[i];
      setItems(prev => prev.map(item => 
        item.code === code ? { ...item, status: 'loading' as const } : item
      ));
      
      const result = await scanStock(code);
      
      if (!result.error) {
        const successResult = result as ScanSuccessResult;
        const { volSkew, upVolatility, downVolatility, volatility, latestClose } = successResult;
        setItems(prev => prev.map(item =>
          item.code === code ? {
            ...item,
            status: 'done' as const,
            volSkew,
            upVolatility,
            downVolatility,
            volatility,
            latestClose
          } : item
        ));
      } else {
        setItems(prev => prev.map(item =>
          item.code === code ? { ...item, status: 'error' as const } : item
        ));
      }
      
      setScanProgress(Math.round(((i + 1) / total) * 100));
    }
    
    setIsScanning(false);
  }, [scanStock, stocksToScan]);

  const sortedAndFilteredItems = useMemo(() => {
    const doneItems = items.filter(item => item.status === 'done');
    
    let filtered = doneItems;
    if (filterMode === 'good') {
      filtered = doneItems.filter(item => item.volSkew >= 1);
    } else if (filterMode === 'bad') {
      filtered = doneItems.filter(item => item.volSkew < 1);
    }
    
    return [...filtered].sort((a, b) => {
      if (sortBy === 'skew') return b.volSkew - a.volSkew;
      if (sortBy === 'up') return b.upVolatility - a.upVolatility;
      return b.downVolatility - a.downVolatility;
    });
  }, [items, sortBy, filterMode]);

  const scanCompleteCount = items.filter(i => i.status === 'done').length;
  const goodCount = items.filter(i => i.status === 'done' && i.volSkew >= 1).length;
  const badCount = items.filter(i => i.status === 'done' && i.volSkew < 1).length;
  const avgSkew = scanCompleteCount > 0 
    ? items.filter(i => i.status === 'done').reduce((sum, i) => sum + i.volSkew, 0) / scanCompleteCount 
    : 0;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200">
      <header className="bg-slate-800 border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-amber-700 rounded-lg flex items-center justify-center">
                <i className="fas fa-radar text-white text-lg"></i>
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">波动率偏度扫描器</h1>
                <p className="text-xs text-slate-400">批量扫描全市场偏度比排名</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400" title="偏度比计算窗口（滑动周期数）">计算窗口:</span>
                <input
                  type="number"
                  value={calcWindow}
                  onChange={(e) => setCalcWindow(Math.max(5, Math.min(100, parseInt(e.target.value) || 20)))}
                  className="bg-slate-700 text-slate-200 text-sm px-2 py-1 rounded border border-slate-600 w-16 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  min={5}
                  max={100}
                  title="计算偏度比的滑动窗口周期数（默认20根K线）"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">扫描数量:</span>
                <input
                  type="number"
                  value={scanCount}
                  onChange={(e) => setScanCount(Math.max(5, Math.min(ALL_STOCKS.length, parseInt(e.target.value) || 10)))}
                  className="bg-slate-700 text-slate-200 text-sm px-2 py-1 rounded border border-slate-600 w-16 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  min={5}
                  max={ALL_STOCKS.length}
                />
              </div>
              
              <button
                onClick={startScan}
                disabled={isScanning}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                  isScanning
                    ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                    : 'bg-amber-600 hover:bg-amber-500 text-white'
                }`}
              >
                {isScanning ? (
                  <>
                    <i className="fas fa-spinner fa-spin"></i>
                    扫描中 {scanProgress}%
                  </>
                ) : (
                  <>
                    <i className="fas fa-play"></i>
                    开始扫描
                  </>
                )}
              </button>
            </div>
          </div>
          
          {isScanning && (
            <div className="mt-3 bg-slate-700 rounded-full h-2 overflow-hidden">
              <div
                className="bg-amber-500 h-full rounded-full transition-all duration-300"
                style={{ width: `${scanProgress}%` }}
              ></div>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
            <div className="text-xs text-slate-400 mb-1">已扫描</div>
            <div className="text-2xl font-bold text-blue-400">{scanCompleteCount} <span className="text-sm text-slate-500">/ {scanCount}</span></div>
          </div>
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
            <div className="text-xs text-slate-400 mb-1">平均偏度比</div>
            <div className={`text-2xl font-bold ${avgSkew >= 1 ? 'text-emerald-400' : 'text-red-400'}`}>{avgSkew.toFixed(3)}</div>
          </div>
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
            <div className="text-xs text-slate-400 mb-1">优质标的 (≥1)</div>
            <div className="text-2xl font-bold text-emerald-400">{goodCount}</div>
          </div>
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
            <div className="text-xs text-slate-400 mb-1">风险标的 (&lt;1)</div>
            <div className="text-2xl font-bold text-red-400">{badCount}</div>
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
            <h2 className="font-semibold text-slate-200 text-sm">扫描结果</h2>
            <div className="flex items-center gap-3">
              <div className="flex gap-1 bg-slate-700 rounded-lg p-0.5">
                {[
                  { value: 'all' as const, label: '全部' },
                  { value: 'good' as const, label: '优质' },
                  { value: 'bad' as const, label: '风险' },
                ].map(f => (
                  <button
                    key={f.value}
                    onClick={() => setFilterMode(f.value)}
                    className={`px-2 py-1 text-xs rounded-md transition-colors ${
                      filterMode === f.value
                        ? 'bg-amber-600 text-white font-medium'
                        : 'text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1 bg-slate-700 rounded-lg p-0.5">
                {[
                  { value: 'skew' as const, label: '偏度比' },
                  { value: 'up' as const, label: '上行' },
                  { value: 'down' as const, label: '下行' },
                ].map(s => (
                  <button
                    key={s.value}
                    onClick={() => setSortBy(s.value)}
                    className={`px-2 py-1 text-xs rounded-md transition-colors ${
                      sortBy === s.value
                        ? 'bg-amber-600 text-white font-medium'
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
                <th className="px-4 py-2 text-left text-slate-400 font-medium text-xs">#</th>
                <th className="px-4 py-2 text-left text-slate-400 font-medium text-xs">代码</th>
                <th className="px-4 py-2 text-left text-slate-400 font-medium text-xs">名称</th>
                <th className="px-4 py-2 text-right text-slate-400 font-medium text-xs">收盘价</th>
                <th className="px-4 py-2 text-right text-slate-400 font-medium text-xs">偏度比</th>
                <th className="px-4 py-2 text-right text-slate-400 font-medium text-xs">上行波动率</th>
                <th className="px-4 py-2 text-right text-slate-400 font-medium text-xs">下行波动率</th>
                <th className="px-4 py-2 text-left text-slate-400 font-medium text-xs">状态</th>
              </tr>
            </thead>
            <tbody>
              {sortedAndFilteredItems.map((item, idx) => (
                <React.Fragment key={item.code}>
                  <tr
                    className={`border-t border-slate-700/50 hover:bg-slate-700/30 cursor-pointer ${
                      expandedCode === item.code ? 'bg-slate-700/50' : ''
                    }`}
                    onClick={() => setExpandedCode(expandedCode === item.code ? null : item.code)}
                  >
                    <td className="px-4 py-2 text-slate-500">{idx + 1}</td>
                    <td className="px-4 py-2 font-mono text-blue-400 hover:text-blue-300 hover:underline cursor-pointer" onClick={(e) => { e.stopPropagation(); navigateToVolume(item.code, item.name); }}>{item.code}</td>
                    <td className="px-4 py-2 text-slate-300">{item.name}</td>
                    <td className="px-4 py-2 text-right font-mono">{item.latestClose.toFixed(2)}</td>
                    <td className="px-4 py-2 text-right">
                      <span className={`px-2 py-0.5 rounded font-bold ${
                        item.volSkew >= 1
                          ? 'bg-emerald-600/20 text-emerald-400'
                          : 'bg-red-600/20 text-red-400'
                      }`}>
                        {item.volSkew.toFixed(3)}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-emerald-400">{item.upVolatility.toFixed(2)}%</td>
                    <td className="px-4 py-2 text-right font-mono text-red-400">{item.downVolatility.toFixed(2)}%</td>
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
                  {expandedCode === item.code && (
                    <tr className="bg-slate-800/50">
                      <td colSpan={8} className="px-4 py-3">
                        <div className="flex items-center gap-4">
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-emerald-400">上行波动率</span>
                              <span className="text-xs text-slate-400">{item.upVolatility.toFixed(2)}%</span>
                            </div>
                            <div className="w-full bg-slate-600 rounded-full h-2">
                              <div
                                className="bg-emerald-500 h-2 rounded-full"
                                style={{ width: `${Math.min(100, (item.upVolatility / Math.max(item.upVolatility, item.downVolatility)) * 100)}%` }}
                              ></div>
                            </div>
                          </div>
                          <div className="text-xs text-slate-500">vs</div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-red-400">下行波动率</span>
                              <span className="text-xs text-slate-400">{item.downVolatility.toFixed(2)}%</span>
                            </div>
                            <div className="w-full bg-slate-600 rounded-full h-2">
                              <div
                                className="bg-red-500 h-2 rounded-full"
                                style={{ width: `${Math.min(100, (item.downVolatility / Math.max(item.upVolatility, item.downVolatility)) * 100)}%` }}
                              ></div>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              {sortedAndFilteredItems.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                    {scanCompleteCount === 0 ? '点击"开始扫描"按钮开始分析' : '没有符合条件的股票'}
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
              <i className="fas fa-play-circle text-amber-400 mt-0.5"></i>
              <span>点击"开始扫描"批量获取股票数据并计算偏度比</span>
            </li>
            <li className="flex items-start gap-2">
              <i className="fas fa-filter text-amber-400 mt-0.5"></i>
              <span>使用"优质/风险"过滤器筛选偏度比 ≥1 或 &lt;1 的标的</span>
            </li>
            <li className="flex items-start gap-2">
              <i className="fas fa-sort text-amber-400 mt-0.5"></i>
              <span>按偏度比、上行波动率或下行波动率排序</span>
            </li>
            <li className="flex items-start gap-2">
              <i className="fas fa-expand text-amber-400 mt-0.5"></i>
              <span>点击股票行展开查看上下波动率对比图，点击代码跳转到筹码分析页</span>
            </li>
          </ul>
        </div>
      </main>
    </div>
  );
};
