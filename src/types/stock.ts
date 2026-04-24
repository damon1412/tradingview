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
