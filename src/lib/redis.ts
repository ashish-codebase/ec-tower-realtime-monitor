import { createClient, type RedisClientType } from 'redis';
import { TowerDataPoint } from '@/types';
import { resampleTo5Min } from './resample';

const REDIS_URL = process.env.REDIS_URL || process.env.ec_live_db_REDIS_URL;
let redisClient: RedisClientType | null = null;
let redisConnected = false;

function getRedisKey(ip: string) {
  return `site:${ip}`;
}

async function initRedisClient(): Promise<RedisClientType | null> {
  if (!REDIS_URL) {
    return null;
  }

  if (redisConnected && redisClient && redisClient.isOpen) {
    return redisClient;
  }

  if (!redisClient) {
    redisClient = createClient({ url: REDIS_URL });
    redisClient.on('error', (err: unknown) => {
      console.error('[Redis] Client error:', err);
    });
  }

  try {
    if (!redisClient.isOpen) {
      await redisClient.connect();
    }
    redisConnected = true;
    return redisClient;
  } catch (err) {
    console.error('[Redis] connect error:', err);
    return null;
  }
}

// Normalize timestamp: if < 1e12 it's seconds, convert to milliseconds
function normalizeTs(ts: number): number {
  if (typeof ts !== 'number' || ts > 1e12) return ts;
  return ts * 1000;
}

export async function readSiteDataFromRedis(ip: string): Promise<TowerDataPoint[] | null> {
  const client = await initRedisClient();
  if (!client) return null;

  try {
    const raw = await client.get(getRedisKey(ip));
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return null;
    // Normalize any seconds timestamps to milliseconds
    return data.map(p => ({ ...p, timestamp: normalizeTs(p.timestamp) }));
  } catch (err) {
    console.error('[Redis] read error:', err);
    return null;
  }
}

export async function saveSiteDataToRedis(ip: string, points: TowerDataPoint[]): Promise<void> {
  const client = await initRedisClient();
  if (!client) return;

  try {
    await client.set(getRedisKey(ip), JSON.stringify(points));
  } catch (err) {
    console.error('[Redis] save error:', err);
  }
}

export async function appendSiteDataToRedis(ip: string, newPoints: TowerDataPoint[]): Promise<void> {
  if (newPoints.length === 0) return;
  const client = await initRedisClient();
  if (!client) return;

  // Downsample to 5-min intervals before storing
  const resampled = resampleTo5Min(newPoints);

  try {
    const raw = await client.get(getRedisKey(ip));
    let existing: TowerDataPoint[] = raw ? JSON.parse(raw) : [];
    // Normalize existing timestamps (fix old seconds→ms)
    existing = existing.map(p => ({ ...p, timestamp: normalizeTs(p.timestamp) }));
    const seenKeys = new Set<string>();

    for (const point of existing) {
      seenKeys.add(`${point.timestamp}`);
    }

    const deduped = resampled.filter((point) => {
      const key = `${point.timestamp}`;
      return !seenKeys.has(key);
    });

    if (deduped.length === 0) return;

    const combined = [...existing, ...deduped].slice(-2880);
    await client.set(getRedisKey(ip), JSON.stringify(combined));
  } catch (err) {
    console.error('[Redis] append error:', err);
  }
}
