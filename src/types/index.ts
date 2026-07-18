export interface Site {
  name: string;
  ip: string;
}

export interface ParsedReading {
  key: string;
  value: number;
}

export interface SensorGroup {
  sensor: string;
  name: string;
  readings: { timestamp: number; values: Map<string, number> }[];
}

export interface Stats {
  count: number;
  min: number;
  max: number;
  mean: number;
  duration: string;
}

// Combined data point (sonic + daqm merged by timestamp)
export interface TowerDataPoint {
  timestamp: number; // Unix timestamp in seconds
  type: 'sonic' | 'daqm';
  [key: string]: number | string;
}
