import type { StockData, TimeFrame, VolatilityData, GridConfig, GridResult, VolatilitySkewAnalysis, TradingSignalResult, TradingSignal, VolatilityLevel, SkewDirection, SkewDeviationLevel, SkewDriverType, VolumeLevel, VolumeConfirmation, PeriodConsistency } from '../types/stock';

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
  if (totalVolume === 0) {
    return { poc: 0, vah: 0, val: 0, totalVolume: 0 };
  }

  const poc = profile.reduce((max, p) =>
    p.volume > max.volume ? p : max
  , profile[0]);

  const sortedByPrice = [...profile].sort((a, b) => a.price - b.price);
  const valueAreaVolume = totalVolume * 0.7;

  let vah = poc.price;
  let val = poc.price;

  const pocIndex = sortedByPrice.findIndex(p => p.price === poc.price);

  let upperIndex = pocIndex;
  let lowerIndex = pocIndex;
  let cumulativeVolume = poc.volume;

  while (cumulativeVolume < valueAreaVolume && (upperIndex < sortedByPrice.length - 1 || lowerIndex > 0)) {
    const upperVolume = upperIndex < sortedByPrice.length - 1 ? sortedByPrice[upperIndex + 1].volume : 0;
    const lowerVolume = lowerIndex > 0 ? sortedByPrice[lowerIndex - 1].volume : 0;

    // 如果两边都没有成交量，停止扩展
    if (upperVolume === 0 && lowerVolume === 0) {
      break;
    }

    // 选择成交量更大的一侧扩展，如果相等则优先向上
    if (upperVolume >= lowerVolume && upperIndex < sortedByPrice.length - 1) {
      upperIndex++;
      cumulativeVolume += sortedByPrice[upperIndex].volume;
    } else if (lowerIndex > 0) {
      lowerIndex--;
      cumulativeVolume += sortedByPrice[lowerIndex].volume;
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

  // 添加前导占位元素，使volatilityData与stockData长度一致
  // data[0]无法计算收益率（缺少前一天数据），用0填充
  const placeholder: VolatilityData = {
    timestamp: data[0].timestamp,
    close: data[0].close,
    volatility: 0,
    atr: 0,
    hv: 0,
    bbUpper: 0,
    bbMiddle: 0,
    bbLower: 0,
    upVolatility: 0,
    downVolatility: 0,
    volSkew: 0
  };

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

  const volatilityData: VolatilityData[] = [placeholder];
  
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

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function analyzeVolatilitySkew(
  data: StockData[],
  window: number = 60,
  deadZone: number = 0.05
): VolatilitySkewAnalysis | null {
  if (data.length < window * 0.5) {
    return null;
  }

  const returns: number[] = [];
  for (let i = 1; i < data.length; i++) {
    const ret = (data[i].close - data[i - 1].close) / data[i - 1].close;
    returns.push(ret);
  }

  if (returns.length < window * 0.5) {
    return null;
  }

  const currentReturns = returns.slice(-window);
  const historicalReturns = returns.slice(0, -window);

  const currentUpReturns = currentReturns.filter(r => r > 0);
  const currentDownReturns = currentReturns.filter(r => r < 0);
  const currentUpVol = stdDev(currentUpReturns);
  const currentDownVol = stdDev(currentDownReturns);
  const currentVol = stdDev(currentReturns);
  const currentSkew = currentDownVol > 0 ? currentUpVol / currentDownVol : 1;

  const currentWindowData = data.slice(-window);
  const currentVolume = mean(currentWindowData.map(d => d.volume));
  const currentUpVolumeAvg = mean(currentWindowData.filter(d => d.close > d.open).map(d => d.volume));
  const currentDownVolumeAvg = mean(currentWindowData.filter(d => d.close < d.open).map(d => d.volume));

  const historicalUpVolValues: number[] = [];
  const historicalDownVolValues: number[] = [];
  const historicalVolValues: number[] = [];
  const historicalVolumeValues: number[] = [];

  for (let i = 0; i <= historicalReturns.length - window; i++) {
    const chunkReturns = historicalReturns.slice(i, i + window);
    const upReturns = chunkReturns.filter(r => r > 0);
    const downReturns = chunkReturns.filter(r => r < 0);
    historicalUpVolValues.push(stdDev(upReturns));
    historicalDownVolValues.push(stdDev(downReturns));
    historicalVolValues.push(stdDev(chunkReturns));

    const chunkData = data.slice(i, i + window);
    historicalVolumeValues.push(mean(chunkData.map(d => d.volume)));
  }

  let meanUpVol = mean(historicalUpVolValues);
  let meanDownVol = mean(historicalDownVolValues);
  let meanVol = mean(historicalVolValues);
  const meanVolume = historicalVolumeValues.length > 0 ? mean(historicalVolumeValues) : currentVolume;

  meanUpVol = Math.max(meanUpVol, 0.001);
  meanDownVol = Math.max(meanDownVol, 0.001);
  meanVol = Math.max(meanVol, 0.001);

  let meanSkew = meanDownVol > 0 ? meanUpVol / meanDownVol : 1;
  meanSkew = Math.max(meanSkew, 0.001);

  const volRatio = currentVol / meanVol;
  const skewDeviation = (currentSkew - meanSkew) / meanSkew;
  const upVolDeviation = (currentUpVol - meanUpVol) / meanUpVol;
  const downVolDeviation = (currentDownVol - meanDownVol) / meanDownVol;

  let volLevel: VolatilityLevel;
  if (volRatio < 0.80) volLevel = '极度压缩';
  else if (volRatio < 0.95) volLevel = '低于均值';
  else if (volRatio <= 1.05) volLevel = '正常水平';
  else if (volRatio <= 1.20) volLevel = '偏高';
  else volLevel = '极端放大';

  let skewDirection: SkewDirection;
  if (currentSkew > 1.0) skewDirection = '上行主导';
  else if (currentSkew < 1.0) skewDirection = '下行主导';
  else skewDirection = '多空平衡';

  let skewDeviationLevel: SkewDeviationLevel;
  if (skewDeviation > 0.50) skewDeviationLevel = '极度偏高';
  else if (skewDeviation > 0.20) skewDeviationLevel = '显著偏高';
  else if (skewDeviation >= -0.20) skewDeviationLevel = '正常范围';
  else if (skewDeviation >= -0.50) skewDeviationLevel = '显著偏低';
  else skewDeviationLevel = '极度偏低';

  let driverType: SkewDriverType;
  if (upVolDeviation > deadZone && downVolDeviation < -deadZone) {
    driverType = '多头进攻型';
  } else if (upVolDeviation < -deadZone && downVolDeviation > deadZone) {
    driverType = '空头进攻型';
  } else if (upVolDeviation > deadZone && downVolDeviation > deadZone) {
    driverType = '波动放大型';
  } else if (upVolDeviation < -deadZone && downVolDeviation < -deadZone) {
    driverType = '波动收缩型';
  } else {
    driverType = '无明显驱动特征';
  }

  const volumeRatio = currentVolume / Math.max(meanVolume, 0.001);
  const volumeSkew = currentUpVolumeAvg / Math.max(currentDownVolumeAvg, 0.001);

  let volumeLevel: VolumeLevel;
  if (volumeRatio > 1.5) volumeLevel = '异常放量';
  else if (volumeRatio > 1.2) volumeLevel = '显著放量';
  else if (volumeRatio >= 0.8) volumeLevel = '正常';
  else volumeLevel = '缩量';

  let volumeConfirmation: VolumeConfirmation;
  const isHighVolume = volumeRatio > 1.2;
  const isLowVolume = volumeRatio < 0.8;
  const isUpVolumeDominant = volumeSkew > 1.0;
  const isDownVolumeDominant = volumeSkew < 1.0;

  if (driverType === '多头进攻型') {
    if (isHighVolume && isUpVolumeDominant) {
      volumeConfirmation = '强确认';
    } else if (isLowVolume) {
      volumeConfirmation = '弱确认';
    } else {
      volumeConfirmation = '正常蓄势';
    }
  } else if (driverType === '空头进攻型') {
    if (isHighVolume && isDownVolumeDominant) {
      volumeConfirmation = '强确认';
    } else if (isLowVolume) {
      volumeConfirmation = '弱确认';
    } else {
      volumeConfirmation = '正常蓄势';
    }
  } else if (driverType === '波动收缩型') {
    if (isLowVolume) {
      volumeConfirmation = '正常蓄势';
    } else {
      volumeConfirmation = '异常放量待变盘';
    }
  } else if (driverType === '波动放大型') {
    volumeConfirmation = '方向不明';
  } else {
    volumeConfirmation = '正常蓄势';
  }

  const isAnomaly = currentSkew > 5 || currentSkew < 0.2;
  const anomalyReason = isAnomaly ? '偏度比超出正常范围，可能为数据异常或极端行情，需人工复核' : undefined;

  return {
    currentVolatility: currentVol,
    meanVolatility: meanVol,
    volRatio,
    volLevel,
    currentSkew,
    skewDirection,
    meanSkew,
    skewDeviation,
    skewDeviationLevel,
    upVolDeviation,
    downVolDeviation,
    driverType,
    currentVolume,
    meanVolume,
    volumeRatio,
    volumeLevel,
    volumeSkew,
    volumeConfirmation,
    isAnomaly,
    anomalyReason
  };
}

export function generateTradingSignal(
  analysis: VolatilitySkewAnalysis
): TradingSignalResult {
  let score = 0;

  if (analysis.volRatio < 0.85) score += 1;
  if (analysis.volRatio > 1.20) score -= 1;

  if (analysis.currentSkew > 1.0) score += 1;
  if (analysis.currentSkew < 1.0) score -= 1;

  if (analysis.skewDeviation > 0.3) score += 1;
  if (analysis.skewDeviation < -0.3) score -= 1;

  if (analysis.driverType === '多头进攻型') score += 2;
  if (analysis.driverType === '空头进攻型') score -= 2;

  if (analysis.periodConsistency === '完全一致') score += 2;
  if (analysis.periodConsistency === '严重分歧') score -= 2;

  const thresholds: [number, TradingSignal][] = [
    [3, '强势做多'],
    [1, '偏多，可持仓'],
    [0, '中性，观望'],
    [-2, '偏空，减仓'],
    [-3, '强势做空'],
  ];

  let signal = thresholds.find(([min]) => score >= min)?.[1] ?? '中性，观望';

  let originalSignal: TradingSignal | undefined;
  let coverageReason: string | undefined;

  if (analysis.periodConsistency === '严重分歧') {
    if (signal === '强势做多') {
      originalSignal = signal;
      signal = '偏多，可持仓';
      coverageReason = '多周期严重分歧，降级处理';
    } else if (signal === '强势做空') {
      originalSignal = signal;
      signal = '偏空，减仓';
      coverageReason = '多周期严重分歧，降级处理';
    }
  }

  if (analysis.isAnomaly) {
    coverageReason = (coverageReason ? coverageReason + '; ' : '') + '偏度比异常值，需人工复核';
  }

  if (analysis.driverType === '多头进攻型' && analysis.volumeRatio < 0.8) {
    coverageReason = (coverageReason ? coverageReason + '; ' : '') + '缩量上涨，警惕假突破';
  }
  if (analysis.driverType === '空头进攻型' && analysis.volumeRatio < 0.8) {
    coverageReason = (coverageReason ? coverageReason + '; ' : '') + '缩量下跌，恐慌尚未完全释放';
  }
  if (analysis.driverType === '波动收缩型' && analysis.volumeRatio > 1.3) {
    coverageReason = (coverageReason ? coverageReason + '; ' : '') + '缩量后异常放量，可能即将变盘';
  }

  return {
    score,
    signal,
    originalSignal,
    coverageReason,
    analysis,
    timestamp: Date.now()
  };
}

export function analyzeMultiPeriodConsistency(
  periodAnalyses: Record<string, VolatilitySkewAnalysis>
): { consistency: PeriodConsistency; bullishCount: number; totalCount: number } | null {
  const keys = Object.keys(periodAnalyses);
  if (keys.length === 0) return null;

  let bullishCount = 0;
  for (const key of keys) {
    const analysis = periodAnalyses[key];
    if (analysis.currentSkew > 1.0) {
      bullishCount++;
    }
  }

  const total = keys.length;
  let consistency: PeriodConsistency;

  if (bullishCount === total) {
    consistency = '完全一致';
  } else if (bullishCount >= total - 1) {
    consistency = '基本一致';
  } else if (bullishCount >= total / 2) {
    consistency = '中等分歧';
  } else {
    consistency = '严重分歧';
  }

  return { consistency, bullishCount, totalCount: total };
}
