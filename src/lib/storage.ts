import fs from 'fs';
import path from 'path';
import { TowerDataPoint } from '@/types';
import { resampleTo5Min } from './resample';

// Use /tmp in serverless environments (Vercel), local data dir otherwise
const DATA_DIR = process.env.VERCEL ? '/tmp/ec-tower-data' : path.join(process.cwd(), 'data');

export function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function getFilePath(ip: string): string {
  return path.join(DATA_DIR, `${ip.replace(/\./g, '_')}.json`);
}

// Normalize timestamp: only call at ENTRY POINTS (API fetch).
// Data stored on disk is always in milliseconds — do NOT normalize on reads.
function normalizeTs(ts: number): number {
  if (typeof ts !== 'number' || ts >= 1e12) return ts;
  return ts * 1000;
}

export function readSiteData(ip: string): TowerDataPoint[] {
  const filePath = getFilePath(ip);
  if (!fs.existsSync(filePath)) return [];

  const content = fs.readFileSync(filePath, 'utf-8');
  const points: TowerDataPoint[] = [];

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const p = JSON.parse(trimmed);
      // Data is already in ms when stored — return as-is
      points.push(p);
    } catch {
      // skip malformed
    }
  }

  return points;
}

export function appendSiteData(ip: string, newPoints: TowerDataPoint[]) {
  if (newPoints.length === 0) return;

  // Downsample to 5-min intervals before storing
  const resampled = resampleTo5Min(newPoints);

  const filePath = getFilePath(ip);
  let existing = readSiteData(ip);
  // Existing data is already in ms — no normalization needed
  const seenKeys = new Set<string>();

  for (const p of existing) {
    seenKeys.add(`${p.timestamp}`);
  }

  const deduped = resampled.filter((p) => {
    const key = `${p.timestamp}`;
    return !seenKeys.has(key);
  });

  if (deduped.length === 0) return;

  const fd = fs.openSync(filePath, 'a');
  for (const point of deduped) {
    fs.writeSync(fd, JSON.stringify(point) + '\n');
  }
  fs.closeSync(fd);

  // Keep max 2880 points (circular buffer - oldest gets replaced)
  const MAX_POINTS = 2880;
  let updated = readSiteData(ip);
  if (updated.length > MAX_POINTS) {
    // Data is already in ms — no normalization needed
    const kept = updated.slice(-MAX_POINTS);
    fs.writeFileSync(filePath, kept.map((p) => JSON.stringify(p)).join('\n') + '\n');
    console.log(`[Storage] Trimmed ${ip} from ${updated.length} to ${kept.length} points`);
  }
}

export function readAllSiteData(ip: string): TowerDataPoint[] {
  return readSiteData(ip); // already normalized
}
