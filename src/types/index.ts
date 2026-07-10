export interface Site {
  name: string;
  ip: string;
}

export interface Reading {
  [key: string]: number;
}

export interface SensorDataPoint {
  sensor: string;
  name: string;
  timestamp: number;
  readings: Reading[];
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
