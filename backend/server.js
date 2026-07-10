const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const net = require('net');
const scheduler = require('./scheduler');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Handle OPTIONS preflight
app.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.status(200).send();
});

// In-memory data store: { ip: SensorDataPoint[] }
const dataStore = new Map();

// Load site config
function loadSites() {
  const csvPath = path.join(__dirname, '..', 'site_name_ip_address.csv');
  if (!fs.existsSync(csvPath)) return [];

  const content = fs.readFileSync(csvPath, 'utf-8');
  const sites = [];
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [name, ip] = trimmed.split(',').map(s => s.trim());
    if (name && ip) sites.push({ name, ip });
  }
  return sites;
}

// TCP fetcher (same logic as src/lib/tcp.ts)
const PORT_TOWER = 50311;
const TOTAL_TIMEOUT_MS = 30000;

function fetchTowerData(ip) {
  return new Promise((resolve, reject) => {
    const client = net.createConnection({ port: PORT_TOWER, host: ip }, () => {
      const request = `GET / HTTP/1.0\r\nHost: ${ip}:${PORT_TOWER}\r\n\r\n`;
      client.write(request);
    });

    const chunks = [];
    client.on('data', (chunk) => chunks.push(chunk));

    const timer = setTimeout(() => {
      cleanup();
      const raw = Buffer.concat(chunks).toString('utf-8');
      resolve(parseTowerResponse(raw));
    }, TOTAL_TIMEOUT_MS);

    client.on('end', () => {
      cleanup();
      const raw = Buffer.concat(chunks).toString('utf-8');
      resolve(parseTowerResponse(raw));
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
}

function parseTowerResponse(raw) {
  const headerEnd = raw.indexOf('\r\n\r\n');
  let body = raw;
  if (headerEnd !== -1) {
    body = raw.substring(headerEnd + 4);
  }

  const points = [];
  const lines = body.split('\n');

  for (const line of lines) {
    let trimmed = line.trim();
    if (!trimmed) continue;

    const jsonEnd = findJsonEnd(trimmed);
    if (jsonEnd === -1) continue;

    const jsonStr = trimmed.substring(0, jsonEnd);
    try {
      const parsed = JSON.parse(jsonStr);
      for (const [sensorNum, value] of Object.entries(parsed)) {
        if (typeof value === 'object' && value !== null && 'data' in value) {
          const dataArr = value.data;
          if (Array.isArray(dataArr) && dataArr.length >= 3) {
            const name = String(dataArr[0]);
            const timestamp = Number(dataArr[1]);
            const readings = [];
            for (let i = 2; i < dataArr.length; i++) {
              const reading = dataArr[i];
              if (typeof reading === 'object' && reading !== null) {
                for (const [key, val] of Object.entries(reading)) {
                  readings.push({ [key]: Number(val) });
                }
              }
            }
            points.push({
              timestamp,
              sensor: name,
              readings
            });
          }
        }
      }
    } catch (e) {
      // skip malformed JSON
    }
  }

  return points;
}

function findJsonEnd(str) {
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = 0; i < str.length; i++) {
    const char = str[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (char === '\\') {
      escape = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (char === '{' || char === '[') depth++;
    if (char === '}' || char === ']') {
      depth--;
      if (depth === 0) return i + 1;
    }
  }

  return -1;
}

// Routes

app.get('/api/sites', (req, res) => {
  const sites = loadSites();
  res.json({ sites });
});

let fetchInProgress = false;

app.post('/api/fetch', async (req, res) => {
  console.log('[API] POST /api/fetch received');
  
  if (fetchInProgress) {
    return res.json({ message: 'Fetch already in progress', status: 'running' });
  }

  fetchInProgress = true;
  console.log('[API] Manual fetch triggered');

  // Fire and forget - don't wait for completion
  const sites = loadSites();
  const results = [];

  const fetchPromise = Promise.allSettled(
    sites.map(async (site) => {
      try {
        const data = await fetchTowerData(site.ip);
        dataStore.set(site.ip, data);
        return { name: site.name, ip: site.ip, status: 'ok', count: data.length };
      } catch (err) {
        return { name: site.name, ip: site.ip, status: 'error', error: err.message, count: 0 };
      }
    })
  ).then(results => {
    fetchInProgress = false;
    return results;
  });

  // Return immediately with status
  res.json({ message: 'Fetch started', status: 'running' });

  // Wait for completion in background
  fetchPromise.then(results => {
    const ok = results.filter(r => r.status === 'fulfilled' && r.value.status === 'ok').length;
    const fail = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && r.value.status === 'error')).length;
    console.log(`[API] Fetch complete: ${ok} ok, ${fail} failed`);
  }).catch(err => {
    fetchInProgress = false;
    console.error('[API] Fetch error:', err.message);
  });
});

// Also handle GET for compatibility
app.get('/api/fetch', (req, res) => {
  res.json({ message: 'Use POST method', status: 'error' });
});

app.get('/api/data/:ip.json', (req, res) => {
  const ip = req.params.ip;
  const data = dataStore.get(ip);
  if (!data) {
    return res.json({ error: 'No data for this site. Run /api/fetch first.' });
  }
  res.json(data);
});

app.get('/api/status', (req, res) => {
  const sites = loadSites();
  const status = sites.map(site => ({
    name: site.name,
    ip: site.ip,
    hasData: dataStore.has(site.ip),
    pointCount: dataStore.get(site.ip)?.length || 0
  }));
  res.json({ 
    status, 
    lastFetch: scheduler.lastFetchTime,
    fetchInProgress 
  });
});

// Start scheduler (fetches every 30 seconds)
scheduler.start(loadSites, fetchTowerData, dataStore);

app.listen(PORT, () => {
  console.log(`EC Tower backend running on port ${PORT}`);
});
