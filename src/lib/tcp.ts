import net from 'net';
import { TowerDataPoint } from '@/types';
import { columnRegistry } from './columnRegistry';
import { timestampToUTC } from './timestampConverter';

const PORT = 50111; // Matches Python download_data.py
const TOTAL_TIMEOUT_MS = 60000; // 60s — matches Python download_data.py timeout

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

      let raw = '';
      let daqmTimestampsSeen = 0;
      let firstDaqmTs = '';

      client.on('data', (chunk: Buffer) => {
        const text = chunk.toString('utf-8');
        const lines = text.split('\n');
        for (const line of lines) {
          const parts = line.trim().split('\t');
          if (parts[0] === 'DATADAQM') {
            const ts = parts[1];
            if (daqmTimestampsSeen === 0) {
              firstDaqmTs = ts;
              daqmTimestampsSeen = 1;
            } else if (ts !== firstDaqmTs && daqmTimestampsSeen === 1) {
              // Second different DAQM timestamp — include it, stop
              raw += line + '\n';
              cleanup();
              const points = parseEcData(raw, siteName);
              resolve(points);
              return;
            }
          }
          raw += line + '\n';
        }
      });

      const timer = setTimeout(() => {
        cleanup();
        const points = parseEcData(raw, siteName);
        resolve(points);
      }, TOTAL_TIMEOUT_MS);

      client.on('end', () => {
        cleanup();
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
  
  // Debug: show first 500 chars of body
  console.log(`[TCP] Body preview (${body.length} chars): ${JSON.stringify(body.substring(0, 500))}`);

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
      // row = ['DATADAQMH', 'SECONDS', 'NANOSECONDS', 'col1', 'col2', ...]
      // Skip SECONDS and NANOSECONDS — they're stored as timestamp fields, not column values
      daqmHeader = row.slice(3);
      columnRegistry.addTowerColumns(siteName, daqmHeader);
      console.log(`[TCP] DAQM header (first 5): ${daqmHeader.slice(0, 5).join(', ')}`);
    } else if (row[0] === 'DATADAQM') {
      const data = row.slice(1);
      // data = [SECONDS, NANOSECONDS, col1_value, col2_value, ...]
      // daqmHeader = [col1_name, col2_name, ...] (SECONDS/NANOSECONDS already excluded)
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
  
  // Average consecutive DAQM pairs (2 readings → 1 point, ~15 points per half-hour)
  const averagedDaqm: RawDaqmRow[] = [];
  for (let i = 0; i < rawDaqmRows.length; i += 2) {
    if (i + 1 < rawDaqmRows.length) {
      // Pair of rows — average
      const a = rawDaqmRows[i];
      const b = rawDaqmRows[i + 1];
      const avg: any = { SECONDS: Math.round((a.SECONDS + b.SECONDS) / 2), NANOSECONDS: 0 };
      for (const col of daqmHeader) {
        const vals = [a[col], b[col]].filter(v => typeof v === 'number' && !isNaN(v));
        if (vals.length > 0) avg[col] = vals.reduce((s, v) => s + v, 0) / vals.length;
      }
      averagedDaqm.push(avg);
    } else {
      // Odd row out — keep as-is
      averagedDaqm.push(rawDaqmRows[i]);
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
  
  // Add averaged daqm data — use each point's own SECONDS timestamp
  for (const row of averagedDaqm) {
    const timestampMs = new Date(timestampToUTC(row.SECONDS, 0)).getTime();
    const { SECONDS: _, NANOSECONDS: __, ...rest } = row;
    combined.push({ timestamp: timestampMs, ...rest });
  }
  
  // Sort by timestamp
  combined.sort((a, b) => a.timestamp - b.timestamp);

  // Final dedup: group all points by millisecond timestamp and average
  const pointsByMs = new Map<number, typeof combined[number][]>();
  for (const point of combined) {
    if (!pointsByMs.has(point.timestamp)) {
      pointsByMs.set(point.timestamp, []);
    }
    pointsByMs.get(point.timestamp)!.push(point);
  }

  const deduped: TowerDataPoint[] = [];
  for (const [ts, rows] of pointsByMs) {
    if (rows.length === 1) {
      deduped.push(rows[0]);
    } else {
      // Average all columns across rows with same timestamp
      const avg: TowerDataPoint = { timestamp: ts };
      // Collect all unique keys (except timestamp)
      const allKeys = new Set<string>();
      for (const r of rows) {
        for (const k of Object.keys(r)) {
          if (k !== 'timestamp') allKeys.add(k);
        }
      }
      for (const key of allKeys) {
        // Only average numeric values
        const numVals = rows
          .filter(r => typeof r[key] === 'number' && !isNaN(r[key] as number))
          .map(r => r[key] as number);
        if (numVals.length > 0) {
          avg[key] = numVals.reduce((s, v) => s + v, 0) / numVals.length;
        } else {
          // Keep first non-numeric value
          const nonNumeric = rows.find(r => r[key] !== undefined && typeof r[key] !== 'number');
          if (nonNumeric !== undefined) avg[key] = nonNumeric[key];
        }
      }
      deduped.push(avg);
    }
  }

  deduped.sort((a, b) => a.timestamp - b.timestamp);
  return deduped;
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
