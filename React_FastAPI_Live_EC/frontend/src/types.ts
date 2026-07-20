export interface Site {
  name: string;
  ip: string;
}

export interface TowerDataPoint {
  timestamp: number;
  [key: string]: number;
}

export interface FetchResult {
  name: string;
  ip: string;
  status: 'ok' | 'error';
  count?: number;
  error?: string;
}

export interface SensorGroup {
  name: string;
  keys: string[];
  convert?: string; // "multiply_0.51" for PPFD
}

export interface StatsEntry {
  id: string;
  key: string;
  count: number;
  min: number;
  max: number;
  mean: number;
  stdev: number;
  duration: string;
}
