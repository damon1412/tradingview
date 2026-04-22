import type { StockData } from '../types/stock';
import { LOCAL_INDEX_LIST } from '../config/indices';

const API_BASE_URL = '';

export interface SearchResult {
  code: string;
  name: string;
}

export const LOCAL_INDEX_ETF_LIST: SearchResult[] = LOCAL_INDEX_LIST;

export interface KlineData {
  Last: number;
  Open: number;
  High: number;
  Low: number;
  Close: number;
  Volume: number;
  Amount: number;
  Time: string;
}

export interface ApiError {
  type: 'network' | 'server' | 'business';
  message: string;
  code?: number;
}

function handleApiError(error: unknown): ApiError {
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return {
      type: 'network',
      message: '网络连接失败，请检查API服务器是否运行在http://localhost:8080'
    };
  }

  if (error instanceof Response) {
    return {
      type: 'server',
      message: `服务器错误：${error.status} ${error.statusText}`,
      code: error.status
    };
  }

  return {
    type: 'business',
    message: error instanceof Error ? error.message : '未知错误'
  };
}

export async function searchStocks(keyword: string): Promise<{ data: SearchResult[]; error?: ApiError }> {
  const kw = keyword.trim();
  if (!kw) return { data: [] };

  const localResults = LOCAL_INDEX_ETF_LIST.filter(
    item => item.code.includes(kw) || item.name.includes(kw)
  );

  try {
    const response = await fetch(`/api/search?keyword=${encodeURIComponent(kw)}`);
    if (!response.ok) throw response;
    const result = await response.json();
    if (result.code === 0 && Array.isArray(result.data)) {
      return { data: [...localResults, ...result.data] };
    }
  } catch (error) {
    return { data: localResults };
  }

  return { data: localResults };
}

export interface KlineResponse {
  Count: number;
  List: KlineData[];
}

export async function getKlineData(
  code: string,
  type: string
): Promise<{ data: KlineResponse | null; error?: ApiError }> {
  try {
    const codeNum = code.replace(/^(sh|sz)/, '');
    const isIndex = code.startsWith('sh0') || code.startsWith('sz399') || code.startsWith('sh9');
    const apiType = isIndex ? 'index' : 'kline';
    const response = await fetch(`/api/${apiType}?code=${code}&type=${type}`);
    if (!response.ok) throw response;
    const result = await response.json();
    if (result.code === 0) {
      return { data: result.data };
    }
    return {
      data: null,
      error: {
        type: 'business',
        message: result.message || '获取K线数据失败',
        code: result.code
      }
    };
  } catch (error) {
    const apiError = handleApiError(error);
    console.error('获取K线数据失败:', apiError);
    return { data: null, error: apiError };
  }
}

export function convertKlineToStockData(klineData: KlineData[]): StockData[] {
  return klineData
    .map((item) => ({
      timestamp: new Date(item.Time).getTime(),
      open: item.Open / 1000,
      high: item.High / 1000,
      low: item.Low / 1000,
      close: item.Close / 1000,
      volume: item.Volume
    }))
    .sort((a, b) => a.timestamp - b.timestamp); // API返回数据为时间倒序，这里按时间升序排列
}

export function getApiTypeFromTimeFrame(timeFrame: string): string {
  const typeMap: Record<string, string> = {
    'minute': 'minute1',
    '1m': 'minute1',
    '5m': 'minute5',
    '10m': 'minute5',
    '30m': 'minute30',
    '60m': 'hour',
    '1d': 'day',
    '1w': 'week'
  };
  return typeMap[timeFrame] || 'day';
}

export async function getStockDataWithFallback(
  code: string,
  timeFrame: string
): Promise<{ data: StockData[]; error?: ApiError }> {
  const apiType = getApiTypeFromTimeFrame(timeFrame);

  const { data: klineData, error } = await getKlineData(code, apiType);
  if (error) {
    return { data: [], error };
  }
  if (klineData && klineData.List.length > 0) {
    return { data: convertKlineToStockData(klineData.List) };
  }

  return { data: [] };
}

export async function get1MinuteDataForVolumeProfile(
  code: string,
  startDate: string,
  endDate: string
): Promise<{ data: StockData[]; error?: ApiError }> {
  try {
    const codeNum = code.replace(/^(sh|sz)/, '');
    const isIndex = code.startsWith('sh0') || code.startsWith('sz399') || code.startsWith('sh9');
    const apiType = isIndex ? 'index' : 'kline-history';
    
    let url;
    if (isIndex) {
      url = `/api/${apiType}?code=${code}&type=minute1&start_date=${startDate}&end_date=${endDate}&limit=20000`;
    } else {
      url = `/api/${apiType}?code=${code}&type=minute1&start_date=${startDate}&end_date=${endDate}&limit=800`;
    }
    
    const response = await fetch(url);
    if (!response.ok) throw response;
    const result = await response.json();
    if (result.code === 0 && result.data && result.data.List) {
      let list = result.data.List;
      // 指数1分钟数据可能不完整，按日期过滤
      const filteredList = list.filter((item: any) => {
        const itemDate = item.Time?.substring(0, 10).replace(/-/g, '');
        return itemDate >= startDate && itemDate <= endDate;
      });
      return { data: convertKlineToStockData(filteredList.length > 0 ? filteredList : list) };
    }
    return {
      data: [],
      error: {
        type: 'business',
        message: result.message || '获取1分钟数据失败',
        code: result.code
      }
    };
  } catch (error) {
    const apiError = handleApiError(error);
    console.error('获取1分钟数据失败:', apiError);
    return { data: [], error: apiError };
  }
}

