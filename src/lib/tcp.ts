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
        const request = `GET / HTTP/1.0\r\nHost: ${ip}:${PORT}\r\n\r\n`;
        client.write(request);
      });

      const chunks: Buffer[] = [];
      let oldTimestamp = '';

      client.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
        
        const text = chunk.toString('utf-8');
        const lines = text.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          
          const parts = trimmed.split('\t');
          if (parts[0] === 'DATADAQM' && parts.length >= 3) {
            const timestamp = parts[1];
            if (oldTimestamp === '') {
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
  
  // Parse DAQM data — collect header and all rows
  let daqmHeader: string[] = [];
  interface RawDaqmRow {
    SECONDS: number;
    NANOSECONDS: number;
    [columnName: string]: number;
  }
  const rawDaqmRows: RawDaqmRow[] = [];
  let lastSonicTimestamp: number | null = null;
  
  for (const row of parsedRows) {
    if (row[0] === 'DATADAQMH') {
      daqmHeader = row.slice(1);
      columnRegistry.addTowerColumns(siteName, daqmHeader);
      console.log(`[TCP] DAQM header (first 5): ${daqmHeader.slice(0, 5).join(', ')}`);
    } else if (row[0] === 'DATADAQM') {
      const data = row.slice(1);
      const daqmRow: any = {
        SECONDS: Number(data[0]) || 0,
        NANOSECONDS: Number(data[1]) || 0,
      };
      for (let j = 2; j < data.length; j++) {
        if (daqmHeader[j - 2]) {
          const value = Number(data[j]);
          daqmRow[daqmHeader[j - 2]] = isNaN(value) ? NaN : value;
        }
      }
      rawDaqmRows.push(daqmRow);
    } else if (row[0] === 'DATASONIC') {
      const sonicData = row.slice(1);
      lastSonicTimestamp = new Date(timestampToUTC(Number(sonicData[0]) || 0, Number(sonicData[1]) || 0)).getTime();
    }
  }
  
  // Average DAQM rows with same SECONDS timestamp (two readings per half-hour → one averaged point)
  const daqmByTimestamp = new Map<number, RawDaqmRow[]>();
  for (const row of rawDaqmRows) {
    const tsKey = row.SECONDS;
    if (!daqmByTimestamp.has(tsKey)) {
      daqmByTimestamp.set(tsKey, []);
    }
    daqmByTimestamp.get(tsKey)!.push(row);
  }
  
  const averagedDaqm: RawDaqmRow[] = [];
  for (const [tsKey, rows] of daqmByTimestamp) {
    if (rows.length === 1) {
      averagedDaqm.push(rows[0]);
    } else {
      // Average all rows with same timestamp
      const avg: any = { SECONDS: tsKey, NANOSECONDS: 0 };
      for (const col of daqmHeader) {
        const sum = rows.reduce((s, r) => s + (typeof r[col] === 'number' ? r[col] : 0), 0);
        avg[col] = sum / rows.length;
      }
      averagedDaqm.push(avg);
    }
  }
  
  // Track last sonic timestamp for DAQM assignment
  let daqmSonicTs: number | null = null;
  for (const row of parsedRows) {
    if (row[0] === 'DATASONIC') {
      const sonicData = row.slice(1);
      daqmSonicTs = new Date(timestampToUTC(Number(sonicData[0]) || 0, Number(sonicData[1]) || 0)).getTime();
    }
  }
  
  // Combine sonic and averaged daqm data into single array (no type field)
  const combined: TowerDataPoint[] = [];
  
  // Add sonic data (resampled to 1-min)
  for (const row of sonicResampled) {
    const timestampMs = new Date(timestampToUTC(row.SECONDS, row.NANOSECONDS || 0)).getTime();
    const { SECONDS: _, NANOSECONDS: __, ...rest } = row;
    combined.push({ timestamp: timestampMs, ...rest });
  }
  
  // Add averaged daqm data
  for (const row of averagedDaqm) {
    const timestampMs = daqmSonicTs || 0;
    const { SECONDS: _, NANOSECONDS: __, ...rest } = row;
    combined.push({ timestamp: timestampMs, ...rest });
  }
  
  // Sort by timestamp
  combined.sort((a, b) => a.timestamp - b.timestamp);
  return combined;
}

function resampleSonicTo1Min(sonicRows: { SECONDS: number; NANOSECONDS: number; [key: string]: number }[]): any[] {
  if (sonicRows.length === 0) return [];
  
  const minuteGroups = new Map<number, typeof sonicRows[number][]>();
  
  for (const row of sonicRows) {
    const ms = row.SECONDS * 1000 + Math.floor(row.NANOSECONDS / 1000000);
    const minuteMs = Math.floor(ms / 60000) * 60000;
    
    if (!minuteGroups.has(minuteMs)) {
      minuteGroups.set(minuteMs, []);
    }
    minuteGroups.get(minuteMs)!.push(row);
  }
  
  const resampled: any[] = [];
  
  for (const [minuteMs, rows] of minuteGroups) {
    const avg: any = {
      SECONDS: Math.floor(minuteMs / 1000),
      NANOSECONDS: 0,
    };
    
    for (const key of Object.keys(rows[0])) {
      if (key !== 'SECONDS' && key !== 'NANOSECONDS') {
        avg[key] = rows.reduce((sum, r) => sum + (r[key] || 0), 0) / rows.length;
      }
    }
    
    resampled.push(avg);
  }
  
  resampled.sort((a, b) => a.SECONDS - b.SECONDS);
  return resampled;
}
