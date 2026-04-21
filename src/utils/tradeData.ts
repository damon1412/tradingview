import type { TradeTick, TradeIndicatorData, CapitalFlowStats } from '../types/stock';
import type { TradeTickData } from '../services/stockApi';

export function convertTradeTickData(rawData: TradeTickData[], previousClose: number): TradeTick[] {
  const result: TradeTick[] = [];
  let prevPrice = previousClose;
  
  for (let i = 0; i < rawData.length; i++) {
    const item = rawData[i];
    const price = item.Price / 1000;
    const volume = item.Volume;
    const amount = price * volume;
    let status = item.Status as 0 | 1 | 2;
    
    // 当Status=0（中性）时，通过价格变化方向推断买卖方向
    if (status === 0) {
      if (price > prevPrice) {
        status = 1; // 价格上涨，推断为买入
      } else if (price < prevPrice) {
        status = 2; // 价格下跌，推断为卖出
      }
    }
    
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
  const buyAcceleration: number[] = [];
  const sellAcceleration: number[] = [];
  
  let cumBuy = 0;
  let cumSell = 0;
  let prevCumBuy = 0;
  let prevCumSell = 0;
  
  tradeTicks.forEach((tick, index) => {
    prices.push(tick.price);
    timestamps.push(tick.timestamp);
    
    if (tick.status === 1) {
      cumBuy += tick.amount;
    } else if (tick.status === 2) {
      cumSell += tick.amount;
    }
    
    cumulativeBuy.push(cumBuy);
    cumulativeSell.push(cumSell);
    
    if (index === 0) {
      buyAcceleration.push(0);
      sellAcceleration.push(0);
    } else {
      buyAcceleration.push(cumBuy - prevCumBuy);
      sellAcceleration.push(cumSell - prevCumSell);
    }
    
    prevCumBuy = cumBuy;
    prevCumSell = cumSell;
  });
  
  return {
    prices,
    timestamps,
    cumulativeBuy,
    cumulativeSell,
    buyAcceleration,
    sellAcceleration
  };
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
  return amount.toFixed(0);
}
