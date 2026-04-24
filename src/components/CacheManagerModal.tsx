import React, { useMemo, useState } from 'react';
import { getCacheStatus, clearVolumeProfileCache, clearVolatilityCache, clearAllAnalysisCache, getCachedStocks, getPinnedStocks, clearPinnedProfiles, getPinnedProfiles } from '../utils/analysisCache';

interface CacheManagerModalProps {
  stockCode: string;
  onClose: () => void;
  onClearStock: (code: string) => void;
}

export const CacheManagerModal: React.FC<CacheManagerModalProps> = ({
  stockCode,
  onClose,
  onClearStock
}) => {
  const [clearConfirm, setClearConfirm] = useState<string | null>(null);
  
  const cacheStatus = useMemo(() => getCacheStatus(), []);
  const cachedStocks = useMemo(() => getCachedStocks(), []);
  const pinnedStocks = useMemo(() => getPinnedStocks(), []);
  const allStocks = useMemo(() => {
    const set = new Set<string>([...cachedStocks, ...pinnedStocks]);
    return Array.from(set);
  }, [cachedStocks, pinnedStocks]);
  const currentPinnedCount = useMemo(() => getPinnedProfiles(stockCode).length, [stockCode]);
  
  const handleClearStock = (code: string) => {
    if (clearConfirm === code) {
      clearVolumeProfileCache(code);
      clearVolatilityCache(code);
      clearPinnedProfiles(code);
      onClearStock(code);
      setClearConfirm(null);
      setTimeout(() => window.location.reload(), 300);
    } else {
      setClearConfirm(code);
      setTimeout(() => setClearConfirm(null), 2000);
    }
  };

  const handleClearAll = () => {
    if (clearConfirm === 'all') {
      clearAllAnalysisCache();
      clearPinnedProfiles();
      setClearConfirm(null);
      setTimeout(() => window.location.reload(), 300);
    } else {
      setClearConfirm('all');
      setTimeout(() => setClearConfirm(null), 2000);
    }
  };

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes} 分钟前`;
    if (hours < 24) return `${hours} 小时前`;
    return `${days} 天前`;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-slate-800 rounded-lg border border-slate-700 shadow-xl max-w-lg w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <h3 className="font-semibold text-slate-200 flex items-center gap-2">
            <i className="fas fa-database text-blue-400"></i>
            分析缓存管理
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 transition-colors"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="p-4 max-h-[60vh] overflow-y-auto">
          <div className="bg-slate-700/30 rounded-lg p-3 mb-4">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">已缓存分析</span>
              <span className="text-white font-medium">{cachedStocks.length} 只</span>
            </div>
            <div className="flex items-center justify-between text-xs mt-2">
              <span className="text-slate-400">已固定筹码</span>
              <span className="text-white font-medium">{pinnedStocks.length} 只</span>
            </div>
            <div className="flex items-center justify-between text-xs mt-2">
              <span className="text-slate-400">当前固定点</span>
              <span className="text-amber-400 font-medium">{currentPinnedCount} 个</span>
            </div>
            <div className="flex items-center justify-between text-xs mt-2">
              <span className="text-slate-400">localStorage 占用</span>
              <span className="text-white font-medium">{formatSize(cacheStatus.totalSize)}</span>
            </div>
          </div>

          {allStocks.length === 0 ? (
            <div className="p-6 text-center">
              <i className="fas fa-inbox text-slate-600 text-3xl mb-2"></i>
              <div className="text-slate-500 text-sm">暂无缓存数据</div>
              <div className="text-xs text-slate-600 mt-1">查看股票后会自动生成缓存，框选区间后可固定筹码</div>
            </div>
          ) : (
            <div className="space-y-2">
              {allStocks.map(code => {
                const vpStatus = cacheStatus.volumeProfile[code];
                const volStatus = cacheStatus.volatility[code];
                const pinnedCount = getPinnedProfiles(code).length;
                
                return (
                  <div
                    key={code}
                    className="flex items-center justify-between bg-slate-700/50 rounded-lg px-3 py-2"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm text-blue-400">{code}</span>
                        {code === stockCode && (
                          <span className="text-xs bg-blue-600/30 text-blue-400 px-1.5 py-0.5 rounded">
                            当前
                          </span>
                        )}
                      </div>
                      <div className="flex gap-3 mt-1 text-[10px] text-slate-500">
                        {vpStatus && (
                          <span>筹码分析: {formatTime(vpStatus.cachedAt)}</span>
                        )}
                        {volStatus && (
                          <span>波动率: {formatTime(volStatus.cachedAt)}</span>
                        )}
                        {pinnedCount > 0 && (
                          <span className="text-amber-400">固定点: {pinnedCount} 个</span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleClearStock(code)}
                      className={`transition-colors p-1.5 rounded ml-2 ${
                        clearConfirm === code
                          ? 'text-red-400 bg-red-400/10'
                          : 'text-slate-500 hover:text-red-400 hover:bg-slate-700'
                      }`}
                      title={clearConfirm === code ? '再次点击确认清除' : '清除该股票缓存'}
                    >
                      <i className={`fas ${clearConfirm === code ? 'fa-check' : 'fa-trash'} text-xs`}></i>
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {allStocks.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-700">
              <button
                onClick={handleClearAll}
                className={`w-full text-xs px-3 py-2 rounded transition-colors flex items-center justify-center gap-2 ${
                  clearConfirm === 'all'
                    ? 'bg-red-600 text-white'
                    : 'bg-slate-700 hover:bg-red-600/20 text-slate-300 hover:text-red-400'
                }`}
                title={clearConfirm === 'all' ? '再次点击确认清除全部' : '清除所有分析缓存和固定点'}
              >
                <i className={`fas ${clearConfirm === 'all' ? 'fa-check' : 'fa-trash-alt'}`}></i>
                {clearConfirm === 'all' ? '确认清除全部缓存和固定点？' : '清除全部缓存和固定点'}
              </button>
            </div>
          )}

          <div className="mt-4 text-xs text-slate-500 space-y-1">
            <div className="flex items-start gap-2">
              <i className="fas fa-info-circle mt-0.5"></i>
              <span>分析缓存永久保存，切换股票时自动读取</span>
            </div>
            <div className="flex items-start gap-2">
              <i className="fas fa-thumbtack mt-0.5"></i>
              <span>固定的筹码分布按股票独立保存，切换股票不会丢失</span>
            </div>
            <div className="flex items-start gap-2">
              <i className="fas fa-sync-alt mt-0.5"></i>
              <span>清除后下次查看时将重新计算</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
