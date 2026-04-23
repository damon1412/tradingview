import React, { useState, useRef, useCallback, useEffect } from 'react';
import { searchStocks } from '../services/stockApi';

interface RecentSearch {
  code: string;
  name: string;
  searchedAt: number;
}

interface AddWatchlistModalProps {
  existingCodes: string[];
  onAdd: (code: string, name: string) => void;
  onClose: () => void;
}

export const AddWatchlistModal: React.FC<AddWatchlistModalProps> = ({
  existingCodes,
  onAdd,
  onClose
}) => {
  const [searchInput, setSearchInput] = useState('');
  const [searchResults, setSearchResults] = useState<{code: string; name: string}[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [addedFeedback, setAddedFeedback] = useState<string | null>(null);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>(() => {
    try {
      const saved = localStorage.getItem('recentSearches');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const debounceTimer = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const saveRecentSearch = useCallback((code: string, name: string) => {
    setRecentSearches(prev => {
      const filtered = prev.filter(s => s.code !== code);
      const updated = [{ code, name, searchedAt: Date.now() }, ...filtered].slice(0, 10);
      localStorage.setItem('recentSearches', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const handleSearch = useCallback((value: string) => {
    setSearchInput(value);
    
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    
    if (value.trim().length < 1) {
      setShowResults(false);
      setSearchResults([]);
      return;
    }

    debounceTimer.current = window.setTimeout(async () => {
      const { data: results } = await searchStocks(value.trim());
      setSearchResults(results);
      setShowResults(results.length > 0);
    }, 300);
  }, []);

  const handleAdd = useCallback((code: string, name: string) => {
    if (existingCodes.includes(code)) {
      return;
    }
    
    saveRecentSearch(code, name);
    onAdd(code, name);
    setAddedFeedback(code);
    setTimeout(() => setAddedFeedback(null), 1500);
  }, [existingCodes, onAdd, saveRecentSearch]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div
        className="bg-slate-800 rounded-lg border border-slate-700 shadow-xl max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <h3 className="font-semibold text-slate-200">添加自选股</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 transition-colors"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="p-4">
          <div className="relative mb-4">
            <div className="flex items-center gap-2 bg-slate-700/50 rounded-lg px-3 py-2">
              <i className="fas fa-search text-slate-400 text-sm"></i>
              <input
                ref={inputRef}
                type="text"
                value={searchInput}
                onChange={(e) => handleSearch(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="输入股票代码或名称"
                className="bg-transparent text-sm text-white placeholder-slate-400 outline-none flex-1"
              />
            </div>

            {showResults && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-lg z-10 max-h-64 overflow-y-auto">
                {searchResults.map((result) => {
                  const isAdded = existingCodes.includes(result.code);
                  const justAdded = addedFeedback === result.code;
                  
                  return (
                    <button
                      key={result.code}
                      onClick={() => !isAdded && handleAdd(result.code, result.name)}
                      disabled={isAdded}
                      className={`w-full px-3 py-2.5 text-left text-sm transition-colors flex items-center justify-between ${
                        justAdded
                          ? 'bg-green-600/20'
                          : isAdded
                          ? 'bg-slate-700/50 cursor-not-allowed opacity-50'
                          : 'hover:bg-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-blue-400">{result.code}</span>
                        <span className="text-slate-300">{result.name}</span>
                      </div>
                      {justAdded ? (
                        <span className="text-xs text-green-400 flex items-center gap-1">
                          <i className="fas fa-check"></i>
                          已添加
                        </span>
                      ) : isAdded ? (
                        <span className="text-xs text-slate-500">已在列表中</span>
                      ) : (
                        <i className="fas fa-plus text-slate-400 text-xs"></i>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {recentSearches.length > 0 && !searchInput.trim() && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs text-slate-400 flex items-center gap-1">
                  <i className="fas fa-history"></i>
                  最近搜索
                </h4>
                <button
                  onClick={() => {
                    setRecentSearches([]);
                    localStorage.removeItem('recentSearches');
                  }}
                  className="text-xs text-slate-500 hover:text-red-400 transition-colors"
                >
                  清除记录
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {recentSearches.slice(0, 5).map(search => {
                  const isAdded = existingCodes.includes(search.code);
                  return (
                    <button
                      key={search.code}
                      onClick={() => !isAdded && handleAdd(search.code, search.name)}
                      disabled={isAdded}
                      className={`text-xs px-3 py-1.5 rounded-full transition-all flex items-center gap-1.5 ${
                        isAdded
                          ? 'bg-slate-700/30 text-slate-500 cursor-not-allowed'
                          : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      <span className="font-mono text-blue-400">{search.code}</span>
                      <span className="text-slate-400">{search.name}</span>
                      {isAdded && <i className="fas fa-check text-green-400 text-xs"></i>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="text-xs text-slate-500 space-y-1">
            <div className="flex items-start gap-2">
              <i className="fas fa-info-circle mt-0.5"></i>
              <span>输入股票代码或名称后，从搜索结果中选择添加</span>
            </div>
            <div className="flex items-start gap-2">
              <i className="fas fa-exclamation-triangle mt-0.5"></i>
              <span>已添加的股票会显示"已在列表中"</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
