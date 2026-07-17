import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

// Throttle to limit requests per second per file
const lastRequestTimes = new Map<string, number>();
const MAX_REQUESTS_PER_SECOND = 5;

// Simple in-memory cache for data files
const dataCache = new Map<string, { content: string; timestamp: number }>();
const CACHE_TTL = 30000; // 30 seconds cache TTL

async function getDataFileFromFileSystem(sitePath: string) {
  try {
    const filePath = path.join(process.cwd(), 'data', `${sitePath}.json`);
    const content = await fs.readFile(filePath, 'utf-8');
    return content;
  } catch (error) {
    return null;
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

  // Check cache first
  const cacheKey = `data_${ipFile}`;
  const cached = dataCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`[VercelData] Cache hit for ${ipFile}: Returning ${cached.content.length} bytes`);
    return new Response(cached.content, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60'
      }
    });
  }

  try {
    // Try to get data from file system first
    let content = await getDataFileFromFileSystem(ipFile);
    
    // If not found in file system, try to proxy to backend
    if (!content) {
      const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';
      const backendUrl = `${BACKEND_URL}/api/data/${ipFile}`;
      
      console.log(`[VercelData] Proxying to: ${backendUrl}`);
      
      const res = await fetch(backendUrl, {
        signal: AbortSignal.timeout(5000) // 5s timeout for proxy
      });
      
      if (!res.ok) {
        throw new Error(`Backend returned ${res.status}`);
      }
      
      content = await res.text();
    }
    
    if (!content) {
      return NextResponse.json({ error: 'No data available' }, { status: 404 });
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
    console.error(`[DEBUG] Error fetching ${ipFile}:`, msg);
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
