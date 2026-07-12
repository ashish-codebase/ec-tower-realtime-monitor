import fs from 'fs';
import path from 'path';
import { SensorDataPoint } from '@/types';

const DATA_DIR = path.join(process.cwd(), 'data');

export function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function getFilePath(ip: string): string {
  return path.join(DATA_DIR, `${ip.replace(/\./g, '_')}.json`);
}

export function readSiteData(ip: string): SensorDataPoint[] {
  const filePath = getFilePath(ip);
  if (!fs.existsSync(filePath)) return [];

  const content = fs.readFileSync(filePath, 'utf-8');
  const points: SensorDataPoint[] = [];

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      points.push(JSON.parse(trimmed));
    } catch {
      // skip malformed
    }
  }

  return points;
}

export function appendSiteData(ip: string, newPoints: SensorDataPoint[]) {
  if (newPoints.length === 0) return;

  const filePath = getFilePath(ip);
  const existing = readSiteData(ip);
  const seenKeys = new Set<string>();

  for (const p of existing) {
    for (const r of p.readings || []) {
      Object.keys(r).forEach((k) => {
        seenKeys.add(`${p.sensor}_${p.timestamp}_${k}`);
      });
    }
  }

  const deduped = newPoints.filter((p) => {
    for (const r of p.readings || []) {
      const key = `${p.sensor}_${p.timestamp}_${Object.keys(r)[0]}`;
      if (!seenKeys.has(key)) return true;
    }
    return false;
  });

  if (deduped.length === 0) return;

  const fd = fs.openSync(filePath, 'a');
  for (const point of deduped) {
    fs.writeSync(fd, JSON.stringify(point) + '\n');
  }
  fs.closeSync(fd);

  // Keep max 2880 points (circular buffer - oldest gets replaced)
  const MAX_POINTS = 2880;
  const updated = readSiteData(ip);
  if (updated.length > MAX_POINTS) {
    const kept = updated.slice(-MAX_POINTS);
    fs.writeFileSync(filePath, kept.map((p) => JSON.stringify(p)).join('\n') + '\n');
    console.log(`[Storage] Trimmed ${ip} from ${updated.length} to ${kept.length} points`);
  }
}

export function readAllSiteData(ip: string): SensorDataPoint[] {
  return readSiteData(ip);
}
