import type { StockData } from '../types/stock';

/**
 * 计算RSI指标
 * @param data 股票数据
 * @param period 周期，默认14
 */
export function calculateRSI(data: StockData[], period = 14): (number | null)[] {
  const rsiValues: (number | null)[] = [];

  if (data.length < period + 1) {
    return Array(data.length).fill(null);
  }

  // 计算价格变动
  const changes: number[] = [];
  for (let i = 1; i < data.length; i++) {
    changes.push(data[i].close - data[i - 1].close);
  }

  // 计算初始平均涨跌幅
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

  // 前period个值为null
  for (let i = 0; i < period; i++) {
    rsiValues.push(null);
  }

  // 计算第一个RSI值
  if (avgLoss === 0) {
    rsiValues.push(100);
  } else if (avgGain === 0) {
    rsiValues.push(0);
  } else {
    const rs = avgGain / avgLoss;
    rsiValues.push(100 - (100 / (1 + rs)));
  }

  // 计算后续的RSI值（平滑移动平均）
  for (let i = period; i < changes.length; i++) {
    const change = changes[i];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    if (avgLoss === 0) {
      rsiValues.push(100);
    } else if (avgGain === 0) {
      rsiValues.push(0);
    } else {
      const rs = avgGain / avgLoss;
      rsiValues.push(100 - (100 / (1 + rs)));
    }
  }

  return rsiValues;
}

/**
 * 计算MACD指标
 * @param data 股票数据
 * @param fastPeriod 快速EMA周期，默认12
 * @param slowPeriod 慢速EMA周期，默认26
 * @param signalPeriod 信号线周期，默认9
 */
export function calculateMACD(
  data: StockData[],
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9
): { macd: (number | null)[]; signal: (number | null)[]; histogram: (number | null)[] } {
  const macd: (number | null)[] = [];
  const signal: (number | null)[] = [];
  const histogram: (number | null)[] = [];

  if (data.length < slowPeriod + signalPeriod - 1) {
    const nulls = Array(data.length).fill(null);
    return { macd: nulls, signal: nulls, histogram: nulls };
  }

  // 计算EMA函数
  const calculateEMA = (values: number[], period: number): number[] => {
    const ema: number[] = [];
    const multiplier = 2 / (period + 1);

    // 初始值为简单移动平均
    let sum = 0;
    for (let i = 0; i < period; i++) {
      sum += values[i];
    }
    ema.push(sum / period);

    // 计算后续EMA
    for (let i = period; i < values.length; i++) {
      ema.push(values[i] * multiplier + ema[ema.length - 1] * (1 - multiplier));
    }

    return ema;
  };

  const closes = data.map(d => d.close);
  const fastEma = calculateEMA(closes, fastPeriod);
  const slowEma = calculateEMA(closes, slowPeriod);

  // 计算MACD线
  const macdStartIndex = slowPeriod - fastPeriod;
  for (let i = 0; i < data.length; i++) {
    if (i < slowPeriod - 1) {
      macd.push(null);
    } else {
      const fastIndex = i - macdStartIndex;
      macd.push(fastEma[fastIndex] - slowEma[i - slowPeriod + 1]);
    }
  }

  // 计算信号线
  const validMacdValues = macd.filter((v): v is number => v !== null);
  const signalEma = calculateEMA(validMacdValues, signalPeriod);

  for (let i = 0; i < data.length; i++) {
    if (i < slowPeriod + signalPeriod - 2) {
      signal.push(null);
      histogram.push(null);
    } else {
      const signalIndex = i - (slowPeriod + signalPeriod - 2);
      const signalValue = signalEma[signalIndex];
      signal.push(signalValue);
      const macdValue = macd[i];
      histogram.push(macdValue !== null && signalValue !== null ? macdValue - signalValue : null);
    }
  }

  return { macd, signal, histogram };
}