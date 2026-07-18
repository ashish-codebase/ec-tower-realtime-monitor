import net from 'net';
import { SensorDataPoint } from '@/types';

const PORT = 50311;
const TOTAL_TIMEOUT_MS = 60000; // 60s — matches Python download_data.py

// Semaphore: limit concurrent tower connections (matches Python's MAX_PARALLEL=10)
let activeConnections = 0;
const MAX_CONCURRENT = 10;

async function acquireSemaphore(): Promise<void> {
  while (activeConnections >= MAX_CONCURRENT) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  activeConnections++;
}

function releaseSemaphore(): void {
  activeConnections--;
}

export async function fetchTowerData(ip: string): Promise<SensorDataPoint[]> {
  await acquireSemaphore();
  try {
    return await new Promise<SensorDataPoint[]>((resolve, reject) => {
      const client = net.createConnection({ port: PORT, host: ip }, () => {
        // Tower responds with sensor data when:
        // - HTTP/1.0 (not 1.1)
        // - Host header includes ip:port
        const request = `GET / HTTP/1.0\r\nHost: ${ip}:${PORT}\r\n\r\n`;
        client.write(request);
      });

      const chunks: Buffer[] = [];
      let oldTimestamp = '';

      client.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
        
        // Match Python logic: stop when new timestamp detected
        const text = chunk.toString('utf-8');
        const lines = text.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
            try {
              const parsed = JSON.parse(trimmed);
              for (const [sensorNum, value] of Object.entries(parsed)) {
                if (typeof value === 'object' && value !== null && 'data' in value) {
                  const dataArr = (value as { data: unknown[] }).data;
                  if (Array.isArray(dataArr) && dataArr.length >= 2) {
                    const timestamp = String(dataArr[1]);
                    if (oldTimestamp !== '' && oldTimestamp !== timestamp) {
                      // New timestamp detected — stop receiving (matches Python logic)
                      cleanup();
                      const raw = Buffer.concat(chunks).toString('utf-8');
                      const points = parseTowerResponse(raw);
                      resolve(points || []);
                      return;
                    }
                    oldTimestamp = timestamp;
                  }
                }
              }
            } catch {
              // skip malformed JSON
            }
          }
        }
      });

      // 60s timeout — matches Python's DATA_TIMEOUT
      const timer = setTimeout(() => {
        cleanup();
        const raw = Buffer.concat(chunks).toString('utf-8');
        const points = parseTowerResponse(raw);
        resolve(points || []);
      }, TOTAL_TIMEOUT_MS);

      client.on('end', () => {
        cleanup();
        const raw = Buffer.concat(chunks).toString('utf-8');
        const points = parseTowerResponse(raw);
        resolve(points || []);
      });

      client.on('error', (err) => {
        cleanup();
        reject(err);
      });

      function cleanup() {
        clearTimeout(timer);
        client.destroy();
      }
    });
  } finally {
    releaseSemaphore();
  }
}

function parseTowerResponse(raw: string): SensorDataPoint[] | null {
  // Strip HTTP headers if present (up to first \r\n\r\n)
  const headerEnd = raw.indexOf('\r\n\r\n');
  let body = raw;
  if (headerEnd !== -1) {
    body = raw.substring(headerEnd + 4);
  }

  // Tower sends nested JSON format:
  // {"1":{"data":["CK-00638",1783652880,{"61":0.387},{"63":13.5},...]}}
  // {"0":{"data":["CK-00640",1783652880,{"22":-4e-06},{"23":-7e-06},...]}}
  const points: SensorDataPoint[] = [];

  const lines = body.split('\n');
  for (const line of lines) {
    let trimmed = line.trim();
    if (!trimmed) continue;

    // Find the end of valid JSON by tracking brace depth
    const jsonEnd = findJsonEnd(trimmed);
    if (jsonEnd === -1) continue;

    const jsonStr = trimmed.substring(0, jsonEnd);
    try {
      const parsed = JSON.parse(jsonStr);
      // Format: {"sensorNum":{"data":[name,timestamp,{reading1},{reading2},...]}}
      for (const [sensorNum, value] of Object.entries(parsed)) {
        if (typeof value === 'object' && value !== null && 'data' in value) {
          const dataArr = (value as { data: unknown[] }).data;
          if (Array.isArray(dataArr) && dataArr.length >= 3) {
            const name = String(dataArr[0]);
            const timestamp = Number(dataArr[1]);
            const readings: { [key: string]: number }[] = [];
            for (let i = 2; i < dataArr.length; i++) {
              const item = dataArr[i] as { [key: string]: number };
              if (typeof item === 'object' && item !== null) {
                readings.push(item);
              }
            }
            points.push({ sensor: sensorNum, name, timestamp, readings });
          }
        }
      }
    } catch {
      // skip malformed lines
    }
  }

  if (points.length === 0) return null;
  return points;
}

// Find the end of a valid JSON object by tracking brace depth
function findJsonEnd(str: string): number {
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = 0; i < str.length; i++) {
    const ch = str[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (ch === '\\' && inString) {
      escape = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (ch === '{') depth++;
    if (ch === '}') {
      depth--;
      if (depth === 0) return i + 1;
    }
  }

  return -1; // no complete JSON object found
}
