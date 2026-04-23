import type { TradeTick, TradeIndicatorData, CapitalFlowStats } from '../types/stock';
import type { TradeTickData } from '../services/stockApi';

export function convertTradeTickData(rawData: TradeTickData[], previousClose: number): TradeTick[] {
  const result: TradeTick[] = [];
  let prevPrice = previousClose / 1000;
  
  const firstPrice = rawData[0]?.Price || 0;
  const isPriceInCent = firstPrice > 1000;
  
  for (let i = 0; i < rawData.length; i++) {
    const item = rawData[i];
    const price = isPriceInCent ? item.Price / 1000 : item.Price;
    const volume = item.Volume;
    const amount = price * volume;
    const status = item.Status as 0 | 1 | 2;
    
    const timestamp = parseTradeTimestamp(item.Time);
    const time = formatTradeTime(timestamp);
    
    result.push({
      time,
      timestamp,
      price,
      volume,
      amount,
      status
    });
    
    prevPrice = price;
  }
  
  return result;
}

export function calculateTradeIndicators(tradeTicks: TradeTick[]): TradeIndicatorData {
  const prices: number[] = [];
  const timestamps: number[] = [];
  const cumulativeBuy: number[] = [];
  const cumulativeSell: number[] = [];
  
  let cumBuy = 0;
  let cumSell = 0;
  
  tradeTicks.forEach((tick) => {
    prices.push(tick.price);
    timestamps.push(tick.timestamp);
    
    if (tick.status === 1) {
      cumBuy += tick.amount;
    } else if (tick.status === 2) {
      cumSell += tick.amount;
    }
    
    cumulativeBuy.push(cumBuy);
    cumulativeSell.push(cumSell);
  });
  
  const macdResult = calculateMACD(prices);
  const rsi = calculateRSI(prices);
  
  return {
    prices,
    timestamps,
    cumulativeBuy,
    cumulativeSell,
    macdDIF: macdResult.dif,
    macdDEA: macdResult.dea,
    macdHistogram: macdResult.histogram,
    rsi
  };
}

function calculateMACD(prices: number[], fast: number = 12, slow: number = 26, signal: number = 9) {
  const dif: number[] = [];
  const dea: number[] = [];
  const histogram: number[] = [];
  
  const emaFast = calculateEMA(prices, fast);
  const emaSlow = calculateEMA(prices, slow);
  
  for (let i = 0; i < prices.length; i++) {
    if (i < slow - 1) {
      dif.push(0);
      dea.push(0);
      histogram.push(0);
    } else {
      const d = emaFast[i] - emaSlow[i];
      dif.push(d);
      
      if (dif.filter(v => v !== 0).length === 0) {
        dea.push(0);
      } else {
        const prevDea = i > 0 ? dea[i - 1] : 0;
        dea.push(prevDea * (1 - 2 / (signal + 1)) + d * (2 / (signal + 1)));
      }
      
      histogram.push((d - dea[i]) * 2);
    }
  }
  
  return { dif, dea, histogram };
}

function calculateEMA(prices: number[], period: number): number[] {
  const ema: number[] = [];
  const multiplier = 2 / (period + 1);
  
  if (prices.length === 0) return ema;
  
  ema[0] = prices[0];
  for (let i = 1; i < prices.length; i++) {
    ema[i] = (prices[i] - ema[i - 1]) * multiplier + ema[i - 1];
  }
  
  return ema;
}

function calculateRSI(prices: number[], period: number = 14): number[] {
  const rsi: number[] = [];
  
  if (prices.length < period + 1) {
    return prices.map(() => 50);
  }
  
  const changes: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    changes.push(prices[i] - prices[i - 1]);
  }
  
  let avgGain = 0;
  let avgLoss = 0;
  
  for (let i = 0; i < period; i++) {
    const change = changes[i];
    if (change > 0) {
      avgGain += change;
    } else {
      avgLoss += Math.abs(change);
    }
  }
  
  avgGain /= period;
  avgLoss /= period;
  
  for (let i = 0; i < prices.length; i++) {
    if (i < period) {
      rsi.push(50);
    } else {
      const change = changes[i - 1];
      const gain = change > 0 ? change : 0;
      const loss = change < 0 ? Math.abs(change) : 0;
      
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
      
      if (avgLoss === 0) {
        rsi.push(100);
      } else {
        const rs = avgGain / avgLoss;
        rsi.push(100 - 100 / (1 + rs));
      }
    }
  }
  
  return rsi;
}

