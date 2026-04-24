export interface SectorSkewResult {
  symbol: string;
  name: string;
  blockCode: string;
  latestClose: number;
  latestDate: string;
  changePct: number;
  volSkew: number;
  upVolatility: number;
  downVolatility: number;
  volatility: number;
}

export interface SectorSkewError {
  symbol: string;
  name: string;
  reason: string;
}

export interface SectorSkewData {
  scanDate: string;
  blockType: string;
  calcWindow: number;
  totalBlocks: number;
  successCount: number;
  errorCount: number;
  results: SectorSkewResult[];
  errors: SectorSkewError[];
}

export interface SectorSkewHistory {
  history: Array<{
    date: string;
    scanTime: string;
    results: SectorSkewResult[];
  }>;
}

export type SkewFilterMode = 'all' | 'strong' | 'weak';
export type SkewSortKey = 'volSkew' | 'upVolatility' | 'downVolatility' | 'changePct';
