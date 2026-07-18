import { TowerDataPoint } from '@/types';

const FIVE_MIN_MS = 5 * 60 * 1000;

/**
 * Downsample data points to 5-minute intervals.
 * - Groups points by 5-min bucket (floor(timestamp / 5min))
 * - Averages all numeric columns within each bucket
 * - Does NOT interpolate gaps (only buckets with actual data get a point)
 */
export function resampleTo5Min(data: TowerDataPoint[]): TowerDataPoint[] {
  if (data.length <= 1) return data;

  const buckets = new Map<number, TowerDataPoint[]>();
  
  for (const point of data) {
    const bucket = Math.floor(point.timestamp / FIVE_MIN_MS);
    if (!buckets.has(bucket)) {
      buckets.set(bucket, []);
    }
    buckets.get(bucket)!.push(point);
  }

  const result: TowerDataPoint[] = [];
  
  for (const [bucket, points] of buckets) {
    if (points.length === 1) {
      result.push(points[0]);
    } else {
      // Average all columns across points in this bucket
      const avg: TowerDataPoint = { timestamp: bucket * FIVE_MIN_MS };
      const allKeys = new Set<string>();
      for (const p of points) {
        for (const k of Object.keys(p)) {
          if (k !== 'timestamp') allKeys.add(k);
        }
      }
      for (const key of allKeys) {
        const numVals = points
          .filter(p => typeof p[key] === 'number' && !isNaN(p[key] as number))
          .map(p => p[key] as number);
        if (numVals.length > 0) {
          avg[key] = numVals.reduce((s, v) => s + v, 0) / numVals.length;
        } else {
          const nonNumeric = points.find(p => p[key] !== undefined && typeof p[key] !== 'number');
          if (nonNumeric !== undefined) avg[key] = nonNumeric[key];
        }
      }
      result.push(avg);
    }
  }

  result.sort((a, b) => a.timestamp - b.timestamp);
  return result;
}
