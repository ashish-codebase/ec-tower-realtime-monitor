// Timestamp utilities
export function timestampToUTC(ts: number, nanoseconds: number = 0): string {
  const ms = (ts + nanoseconds / 1e9) * 1000;
  return new Date(ms).toISOString();
}

export function formatMstTime(unixMs: number): string {
  const d = new Date(unixMs);
  return d.toLocaleString('en-US', {
    timeZone: 'America/Denver',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

// Get conversion map from sensor groups
export function getConversionMap(sensorGroups: Array<{ name: string; keys: string[]; convert?: string }>): Map<string, (v: number) => number> {
  const map = new Map<string, (v: number) => number>();
  for (const g of sensorGroups) {
    if (g.convert === 'multiply_0.51') {
      for (const key of g.keys) {
        map.set(key, (v: number) => v * 0.51);
      }
    }
  }
  return map;
}

// Color palette for charts
export const SENSOR_COLORS = [
  '#2563eb', '#dc2626', '#16a34a', '#ca8a04', '#9333ea',
  '#0891b2', '#e11d48', '#65a30d', '#ea580c', '#7c3aed',
];
