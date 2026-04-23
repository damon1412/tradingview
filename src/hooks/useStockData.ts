import { useState, useCallback, useEffect, useRef } from 'react';
import type { StockData, TimeFrame } from '../types/stock';
import { getQuote, getMinuteData, getStockDataWithFallback, convertMinuteToStockData } from '../services/stockApi';

export function useStockData(toast: (message: string, type: 'error' | 'warning' | 'info' | 'success') => void) {
  const [data, setData] = useState<StockData[]>([]);
  const [stockCode, setStockCode] = useState('000001');
  const [stockName, setStockName] = useState('平安银行');
  const [isLoading, setIsLoading] = useState(false);
  const [zoomRange, setZoomRange] = useState<{startIndex: number; endIndex: number} | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const displayData = stockCode === 'DEMO' ? data : (() => {
    if (!zoomRange) return data;
    return data.slice(zoomRange.startIndex, zoomRange.endIndex + 1);
  })();

  const loadStockData = useCallback(async (code: string, tf: TimeFrame, dataRange: string = '1y') => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;
    
    setIsLoading(true);
    try {
      if (tf === 'minute') {
        const { data: quoteData, error: quoteError } = await getQuote(code);
        if (controller.signal.aborted) return;
        if (quoteError) {
          toast(`获取行情数据失败: ${quoteError.message}`, 'error');
          return;
        }
        const previousClose = quoteData?.Last || 0;
        
        const { data: minuteData, error: minuteError } = await getMinuteData(code);
        if (controller.signal.aborted) return;
        if (minuteError) {
          toast(`获取分时数据失败: ${minuteError.message}`, 'error');
          return;
        }
        if (minuteData && minuteData.list.length > 0) {
          const stockData = convertMinuteToStockData(minuteData.list, previousClose);
          setData(stockData);
        } else {
          toast('未找到该股票分时数据', 'warning');
        }
        return;
      }

      const { data: stockData, error } = await getStockDataWithFallback(code, tf);
      if (controller.signal.aborted) return;
      if (error) {
        toast(`获取股票数据失败: ${error.message}`, 'error');
        return;
      }
      if (stockData.length > 0) {
        let filteredData = stockData;
        if (dataRange !== 'all') {
          const now = Date.now();
          let rangeMs: number;
          switch (dataRange) {
            case '1m': rangeMs = 30 * 24 * 60 * 60 * 1000; break;
            case '3m': rangeMs = 90 * 24 * 60 * 60 * 1000; break;
            case '6m': rangeMs = 180 * 24 * 60 * 60 * 1000; break;
            case '1y': rangeMs = 365 * 24 * 60 * 60 * 1000; break;
            case '3y': rangeMs = 3 * 365 * 24 * 60 * 60 * 1000; break;
            case '5y': rangeMs = 5 * 365 * 24 * 60 * 60 * 1000; break;
            default: rangeMs = 365 * 24 * 60 * 60 * 1000;
          }
          const cutoffTime = now - rangeMs;
          filteredData = stockData.filter(item => item.timestamp >= cutoffTime);
        }
        if (!controller.signal.aborted) {
          setData(filteredData);
        }
      } else {
        toast('未找到该股票数据，请检查股票代码', 'warning');
      }
    } catch (error) {
      if (controller.signal.aborted) return;
      console.error('加载股票数据失败:', error);
      if (error instanceof TypeError && error.message.includes('fetch')) {
        toast('无法连接到后端服务，请确保Docker和API服务已启动（localhost:8080）', 'error');
      } else {
        toast('获取股票数据失败', 'error');
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
      }
    }
  }, [toast]);

  return { data, displayData, stockCode, setStockCode, stockName, setStockName, isLoading, setIsLoading, zoomRange, setZoomRange, loadStockData };
}
