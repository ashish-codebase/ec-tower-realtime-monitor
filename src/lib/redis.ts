import { createClient, type RedisClientType } from 'redis';
import { SensorDataPoint } from '@/types';

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

export async function readSiteDataFromRedis(ip: string): Promise<SensorDataPoint[] | null> {
  const client = await initRedisClient();
  if (!client) return null;

  try {
    const raw = await client.get(getRedisKey(ip));
    if (!raw) return null;
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : null;
  } catch (err) {
    console.error('[Redis] read error:', err);
    return null;
  }
}

export async function saveSiteDataToRedis(ip: string, points: SensorDataPoint[]): Promise<void> {
  const client = await initRedisClient();
  if (!client) return;

  try {
    await client.set(getRedisKey(ip), JSON.stringify(points));
  } catch (err) {
    console.error('[Redis] save error:', err);
  }
}

export async function appendSiteDataToRedis(ip: string, newPoints: SensorDataPoint[]): Promise<void> {
  if (newPoints.length === 0) return;
  const client = await initRedisClient();
  if (!client) return;

  try {
    const raw = await client.get(getRedisKey(ip));
    const existing: SensorDataPoint[] = raw ? JSON.parse(raw) : [];
    const seenKeys = new Set<string>();

    for (const point of existing) {
      for (const reading of point.readings || []) {
        Object.keys(reading).forEach((key) => {
          seenKeys.add(`${point.sensor}_${point.timestamp}_${key}`);
        });
      }
    }

    const deduped = newPoints.filter((point) => {
      for (const reading of point.readings || []) {
        const key = `${point.sensor}_${point.timestamp}_${Object.keys(reading)[0]}`;
        if (!seenKeys.has(key)) {
          return true;
        }
      }
      return false;
    });

    if (deduped.length === 0) return;

    const combined = [...existing, ...deduped].slice(-2880);
    await client.set(getRedisKey(ip), JSON.stringify(combined));
  } catch (err) {
    console.error('[Redis] append error:', err);
  }
}