export function calculateCapitalFlow(tradeTicks: TradeTick[]): CapitalFlowStats {
  let largeInflow = 0;
  let largeOutflow = 0;
  let mediumInflow = 0;
  let mediumOutflow = 0;
  let smallInflow = 0;
  let smallOutflow = 0;
  
  tradeTicks.forEach(tick => {
    const amount = tick.amount;
    const isBuy = tick.status === 1;
    const isSell = tick.status === 2;
    
    if (amount >= 1000000) {
      if (isBuy) largeInflow += amount;
      else if (isSell) largeOutflow += amount;
    } else if (amount >= 200000) {
      if (isBuy) mediumInflow += amount;
      else if (isSell) mediumOutflow += amount;
    } else {
      if (isBuy) smallInflow += amount;
      else if (isSell) smallOutflow += amount;
    }
  });
  
  return {
    largeInflow,
    largeOutflow,
    mediumInflow,
    mediumOutflow,
    smallInflow,
    smallOutflow
  };
}

function parseTradeTimestamp(timeStr: string): number {
  const today = new Date();
  
  if (timeStr.includes('T')) {
    const date = new Date(timeStr);
    if (!isNaN(date.getTime())) {
      return date.getTime();
    }
  }
  
  const timeRegex = /(\d{2}):(\d{2}):(\d{2})/;
  const match = timeStr.match(timeRegex);
  if (match) {
    const [, hours, minutes, seconds] = match;
    today.setHours(parseInt(hours), parseInt(minutes), parseInt(seconds), 0);
    return today.getTime();
  }
  
  const simpleTimeRegex = /(\d{2}):(\d{2})/;
  const simpleMatch = timeStr.match(simpleTimeRegex);
  if (simpleMatch) {
    const [, hours, minutes] = simpleMatch;
    today.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    return today.getTime();
  }
  
  return Date.now();
}

function formatTradeTime(timestamp: number): string {
  const date = new Date(timestamp);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function formatAmount(amount: number): string {
  if (amount >= 100000000) {
    return (amount / 100000000).toFixed(2) + '亿';
  } else if (amount >= 10000) {
    return (amount / 10000).toFixed(2) + '万';
  }
  return amount.toFixed(2);
}

export function generateSimulatedTicks(
  minuteData: { Time: string; Price: number; Number: number }[],
  previousClose: number
): TradeTick[] {
  const ticks: TradeTick[] = [];
  const prevClose = previousClose / 1000;
  
  for (let i = 0; i < minuteData.length; i++) {
    const item = minuteData[i];
    const price = item.Price / 1000;
    const volume = item.Number;
    
    if (i === 0) {
      const timeStr = item.Time;
      const ts = parseTradeTimestamp(timeStr);
      const timeFormatted = formatTradeTime(ts);
      ticks.push({
        time: timeFormatted,
        timestamp: ts,
        price: prevClose,
        volume: 0,
        amount: 0,
        status: 0
      });
    }
    
    const prevPrice = i === 0 ? prevClose : minuteData[i - 1].Price / 1000;
    let status: 0 | 1 | 2;
    if (price > prevPrice) {
      status = 1;
    } else if (price < prevPrice) {
      status = 2;
    } else {
      status = 0;
    }
    
    const amount = price * volume;
    const ts = parseTradeTimestamp(item.Time);
    const timeFormatted = formatTradeTime(ts);
    
    ticks.push({
      time: timeFormatted,
      timestamp: ts,
      price,
      volume,
      amount,
      status
    });
  }
  
  return ticks;
}
