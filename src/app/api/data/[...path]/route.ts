import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { readSiteDataFromRedis } from '@/lib/redis';

// Throttle to limit requests per second per file
const lastRequestTimes = new Map<string, number>();
const MAX_REQUESTS_PER_SECOND = 5;

// Simple in-memory cache for data files
const dataCache = new Map<string, { content: string; timestamp: number }>();
const CACHE_TTL = 30000; // 30 seconds cache TTL

async function getDataFileFromFileSystem(sitePath: string) {
  try {
    const fileName = sitePath.endsWith('.json') ? sitePath : `${sitePath}.json`;
    const filePath = path.join(process.cwd(), 'data', fileName);
    const content = await fs.readFile(filePath, 'utf-8');
    return content;
  } catch (error) {
    return null;
  }
}

async function loadSitesFromCsv() {
  try {
    const csvPath = path.join(process.cwd(), 'site_name_ip_address.csv');
    const content = await fs.readFile(csvPath, 'utf-8');
    const sites = [];
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const [name, ip] = trimmed.split(',').map((s) => s.trim());
      if (name && ip) sites.push({ name, ip });
    }
    return sites;
  } catch (err) {
    return [];
  }
}

// Convert Unix timestamps to readable ISO strings for debugging
function addReadableTimestamps(content: string): string {
  try {
    const data = JSON.parse(content);
    if (Array.isArray(data)) {
      const transformed = data.map(point => ({
        ...point,
        timestamp_readable: new Date(point.timestamp * 1000).toISOString(),
        timestamp_utc: new Date(point.timestamp * 1000).toISOString().replace('T', ' ').replace('Z', ' UTC')
      }));
      return JSON.stringify(transformed, null, 2);
    }
    return content;
  } catch (e) {
    return content;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const resolved = await params;
  const [ipFile] = resolved.path;

  if (!ipFile) {
    return NextResponse.json({ error: 'No data file specified' }, { status: 400 });
  }

  // Throttle requests per second for each file
  const now = Date.now();
  const lastTime = lastRequestTimes.get(ipFile) || 0;
  if (now - lastTime < 1000 / MAX_REQUESTS_PER_SECOND) {
    console.warn(`[VercelData] Rate limit exceeded for ${ipFile}`);
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }
  lastRequestTimes.set(ipFile, now);

  // Normalize and cache by file name
  const normalizedFile = ipFile.endsWith('.json') ? ipFile : `${ipFile}.json`;
  const cacheKey = `data_${normalizedFile}`;
  const cached = dataCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`[VercelData] Cache hit for ${normalizedFile}: Returning ${cached.content.length} bytes`);
    return new Response(cached.content, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60'
      }
    });
  }

  try {
    const normalizedFile = ipFile.endsWith('.json') ? ipFile : `${ipFile}.json`;
    const siteName = normalizedFile.replace(/\.json$/, '');
    const sites = await loadSitesFromCsv();
    const site = sites.find((entry) => entry.name === siteName);
    const ip = site?.ip;

    let content: string | null = null;

    if (ip) {
      const redisData = await readSiteDataFromRedis(ip);
      if (redisData && redisData.length > 0) {
        const limit = Number(request.nextUrl.searchParams.get('limit')) || redisData.length;
        const offset = Number(request.nextUrl.searchParams.get('offset')) || 0;
        const paginated = redisData.slice(offset, offset + limit);
        content = JSON.stringify(paginated);
        console.log(`[VercelData] Redis hit for ${siteName} (${ip}), ${paginated.length} points`);
      }
    }

    if (!content) {
      content = await getDataFileFromFileSystem(normalizedFile);
    }

    if (!content) {
      console.warn(`[VercelData] No data found for ${siteName} (${ip || 'unknown ip'}) in Redis or local file`);
      return new Response(JSON.stringify([]), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60'
        }
      });
    }
    
    // Add readable timestamps for debugging
    const transformedContent = addReadableTimestamps(content);
    
    // Cache the response
    dataCache.set(cacheKey, {
      content: transformedContent,
      timestamp: Date.now()
    });
    
    console.log(`[VercelData] Returning ${transformedContent.length} bytes for ${ipFile}`);
    
    return new Response(transformedContent, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60'
      }
    });
    
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[DEBUG] Error fetching ${ipFile}:`, error);
    return NextResponse.json({ error: `Failed to fetch data: ${msg}` }, { status: 502 });
  }
}

// Clean up old cache entries periodically
if (typeof globalThis.setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    const entries = Array.from(dataCache.entries());
    for (const [key, value] of entries) {
      if (now - value.timestamp > CACHE_TTL * 2) {
        dataCache.delete(key);
      }
    }
  }, 120000); // Clean up every 2 minutes
}
