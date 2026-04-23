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

export type TimeFrame = 'minute' | '1m' | '5m' | '10m' | '30m' | '60m' | '1d' | '1w';

export interface PinnedProfile {
  id: string;
  range: SelectedRange;
  stats: VolumeProfileStats;
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
