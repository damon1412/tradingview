export interface StockData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface VolumeProfile {
  price: number;
  volume: number;
}

export interface VolumeProfileStats {
  poc: number;
  vah: number;
  val: number;
  totalVolume: number;
}

export interface SelectedRange {
  startIndex: number;
  endIndex: number;
}

export type TimeFrame = 'minute' | '1m' | '5m' | '10m' | '15m' | '30m' | '60m' | '1d' | '1w';

export interface PinnedProfile {
  id: string;
  range: SelectedRange;
  stats: VolumeProfileStats;
  color: string;
}

export interface WatchlistItem {
  code: string;
  name: string;
  addedAt: number;
  group?: string;
}

export interface WatchlistGroup {
  id: string;
  name: string;
  color: string;
}

export interface TradeTick {
  time: string;
  timestamp: number;
  price: number;
  volume: number;
  amount: number;
  status: 0 | 1 | 2;
}

export interface TradeIndicatorData {
  prices: number[];
  timestamps: number[];
  cumulativeBuy: number[];
  cumulativeSell: number[];
  macdDIF: number[];
  macdDEA: number[];
  macdHistogram: number[];
  rsi: number[];
}

export interface CapitalFlowStats {
  largeInflow: number;
  largeOutflow: number;
  mediumInflow: number;
  mediumOutflow: number;
  smallInflow: number;
  smallOutflow: number;
}

export interface VolatilityData {
  timestamp: number;
  close: number;
  volatility: number;
  atr: number;
  hv: number;
  bbUpper: number;
  bbMiddle: number;
  bbLower: number;
  upVolatility: number;
  downVolatility: number;
  volSkew: number;
}

export type VolatilityIndicator = 'volatility' | 'atr' | 'hv';

export interface GridConfig {
  atrMultiplier: number;
  gridCount: number;
  gridType: 'atr' | 'volatility';
  volatilityMultiplier: number;
}

export interface GridResult {
  grids: { price: number; level: number }[];
  stepSize: number;
  stepPercent: number;
  upperBound: number;
  lowerBound: number;
  totalLevels: number;
  gridType: string;
}

export type VolatilityLevel = '极度压缩' | '低于均值' | '正常水平' | '偏高' | '极端放大';

export type SkewDirection = '上行主导' | '下行主导' | '多空平衡';

export type SkewDeviationLevel = '极度偏高' | '显著偏高' | '正常范围' | '显著偏低' | '极度偏低';

export type SkewDriverType = '多头进攻型' | '波动放大型' | '波动收缩型' | '空头进攻型' | '无明显驱动特征';

export type PeriodConsistency = '完全一致' | '基本一致' | '中等分歧' | '严重分歧';

export type TradingSignal = '强势做多' | '偏多，可持仓' | '中性，观望' | '偏空，减仓' | '强势做空';

export type VolumeLevel = '异常放量' | '显著放量' | '正常' | '缩量';

export type VolumeConfirmation = '强确认' | '正常蓄势' | '异常放量待变盘' | '方向不明' | '弱确认';

export interface VolatilitySkewAnalysis {
  currentVolatility: number;
  meanVolatility: number;
  volRatio: number;
  volLevel: VolatilityLevel;

  currentSkew: number;
  skewDirection: SkewDirection;

  meanSkew: number;
  skewDeviation: number;
  skewDeviationLevel: SkewDeviationLevel;

  upVolDeviation: number;
  downVolDeviation: number;
  driverType: SkewDriverType;

  currentVolume: number;
  meanVolume: number;
  volumeRatio: number;
  volumeLevel: VolumeLevel;
  volumeSkew: number;
  volumeConfirmation: VolumeConfirmation;

  periodConsistency?: PeriodConsistency;
  bullishPeriods?: number;
  totalPeriods?: number;

  isAnomaly: boolean;
  anomalyReason?: string;
}

export interface TradingSignalResult {
  score: number;
  signal: TradingSignal;
  originalSignal?: TradingSignal;
  coverageReason?: string;
  analysis: VolatilitySkewAnalysis;
  timestamp: number;
}
