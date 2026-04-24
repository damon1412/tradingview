import type { StockData, TimeFrame, VolatilityData, GridConfig, GridResult } from '../types/stock';

export function generateMockStockData(timeFrame: TimeFrame = '1d', count: number = 120): StockData[] {
  const data: StockData[] = [];
  let price = 100;
  const now = Date.now();

  const timeFrameMs: Record<TimeFrame, number> = {
    'minute': 60 * 1000,
    '1m': 60 * 1000,
    '5m': 5 * 60 * 1000,
    '10m': 10 * 60 * 1000,
    '15m': 15 * 60 * 1000,
    '30m': 30 * 60 * 1000,
    '60m': 60 * 60 * 1000,
    '1d': 24 * 60 * 60 * 1000,
    '1w': 7 * 24 * 60 * 60 * 1000
  };

  const intervalMs = timeFrameMs[timeFrame];

  for (let i = count; i >= 0; i--) {
    const volatility = timeFrame === '1w' ? 0.04 : timeFrame === '1d' ? 0.02 : 0.005;
    const trend = timeFrame === '1w' ? 0.002 : timeFrame === '1d' ? 0.0005 : 0.0001;
    const change = (Math.random() - 0.5) * volatility + trend;
    const open = price;
    const close = price * (1 + change);
    const high = Math.max(open, close) * (1 + Math.random() * 0.005);
    const low = Math.min(open, close) * (1 - Math.random() * 0.005);

    const baseVolume = timeFrame === '1w' ? 50000000 : timeFrame === '1d' ? 5000000 : 100000;
    const volume = Math.floor(baseVolume + Math.random() * baseVolume);

    data.push({
      timestamp: now - i * intervalMs,
      open,
      high,
      low,
      close,
      volume
    });

    price = close;
  }

  return data;
}

export function getTimeFrameLabel(timeFrame: TimeFrame): string {
  const labels: Record<TimeFrame, string> = {
    'minute': '分时',
    '1m': '1分钟',
    '5m': '5分钟',
    '10m': '10分钟',
    '15m': '15分钟',
    '30m': '30分钟',
    '60m': '60分钟',
    '1d': '日线',
    '1w': '周线'
  };
  return labels[timeFrame];
}

export function calculateVolumeProfile(
  data: StockData[],
  priceLevels: number = 50
): { profile: { price: number; volume: number }[]; minPrice: number; maxPrice: number } {
  if (data.length === 0) {
    return { profile: [], minPrice: 0, maxPrice: 0 };
  }

  const minPrice = Math.min(...data.map(d => d.low));
  const maxPrice = Math.max(...data.map(d => d.high));
  const priceRange = maxPrice - minPrice;
  const levelSize = priceRange / priceLevels;

  const profile: { price: number; volume: number }[] = [];

  for (let i = 0; i < priceLevels; i++) {
    const levelPrice = minPrice + i * levelSize + levelSize / 2;
    const levelVolume = data.reduce((sum, candle) => {
      const candleRange = candle.high - candle.low;
      const overlapLow = Math.max(candle.low, minPrice + i * levelSize);
      const overlapHigh = Math.min(candle.high, minPrice + (i + 1) * levelSize);
      const overlap = Math.max(0, overlapHigh - overlapLow);
      const ratio = candleRange > 0 ? overlap / candleRange : 0;
      return sum + candle.volume * ratio;
    }, 0);

    profile.push({
      price: levelPrice,
      volume: levelVolume
    });
  }

  return { profile, minPrice, maxPrice };
}

export function calculateVolumeProfileStats(
  profile: { price: number; volume: number }[]
): { poc: number; vah: number; val: number; totalVolume: number } {
  if (profile.length === 0) {
    return { poc: 0, vah: 0, val: 0, totalVolume: 0 };
  }

  const totalVolume = profile.reduce((sum, p) => sum + p.volume, 0);

  const poc = profile.reduce((max, p) =>
    p.volume > max.volume ? p : max
  , profile[0]);

  const sortedByPrice = [...profile].sort((a, b) => a.price - b.price);
  let cumulativeVolume = 0;
  const valueAreaVolume = totalVolume * 0.7;

  let vah = poc.price;
  let val = poc.price;

  const pocIndex = sortedByPrice.findIndex(p => p.price === poc.price);

  let upperIndex = pocIndex;
  let lowerIndex = pocIndex;
  cumulativeVolume = poc.volume;

  while (cumulativeVolume < valueAreaVolume && (upperIndex < sortedByPrice.length - 1 || lowerIndex > 0)) {
    const upperVolume = upperIndex < sortedByPrice.length - 1 ? sortedByPrice[upperIndex + 1].volume : 0;
    const lowerVolume = lowerIndex > 0 ? sortedByPrice[lowerIndex - 1].volume : 0;

    if (upperVolume >= lowerVolume && upperIndex < sortedByPrice.length - 1) {
      upperIndex++;
      cumulativeVolume += upperVolume;
    } else if (lowerIndex > 0) {
      lowerIndex--;
      cumulativeVolume += lowerVolume;
    } else {
      break;
    }
  }

  vah = sortedByPrice[upperIndex].price;
  val = sortedByPrice[lowerIndex].price;

  return {
    poc: poc.price,
    vah,
    val,
    totalVolume
  };
}

export function formatPrice(price: number): string {
  return price.toFixed(2);
}