export interface MinuteData {
  Time: string;
  Price: number;
  Number: number;
}

export async function getMinuteData(
  code: string,
  date?: string
): Promise<{ data: { date: string; list: MinuteData[] } | null; error?: ApiError }> {
  try {
    let url = `/api/minute?code=${code}`;
    if (date) {
      url += `&date=${date}`;
    }
    const response = await fetch(url);
    if (!response.ok) throw response;
    const result = await response.json();
    if (result.code === 0 && result.data) {
      return { 
        data: { 
          date: result.data.date, 
          list: result.data.List || [] 
        } 
      };
    }
    return {
      data: null,
      error: {
        type: 'business',
        message: result.message || '获取分时数据失败',
        code: result.code
      }
    };
  } catch (error) {
    const apiError = handleApiError(error);
    console.error('获取分时数据失败:', apiError);
    return { data: null, error: apiError };
  }
}

export interface QuoteData {
  Last: number;
  Open: number;
  High: number;
  Low: number;
  Close: number;
}

export async function getQuote(
  code: string
): Promise<{ data: QuoteData | null; error?: ApiError }> {
  try {
    const response = await fetch(`/api/quote?code=${code}`);
    if (!response.ok) throw response;
    const result = await response.json();
    if (result.code === 0 && result.data && result.data.length > 0) {
      return { data: result.data[0].K };
    }
    return {
      data: null,
      error: {
        type: 'business',
        message: result.message || '获取行情数据失败',
        code: result.code
      }
    };
  } catch (error) {
    const apiError = handleApiError(error);
    console.error('获取行情数据失败:', apiError);
    return { data: null, error: apiError };
  }
}

export function convertMinuteToStockData(minuteData: MinuteData[], previousClose: number): StockData[] {
  let currentPrice = previousClose;
  let currentVolume = 0;
  const result: StockData[] = [];
  
  minuteData.forEach((item, index) => {
    const price = item.Price / 1000;
    const volume = item.Number;
    
    // 第一分钟使用昨收价作为开盘价
    if (index === 0) {
      result.push({
        timestamp: parseMinuteTimestamp(item.Time),
        open: previousClose / 1000,
        high: Math.max(previousClose / 1000, price),
        low: Math.min(previousClose / 1000, price),
        close: price,
        volume: volume
      });
    } else {
      result.push({
        timestamp: parseMinuteTimestamp(item.Time),
        open: currentPrice / 1000,
        high: Math.max(currentPrice / 1000, price),
        low: Math.min(currentPrice / 1000, price),
        close: price,
        volume: volume
      });
    }
    
    currentPrice = item.Price;
    currentVolume = volume;
  });
  
  return result;
}

function parseMinuteTimestamp(timeStr: string): number {
  // 将 "09:31" 格式转换为今天的时间戳
  const today = new Date();
  const [hours, minutes] = timeStr.split(':').map(Number);
  today.setHours(hours, minutes, 0, 0);
  return today.getTime();
}

export interface TradeTickData {
  Price: number;
  Time: string;
  Volume: number;
  Status: 0 | 1 | 2;
}

export async function getTodayTradeData(
  code: string,
  date?: string
): Promise<{ data: TradeTickData[] | null; error?: ApiError }> {
  try {
    let url = `/api/minute-trade-all?code=${code}`;
    if (date) {
      url += `&date=${date}`;
    }
    const response = await fetch(url);
    if (!response.ok) throw response;
    const result = await response.json();
    if (result.code === 0 && result.data) {
      // TDX Status定义：0=买入, 1=卖出, 2=中性
      // Sina Status定义：1=买入, 2=卖出, 0=中性
      // 转换为Sina标准
      const list = result.data.List || [];
      const converted = list.map((item: TradeTickData) => {
        let status = item.Status;
        if (status === 0) status = 1;
        else if (status === 1) status = 2;
        else if (status === 2) status = 0;
        return { ...item, Status: status };
      });
      return { data: converted };
    }
    return {
      data: null,
      error: {
        type: 'business',
        message: result.message || '获取逐笔数据失败',
        code: result.code
      }
    };
  } catch (error) {
    const apiError = handleApiError(error);
    console.error('获取逐笔数据失败:', apiError);
    return { data: null, error: apiError };
  }
}

export async function getSinaTickData(
  code: string,
  num: number = 1000
): Promise<{ data: TradeTickData[] | null; error?: ApiError }> {
  try {
    const prefix = code.startsWith('6') ? 'sh' : 'sz';
    const symbol = `${prefix}${code}`;
    const url = `/sina-tick?symbol=${symbol}&num=${num}&sort=ticktime&asc=0&volume=0`;
    
    const response = await fetch(url);
    if (!response.ok) throw new Error('网络错误');
    
    const result = await response.json();
    if (!Array.isArray(result)) {
      return { data: [], error: { type: 'business', message: '数据格式错误', code: -1 } };
    }
    
    const ticks: TradeTickData[] = [];
    for (const item of result) {
      const price = parseFloat(item.price);
      const volume = parseInt(item.volume);
      const kind = item.kind;
      const status = kind === 'U' ? 1 : kind === 'D' ? 2 : 0;
      const timeStr = item.ticktime;
      
      ticks.push({
        Price: Math.round(price * 1000),
        Time: timeStr,
        Volume: volume,
        Status: status as 0 | 1 | 2
      });
    }
    
    ticks.reverse();
    
    return { data: ticks };
  } catch (error) {
    console.error('获取新浪逐笔数据失败:', error);
    return { data: null, error: { type: 'network', message: '获取新浪数据失败' } };
  }
}
