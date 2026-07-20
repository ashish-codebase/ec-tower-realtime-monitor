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

// Resample to 5-min intervals
export function resampleTo5Min(data: any[]): any[] {
  const FIVE_MIN_MS = 5 * 60 * 1000;
  if (data.length <= 1) return data;

  const buckets = new Map<number, any[]>();
  for (const point of data) {
    const bucket = Math.floor(point.timestamp / FIVE_MIN_MS);
    if (!buckets.has(bucket)) buckets.set(bucket, []);
    buckets.get(bucket)!.push(point);
  }

  const result: any[] = [];
  for (const [bucket, points] of buckets) {
    if (points.length === 1) {
      result.push(points[0]);
    } else {
      const avg: Record<string, any> = { timestamp: bucket * FIVE_MIN_MS };
      const allKeys = new Set<string>();
      for (const p of points) {
        for (const k of Object.keys(p)) {
          if (k !== 'timestamp') allKeys.add(k);
        }
      }
      for (const key of allKeys) {
        const vals = points.filter(p => typeof p[key] === 'number' && !isNaN(p[key])).map(p => p[key] as number);
        if (vals.length > 0) avg[key] = vals.reduce((s, v) => s + v, 0) / vals.length;
      }
      result.push(avg);
    }
  }

  result.sort((a, b) => a.timestamp - b.timestamp);
  return result;
}

// Statistics calculation
export function computeStats(data: any[], convertMap?: Map<string, (v: number) => number>): Array<{ key: string; count: number; min: number; max: number; mean: number; stdev: number; duration: string }> {
  if (data.length === 0) return [];

  const groups = new Map<string, { values: number[]; firstTs: number; lastTs: number }>();

  for (const point of data) {
    for (const [key, value] of Object.entries(point)) {
      if (['timestamp', 'SECONDS', 'NANOSECONDS'].includes(key)) continue;
      if (typeof value !== 'number' || isNaN(value)) continue;

      const converter = convertMap?.get(key);
      const convertedValue = converter ? converter(value) : value;

      if (!groups.has(key)) {
        groups.set(key, { values: [], firstTs: point.timestamp, lastTs: point.timestamp });
      }
      const g = groups.get(key)!;
      g.values.push(convertedValue);
      if (point.timestamp < g.firstTs) g.firstTs = point.timestamp;
      if (point.timestamp > g.lastTs) g.lastTs = point.timestamp;
    }
  }

  return Array.from(groups.entries())
    .map(([key, g]) => {
      const values = g.values;
      const durationMs = g.lastTs - g.firstTs;
      const durationMin = Math.round(durationMs / 60000);
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
      return {
        key,
        count: values.length,
        min: Math.min(...values),
        max: Math.max(...values),
        mean,
        stdev: Math.sqrt(variance),
        duration: `${durationMin} min`,
      };
    })
    .sort((a, b) => a.key.localeCompare(b.key));
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