export function formatVolume(volume: number): string {
  if (volume >= 1000000000) {
    return (volume / 1000000000).toFixed(2) + 'B';
  } else if (volume >= 1000000) {
    return (volume / 1000000).toFixed(2) + 'M';
  } else if (volume >= 1000) {
    return (volume / 1000).toFixed(2) + 'K';
  }
  return volume.toString();
}

export function calculateVolatility(
  data: StockData[],
  window: number = 20,
  bbMultiplier: number = 2
): VolatilityData[] {
  if (data.length < 2) return [];

  const returns: number[] = [];
  for (let i = 1; i < data.length; i++) {
    const ret = (data[i].close - data[i - 1].close) / data[i - 1].close;
    returns.push(ret);
  }

  const trueRanges: number[] = [];
  for (let i = 1; i < data.length; i++) {
    const high = data[i].high;
    const low = data[i].low;
    const prevClose = data[i - 1].close;
    const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
    trueRanges.push(tr);
  }

  const volatilityData: VolatilityData[] = [];
  
  for (let i = 0; i < returns.length; i++) {
    if (i < window - 1) {
      volatilityData.push({
        timestamp: data[i + 1].timestamp,
        close: data[i + 1].close,
        volatility: 0,
        atr: 0,
        hv: 0,
        bbUpper: 0,
        bbMiddle: 0,
        bbLower: 0,
        upVolatility: 0,
        downVolatility: 0,
        volSkew: 0
      });
      continue;
    }

    const windowReturns = returns.slice(i - window + 1, i + 1);
    const mean = windowReturns.reduce((sum, r) => sum + r, 0) / windowReturns.length;
    const variance = windowReturns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / windowReturns.length;
    const volatility = Math.sqrt(variance * 252) * 100;

    const windowTR = trueRanges.slice(i - window + 1, i + 1);
    const atr = windowTR.reduce((sum, tr) => sum + tr, 0) / windowTR.length;

    const windowCloses = [];
    for (let j = i - window + 1; j <= i; j++) {
      windowCloses.push(data[j + 1].close);
    }
    const sma = windowCloses.reduce((sum, c) => sum + c, 0) / windowCloses.length;

    const bbUpper = sma + bbMultiplier * atr;
    const bbMiddle = sma;
    const bbLower = sma - bbMultiplier * atr;

    const hv = volatility;

    const windowReturnsRaw = returns.slice(i - window + 1, i + 1);
    const upReturns = windowReturnsRaw.filter(r => r > 0);
    const downReturns = windowReturnsRaw.filter(r => r < 0);

    let upVolatility = 0;
    if (upReturns.length > 0) {
      const upMean = upReturns.reduce((sum, r) => sum + r, 0) / upReturns.length;
      const upVariance = upReturns.reduce((sum, r) => sum + Math.pow(r - upMean, 2), 0) / upReturns.length;
      upVolatility = Math.sqrt(upVariance * 252) * 100;
    }

    let downVolatility = 0;
    if (downReturns.length > 0) {
      const downMean = downReturns.reduce((sum, r) => sum + r, 0) / downReturns.length;
      const downVariance = downReturns.reduce((sum, r) => sum + Math.pow(r - downMean, 2), 0) / downReturns.length;
      downVolatility = Math.sqrt(downVariance * 252) * 100;
    }

    const volSkew = downVolatility > 0 ? upVolatility / downVolatility : upVolatility > 0 ? 999 : 0;

    volatilityData.push({
      timestamp: data[i + 1].timestamp,
      close: data[i + 1].close,
      volatility,
      atr,
      hv,
      bbUpper,
      bbMiddle,
      bbLower,
      upVolatility,
      downVolatility,
      volSkew
    });
  }

  return volatilityData;
}

export function calculateGrid(config: GridConfig, currentPrice: number, volatilityData: VolatilityData[]): GridResult {
  if (volatilityData.length === 0 || currentPrice <= 0) {
    return { grids: [], stepSize: 0, stepPercent: 0, upperBound: 0, lowerBound: 0, totalLevels: 0, gridType: '' };
  }

  const validAtr = volatilityData.filter((v: VolatilityData) => v.atr > 0);
  const latestAtr = validAtr.length > 0 ? validAtr[validAtr.length - 1].atr : 0;
  const validVol = volatilityData.filter((v: VolatilityData) => v.volatility > 0);
  const latestVolatility = validVol.length > 0 ? validVol[validVol.length - 1].volatility : 0;

  let stepSize: number;
  let gridType: string;

  if (config.gridType === 'atr') {
    stepSize = latestAtr * config.atrMultiplier;
    gridType = `ATR(${config.atrMultiplier}x)`;
  } else {
    const dailyVol = latestVolatility / Math.sqrt(252);
    stepSize = (dailyVol * config.volatilityMultiplier / 100) * currentPrice;
    gridType = `HV(${config.volatilityMultiplier}x)`;
  }

  const totalRange = stepSize * config.gridCount;
  const upperBound = currentPrice + totalRange;
  const lowerBound = currentPrice - totalRange;

  const grids: { price: number; level: number }[] = [];
  for (let i = -config.gridCount; i <= config.gridCount; i++) {
    grids.push({
      price: currentPrice + i * stepSize,
      level: i
    });
  }

  return {
    grids,
    stepSize,
    stepPercent: (stepSize / currentPrice) * 100,
    upperBound,
    lowerBound,
    totalLevels: grids.length,
    gridType
  };
}
