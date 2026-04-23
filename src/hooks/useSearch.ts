import { useState, useCallback, useRef, useEffect } from 'react';
import { searchStocks } from '../services/stockApi';
import { LOCAL_INDEX_LIST } from '../config/indices';

const POPULAR_INDICES = LOCAL_INDEX_LIST.slice(0, 5);

export function useSearch() {
  const [searchInput, setSearchInput] = useState('');
  const [searchResults, setSearchResults] = useState<{code: string; name: string}[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [showPopularIndices, setShowPopularIndices] = useState(false);
  const debounceTimer = useRef<number | null>(null);

  const handleSearchFocus = useCallback(() => {
    if (!searchInput.trim()) {
      setShowPopularIndices(true);
    }
  }, [searchInput]);

  const handleSearchInputChange = useCallback((value: string) => {
    setSearchInput(value);
    setShowPopularIndices(false);
    
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    
    if (value.trim().length < 2) {
      setShowSearchResults(false);
      setSearchResults([]);
      return;
    }

    debounceTimer.current = window.setTimeout(async () => {
      const { data: results, error } = await searchStocks(value.trim());
      if (error) {
        console.error('搜索失败:', error);
        setSearchResults([]);
        setShowSearchResults(false);
        return;
      }
      setSearchResults(results);
      setShowSearchResults(results.length > 0);
    }, 300);
  }, []);

  const handleSelectStock = useCallback((code: string, name: string, callback: (code: string, name: string) => void) => {
    setSearchInput('');
    setShowSearchResults(false);
    setShowPopularIndices(false);
    setSearchResults([]);
    callback(code, name);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent, callback: (code: string, name: string) => void) => {
    if (e.key === 'Enter' && searchResults.length > 0) {
      handleSelectStock(searchResults[0].code, searchResults[0].name, callback);
    }
  }, [searchResults, handleSelectStock]);

  const closeSearchDropdown = useCallback(() => {
    setShowSearchResults(false);
    setShowPopularIndices(false);
    setSearchResults([]);
  }, []);

  return {
    searchInput,
    setSearchInput,
    searchResults,
    showSearchResults,
    showPopularIndices,
    setShowSearchResults,
    setShowPopularIndices,
    handleSearchFocus,
    handleSearchInputChange,
    handleSelectStock,
    handleKeyDown,
    closeSearchDropdown,
    popularIndices: POPULAR_INDICES
  };
}
