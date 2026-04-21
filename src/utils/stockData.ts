import type { StockData, TimeFrame } from '../types/stock';

export function generateMockStockData(timeFrame: TimeFrame = '1d', count: number = 120): StockData[] {
  const data: StockData[] = [];
  let price = 100;
  const now = Date.now();

  const timeFrameMs: Record<TimeFrame, number> = {
    'minute': 60 * 1000,
    '1m': 60 * 1000,
    '5m': 5 * 60 * 1000,
    '10m': 10 * 60 * 1000,
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
