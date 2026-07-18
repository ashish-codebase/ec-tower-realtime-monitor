import net from 'net';
import { TowerDataPoint } from '@/types';
import { columnRegistry } from './columnRegistry';
import { timestampToUTC } from './timestampConverter';

const PORT = 50111; // Matches Python download_data.py
const TOTAL_TIMEOUT_MS = 180000; // 180s — 3 min to catch second DAQM row

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

export async function fetchTowerData(ip: string, siteName: string = 'unknown'): Promise<TowerDataPoint[]> {
  await acquireSemaphore();
  try {
    return await new Promise<TowerDataPoint[]>((resolve, reject) => {
      const client = net.createConnection({ port: PORT, host: ip }, () => {
        // Tower responds with tab-separated data when:
        // - HTTP/1.0 (not 1.1)
        // - Host header includes ip:port
        const request = `GET / HTTP/1.0\r\nHost: ${ip}:${PORT}\r\n\r\n`;
        client.write(request);
      });

      const chunks: Buffer[] = [];
      let oldTimestamp = '';

      client.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
        
        // Match Python logic: stop when SECOND DATADAQM timestamp appears
        const text = chunk.toString('utf-8');
        const lines = text.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          
          const parts = trimmed.split('\t');
          if (parts[0] === 'DATADAQM' && parts.length >= 3) {
            const timestamp = parts[1];
            if (oldTimestamp === '') {
              // First DAQM timestamp — record it
              oldTimestamp = timestamp;
              console.log(`[TCP] First DAQM timestamp: ${timestamp}`);
            } else if (oldTimestamp !== timestamp) {
              // Second DAQM timestamp with different value — stop!
              console.log(`[TCP] Second DAQM timestamp: ${timestamp} (first was: ${oldTimestamp}) — stopping`);
              cleanup();
              const raw = Buffer.concat(chunks).toString('utf-8');
              const points = parseEcData(raw, siteName);
              resolve(points);
              return;
            }
          }
        }
      });

      // 60s timeout — matches Python's DATA_TIMEOUT
      const timer = setTimeout(() => {
        cleanup();
        const raw = Buffer.concat(chunks).toString('utf-8');
        const points = parseEcData(raw, siteName);
        resolve(points);
      }, TOTAL_TIMEOUT_MS);

      client.on('end', () => {
        cleanup();
        const raw = Buffer.concat(chunks).toString('utf-8');
        const points = parseEcData(raw, siteName);
        resolve(points);
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

function parseEcData(raw: string, siteName: string): TowerDataPoint[] {
  // Strip HTTP headers if present (up to first \r\n\r\n)
  const headerEnd = raw.indexOf('\r\n\r\n');
  let body = raw;
  if (headerEnd !== -1) {
    body = raw.substring(headerEnd + 4);
  }

  const rows = body.split('\n').map(line => line.trim()).filter(line => line);
  const parsedRows = rows.map(row => row.split('\t'));
  
  // Count row types for debugging
  const rowTypeCount = new Map<string, number>();
  for (const row of parsedRows) {
    if (row[0]) {
      rowTypeCount.set(row[0], (rowTypeCount.get(row[0]) || 0) + 1);
    }
  }
  console.log(`[TCP] Row types: ${JSON.stringify(Object.fromEntries(rowTypeCount))}`);
  
  // Parse sonic data
  const sonicRows: { SECONDS: number; NANOSECONDS: number; [key: string]: number }[] = [];
  
  for (const row of parsedRows) {
    if (row[0] === 'DATASONIC') {
      const data = row.slice(1);
      const sonicRow: any = {
        SECONDS: Number(data[0]) || 0,
        NANOSECONDS: Number(data[1]) || 0,
        DIAG: Number(data[2]) || 0,
        U: Number(data[3]) || 0,
        V: Number(data[4]) || 0,
        W: Number(data[5]) || 0,
        SOS: Number(data[6]) || 0,
        TEMP: Number(data[7]) || 0,
        AIN1: Number(data[8]) || 0,
        AIN2: Number(data[9]) || 0,
        AIN3: Number(data[10]) || 0,
        AIN4: Number(data[11]) || 0,
        CHK: Number(data[12]) || 0,
      };
      sonicRows.push(sonicRow);
    }
  }
  
  // Resample sonic data to 1-minute intervals
  const sonicResampled = resampleSonicTo1Min(sonicRows);
  
  // Parse DAQM data — track order in raw stream for timestamp assignment
  let daqmHeader: string[] = [];
  interface DaqmWithOrder {
    row: any;
    orderIndex: number;
    lastSonicTs: number | null;
  }
  const daqmWithOrder: DaqmWithOrder[] = [];
  let daqmCount = 0;
  let lastSonicTimestamp: number | null = null;
  
  console.log(`[TCP] Total parsed rows: ${parsedRows.length}, sonic: ${sonicRows.length}, daqm header found: ${daqmHeader.length > 0}`);
  
  for (let i = 0; i < parsedRows.length; i++) {
    const row = parsedRows[i];
    if (row[0] === 'DATADAQMH') {
      daqmHeader = row.slice(1);
      // Register columns for this tower
      columnRegistry.addTowerColumns(siteName, daqmHeader);
      console.log(`[TCP] DAQM header (first 5): ${daqmHeader.slice(0, 5).join(', ')}`);
    } else if (row[0] === 'DATADAQM') {
      const data = row.slice(1);
      daqmCount++;
      // Debug: log first 2 DAQM rows with full context
      if (daqmCount <= 2) {
        console.log(`[TCP] DAQM row ${daqmCount}: total columns=${data.length}, first 10 = ${data.slice(0, 10).join(' | ')}`);
        console.log(`[TCP] DAQM row ${daqmCount}: SECONDS=${data[0]}, NANOSECONDS=${data[1]}`);
      }
      const daqmRow: any = {
        SECONDS: Number(data[0]) || 0,
        NANOSECONDS: Number(data[1]) || 0,
      };
      // Add remaining columns dynamically
      for (let j = 2; j < data.length; j++) {
        if (daqmHeader[j - 2]) {
          const value = Number(data[j]);
          // Use NaN for non-numeric or invalid values
          daqmRow[daqmHeader[j - 2]] = isNaN(value) ? NaN : value;
        }
      }
      daqmWithOrder.push({ row: daqmRow, orderIndex: i, lastSonicTs: lastSonicTimestamp });
    } else if (row[0] === 'DATASONIC') {
      // Update last sonic timestamp for subsequent DAQM rows
      const sonicData = row.slice(1);
      const sonicSeconds = Number(sonicData[0]) || 0;
      const sonicNanoseconds = Number(sonicData[1]) || 0;
      lastSonicTimestamp = new Date(timestampToUTC(sonicSeconds, sonicNanoseconds)).getTime();
    }
  }
  
  // Combine sonic and daqm data into single array
  const combined: TowerDataPoint[] = [];
  
  // Add sonic data (resampled to 1-min)
  for (const row of sonicResampled) {
    const timestampMs = new Date(timestampToUTC(row.SECONDS, row.NANOSECONDS || 0)).getTime();
    const { SECONDS: _, NANOSECONDS: __, ...rest } = row;
    combined.push({
      timestamp: timestampMs,
      type: 'sonic',
      ...rest,
    });
  }
  
  // Add daqm data — use stored sonic timestamp from stream order
  for (const { row, lastSonicTs } of daqmWithOrder) {
    const timestampMs = lastSonicTs || 0;
    const { SECONDS: _, NANOSECONDS: __, ...rest } = row;
    combined.push({
      timestamp: timestampMs,
      type: 'daqm',
      ...rest,
    });
  }
  
  // Sort by timestamp
  combined.sort((a, b) => a.timestamp - b.timestamp);
  return combined;
}

function resampleSonicTo1Min(sonicRows: { SECONDS: number; NANOSECONDS: number; [key: string]: number }[]): any[] {
  if (sonicRows.length === 0) return [];
  
  // Group by minute
  const minuteGroups = new Map<number, typeof sonicRows[number][]>();
  
  for (const row of sonicRows) {
    // Convert seconds + nanoseconds to milliseconds
    const ms = row.SECONDS * 1000 + Math.floor(row.NANOSECONDS / 1000000);
    const minuteMs = Math.floor(ms / 60000) * 60000;
    
    if (!minuteGroups.has(minuteMs)) {
      minuteGroups.set(minuteMs, []);
    }
    minuteGroups.get(minuteMs)!.push(row);
  }
  
  // Calculate averages for each minute
  const resampled: any[] = [];
  
  for (const [minuteMs, rows] of minuteGroups) {
    const avg: any = {
      SECONDS: Math.floor(minuteMs / 1000),
      NANOSECONDS: 0,
    };
    
    // Calculate averages for numeric fields
    for (const key of Object.keys(rows[0])) {
      if (key !== 'SECONDS' && key !== 'NANOSECONDS') {
        avg[key] = rows.reduce((sum, r) => sum + (r[key] || 0), 0) / rows.length;
      }
    }
    
    resampled.push(avg);
  }
  
  // Sort by timestamp
  resampled.sort((a, b) => a.SECONDS - b.SECONDS);
  return resampled;
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
