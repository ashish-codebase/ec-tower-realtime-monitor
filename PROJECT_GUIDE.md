# EC Tower Live Monitor — Full Project Guide

> **Purpose**: Real-time dashboard for monitoring multiple eddy covariance (EC) tower sites. Built with Next.js, React, Chart.js, and Tailwind CSS. Connects to EC towers via TCP (port 50111), parses half-hourly sensor data, and displays time-series charts grouped by sensor type.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Project Structure](#project-structure)
3. [Step-by-Step Setup](#step-by-step-setup)
4. [Architecture Overview](#architecture-overview)
5. [Data Flow](#data-flow)
6. [Configuration](#configuration)
7. [Components Reference](#components-reference)
8. [API Routes Reference](#api-routes-reference)
9. [Libraries Reference](#libraries-reference)
10. [Running Tests](#running-tests)
11. [Deployment](#deployment)
12. [Troubleshooting](#troubleshooting)

---

## Prerequisites

| Requirement      | Version | Notes                                             |
| ---------------- | ------- | ------------------------------------------------- |
| Node.js          | 18+     | Required for Next.js 14 App Router                |
| npm              | latest  | Used for dependency management                    |
| Network access   | —       | Must reach EC tower IPs on port **50111**         |
| Redis (optional) | —       | For in-memory caching across serverless functions |

---

## Project Structure

```
EC_Tower_Live_React/
│
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── api/
│   │   │   ├── sites/route.ts        # GET — List configured sites from CSV
│   │   │   ├── data/[...path]/route.ts  # GET — Serve data JSON (Redis fallback)
│   │   │   ├── fetch/route.ts        # GET — Trigger manual TCP fetch from all towers
│   │   │   ├── fetch/status/route.ts # GET — Check if fetch is in progress
│   │   │   ├── admin/clear-redis/route.ts  # POST — Flush Redis DB (auth-protected)
│   │   │   ├── poll-status/route.ts  # GET — Poll status endpoint
│   │   │   └── cache-control/route.ts # GET/POST — Cache control
│   │   ├── layout.tsx                # Root layout + metadata
│   │   ├── page.tsx                  # Dashboard entry (polling via cron → /api/fetch)
│   │   └── globals.css               # Tailwind + CSS variables for theming
│   │
│   ├── components/
│   │   ├── Dashboard.tsx             # Main dashboard (stateful, orchestrates everything)
│   │   ├── SiteSelector.tsx          # Radio-button site picker with status icons
│   │   ├── TimeSeriesChart.tsx       # Chart.js line charts grouped by sensor type
│   │   ├── StatsTable.tsx            # Statistics table (min/max/mean/count/duration)
│   │   ├── ErrorBanner.tsx           # Pulsing red error alert
│   │   └── ThemeToggle.tsx           # Dark/light theme switcher with localStorage
│   │
│   ├── lib/
│   │   ├── tcp.ts                    # TCP client to EC towers (port 50111)
│   │   ├── storage.ts               # JSON file read/write (./data/)
│   │   ├── redis.ts                 # Redis client wrapper (read/write/append)
│   │   ├── poller.ts                # Background auto-polling service (every 5 min)
│   │   ├── columnRegistry.ts        # Dynamic column tracking across all towers
│   │   ├── fetchState.ts            # In-memory fetch-in-progress flag
│   │   ├── settings.ts              # Sensor group definitions + Jenks classes
│   │   ├── clusterGroups.ts         # Build K-means cluster groups from settings
│   │   ├── timestampConverter.ts    # Unix seconds+nanoseconds → ISO string
│   │   └── chart-init.ts            # Register Chart.js components once
│   │
│   ├── hooks/
│   │   └── useSiteData.ts           # React hook for fetching site data
│   │
│   └── types/
│       └── index.ts                 # TypeScript interfaces (Site, TowerDataPoint, etc.)
│
├── backend/                          # DEPRECATED - removed 2025
│   ├── server.js                     # [DEPRECATED] Was Express server on port 3001
│   ├── scheduler.js                  # [DEPRECATED] Was fetch scheduler
│   └── package.json                  # No longer used
│
├── data/                             # Tower data files (auto-created, NDJSON format)
│
├── scripts/
│   ├── generate-sensor-groups.js     # K-means clustering → generates settings.ts
│   └── test-k-values.js              # Test different K values for clustering
│
├── python/                           # Python reference implementation
│   ├── download_data.py              # Parallel TCP fetch (port 50111) → CSV
│   ├── build_daqm.py                 # Parse EC data into DataFrames
│   └── timestamp_converter.js        # Timestamp conversion utility
│
├── tests/
│   └── setup.ts                      # Vitest/JSDOM setup (matchMedia mock)
│
├── src/lib/__tests__/
│   ├── tcp.test.ts                   # Unit: module exports
│   ├── settings.test.ts              # Unit: sensor groups structure
│   └── data-consistency.test.ts      # Integration: backend API checks
│
├── site_name_ip_address.csv          # Site config (name, IP per line)
├── .env.local                        # Environment variables (Redis URL, admin secret)
├── package.json                      # Dependencies + scripts
├── tsconfig.json                     # TypeScript config
├── next.config.js                    # Next.js config (default export)
├── tailwind.config.ts                # Tailwind config
├── postcss.config.js                 # PostCSS plugins
├── vitest.config.ts                  # Vitest test config
└── .gitignore                        # Git ignore rules
```

---

## Step-by-Step Setup

### Step 1: Clone / Copy Project

```bash
# On the new machine, copy or clone the project directory
cp -r /path/to/EC_Tower_Live_React ~/EC_Tower_Live_React
cd ~/EC_Tower_Live_React
```

### Step 2: Install Dependencies

```bash
npm install
```

This installs:

- **Runtime**: `next`, `react`, `react-dom`, `chart.js`, `react-chartjs-2`, `redis`, `date-fns`, `ml-kmeans`
- **Dev**: `typescript`, `tailwindcss`, `vitest`, `@testing-library/react`, `jsdom`

### Step 3: Configure Sites

Edit `site_name_ip_address.csv` — one site per line, comma-separated:

```csv
SiteName,IP_ADDRESS
Baggs,107.89.240.97
Boulder,166.230.26.67
Cora,166.230.26.70
```

Default sites included:

| Site      | IP              |
| --------- | --------------- |
| Baggs     | 107.89.240.97   |
| Boulder   | 166.230.26.67   |
| Cora      | 166.230.26.70   |
| Cortez    | 166.165.240.230 |
| Farson    | 107.89.242.214  |
| FtBridger | 166.157.227.78  |
| Gunnison  | 72.250.43.146   |
| LaPlata   | 166.165.240.231 |
| NAPI      | 166.250.164.223 |
| Olathe    | 166.163.141.138 |

### Step 4: Configure Environment Variables

Create `.env.local` (or `.env`):

```env
# Redis URL (optional — for serverless caching)
REDIS_URL=redis://your-redis-host:6379

# Admin secret for Redis reset endpoint (optional)
ADMIN_SECRET=your-secret-here
```

### Step 5: (Optional) Load Historical Data

To pre-load data from the Python project's JSON files:

```bash
mkdir -p data
cp ../166_*.json ./data/
# Or rename: 166_230_26_70.json → data/166_230_26_70.json
```

Data files use **NDJSON** format (one JSON object per line):

```json
{"timestamp":1783538100000,"type":"sonic","U":2.3,"V":-0.5,"W":0.01,"TEMP":25.4,...}
{"timestamp":1783538100000,"type":"daqm","TA_1_1_1":22.1,"RH_1_1_1":45.3,...}
```

### Step 6: Start Development Server

```bash
npm run dev
```

Server starts at **http://localhost:3000**.

### Step 7: Verify

1. Open http://localhost:3000
2. Check error banner — should be clean
3. Click **"Fetch Now"** to pull data from towers
4. Charts should appear grouped by sensor type
5. Toggle dark/light theme

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (React UI)                       │
│  ┌──────────┐ ┌──────────────┐ ┌──────────┐ ┌──────────────┐   │
│  │Dashboard │ │SiteSelector  │ │Charts    │ │StatsTable    │   │
│  └────┬─────┘ └──────┬───────┘ └────┬─────┘ └──────┬───────┘   │
└───────┼───────────────┼──────────────┼──────────────┼───────────┘
        │               │              │              │
        │  fetch('/api/sites')         │              │
        │  fetch('/api/data/...')      │              │
        │  fetch('/api/fetch')         │              │
        │                              │              │
        ▼                              ▼              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Next.js API Routes (Server)                   │
│  ┌────────────┐ ┌──────────────────┐ ┌──────────────────────┐  │
│  │ /api/sites │ │ /api/data/[...]/ │ │ /api/fetch           │  │
│  │ → CSV file │ │ → Redis or JSON  │ │ → TCP proxy → Tower  │  │
│  └────────────┘ └──────────────────┘ └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
        │                              │
        │         ┌────────────────────┼────────────────────┐
        ▼         ▼                    ▼                    ▼
   ┌─────────┐  ┌──────┐      ┌──────────────┐  ┌──────────────┐
   │Redis DB │  │./data│      │ EC Tower TCP │  │ JSON files   │
   │(optional)│  │/*.json│      │ Port 50111   │  │ NDJSON       │
   └─────────┘  └──────┘      └──────────────┘  └──────────────┘
```

**Key design decisions:**

- Browser cannot do raw TCP → Next.js API route proxies TCP connections
- Data cached in Redis (serverless) or JSON files (on-disk)
- Background poller auto-fetches every 5 minutes
- Sensor groups defined in `settings.ts` using K-means clustering

---

## Data Flow

### 1. Site Discovery

```
page.tsx → fetch('/api/sites') → reads site_name_ip_address.csv → returns [{name, ip}]
```

### 2. Manual / Scheduled Fetch

```
Dashboard.tsx → fetch('/api/fetch') OR Cron → route.ts → tcp.ts → net.createConnection(port:50111)
    ↓
Tower responds with tab-separated DATASONIC/DATADAQM rows
    ↓
parseEcData() → resampleSonicTo1Min() → combine sonic+daqm → TowerDataPoint[]
    ↓
appendSiteDataToRedis(ip, data)  → Redis key: site:{ip}
appendSiteData(ip, data)         → JSONL file: data/{sanitized_ip}.json
```

### 3. Data Loading for Display

```
Dashboard.tsx → fetch(`/api/data/${siteName}.json?refresh=true`)
    ↓
data/[...path]/route.ts → readSiteDataFromRedis(ip)
    ↓ (if Redis empty)
    → readFile('data/{sanitized_ip}.json')
    ↓
→ addReadableTimestamps() → JSON response with timestamp_readable + timestamp_utc
    ↓
→ Dashboard sets state → TimeSeriesChart renders
```

### 4. Scheduled Fetching (via Cron)

```
Cron job → GET /api/fetch (port 3000) → route.ts → tcp.ts → net.createConnection(port:50111)
    ↓
every 5 minutes:
    Promise.allSettled(sites.map(site => fetchTowerData(site.ip)))
    ↓
store to Redis + JSON file (deduped, capped at 2880 points = 24h @ 5min)
```

### 5. Parsing Logic (tcp.ts)

```
Raw TCP response:
  HTTP headers (stripped)
  DATASONIC\tSECONDS\tNANOSECONDS\tDIAG\tU\tV\tW\tTEMP\tSOS\t...
  DATADAQMH\t<column headers>
  DATADAQM\tSECONDS\tNANOSECONDS\t<values per column>
  DATADAQM\tSECONDS\tNANOSECONDS\t<values per column>    ← second timestamp = stop signal

Steps:
  1. Strip HTTP headers (up to \r\n\r\n)
  2. Parse DATASONIC rows → collect sonic data
  3. Parse DATADAQMH row → register column names in ColumnRegistry
  4. Parse DATADAQM rows → map values to column names
  5. Resample sonic to 1-minute averages (group by minute, calculate mean)
  6. Combine sonic + daqm, sort by timestamp
  7. Return TowerDataPoint[]
```

---

## Configuration

### Fetch Interval

**Controlled by cron job** — set to run every 5 minutes:

```bash
*/5 * * * * curl -s http://localhost:3000/api/fetch > /dev/null 2>&1
```

### Max Data Points (per site)

**File**: `src/lib/storage.ts`

```typescript
const MAX_POINTS = 2880; // 24 hours @ 5-min intervals
```

### Chart Time Axis

**File**: `src/components/TimeSeriesChart.tsx`

```typescript
// X-axis unit auto-scales: hour / day based on data range
time: { unit: 'hour', ... }
```

### TCP Timeout

**File**: `src/lib/tcp.ts`

```typescript
const PORT = 50111;
const TOTAL_TIMEOUT_MS = 180000; // 3 minutes
```

### Concurrent Connections (Semaphore)

**File**: `src/lib/tcp.ts`

```typescript
const MAX_CONCURRENT = 10; // Matches Python's MAX_PARALLEL=10
```

### Data Cache TTL

**File**: `src/app/api/data/[...path]/route.ts`

```typescript
const CACHE_TTL = 30000; // 30 seconds
const MAX_REQUESTS_PER_SECOND = 5;
```

### Sensor Groups (Display)

**File**: `src/lib/settings.ts` — 18 sensor groups with Jenks classes:
| Group | Keys | Jenks Class |
|-------|------|-------------|
| Wind (U, V, W) | U, V, W | 0 |
| Air Temperature | TA_1_1_1 | 1 |
| Relative Humidity | RH_1_1_1 | 2 |
| Soil Temperature (×9) | TS_1_1_1 … TS_9_1_1 | 3 |
| Thermistor | THERMISTOR_1_1_1 | 4 |
| Soil Moisture (×6) | SWC_1_1_1 … SWC_6_1_1 | 5 |
| Relay Status (×3) | Relay_1_1_1 … | 6 |
| Heat Flux (×3) | SHF_1_1_1 … | 7 |
| Heat Flux Sensor (×3) | SHFSENS_1_1_1 … | 8 |
| Shortwave Radiation | SWIN, SWOUT | 9 |
| Longwave Radiation | LWIN, LWOUT | 10 |
| Net Radiation | RN_1_1_1 | 11 |
| Albedo | ALB_1_1_1 | 12 |
| PAR (PPFD) | PPFD_1_1_1 | 13 |
| Rain | P_RAIN_1_1_1 | 14 |
| Battery Voltage | DRM_V_BATTERY_1_1_1 | 15 |
| Main Voltage | DRM_V_MAIN_1_1_1 | 16 |
| Power Status | DRM_POWER_STATUS_1_1_1 | 17 |

### CSS Theme Variables

**File**: `src/app/globals.css`

Light mode (default):

```css
--bg-primary: #ffffff; --text-primary: #1a1a2e; --chart-line: #4361ee;
```

Dark mode:

```css
--bg-primary: #1a1a2e; --text-primary: #eaeaea; --chart-line: #60a5fa;
```

---

## Components Reference

### Dashboard.tsx

**Role**: Main orchestrator component. Manages site selection, data loading, fetching, and renders all sub-components.

**State**:

- `sites` — list of configured sites from `/api/sites`
- `selectedIp` — currently selected site IP
- `data` — TowerDataPoint[] for the selected site
- `loading`, `error`, `fetching` — UI state flags
- `lastFetchTime` — timestamp of last fetch
- `siteStatuses` — per-site status: `'live' | 'no-data' | 'not-found' | 'checking'`

**Key methods**:

- `loadData()` — fetch data from `/api/data/{siteName}.json`
- `handleFetch()` — trigger `/api/fetch`, poll `/api/fetch/status` until done
- `handleResetRedis()` — POST to `/api/admin/clear-redis`

### SiteSelector.tsx

**Role**: Radio-button group for site selection. Shows status icons (🟢 live, 🔴 no-data, ⚪ not-found, 🔄 checking).

### TimeSeriesChart.tsx

**Role**: Renders Chart.js line charts. Groups data by sensor key + type (sonic/daqm). Uses time axis with `chartjs-adapter-date-fns`.

**Props**: `data`, `sensorKeys`, `title`, `timeRange`

### StatsTable.tsx

**Role**: Displays statistics table per sensor key. Columns: ID, Key, Count, Min, Max, Mean, Class, Duration.

### ErrorBanner.tsx

**Role**: Pulsing red banner showing connection errors. Auto-dismiss on close.

### ThemeToggle.tsx

**Role**: Dark/light toggle. Persists choice in `localStorage('ec-theme')`. Respects `prefers-color-scheme` on first visit.

---

## API Routes Reference

### GET `/api/sites`

Returns configured sites from CSV.

```json
{ "sites": [{ "name": "Baggs", "ip": "107.89.240.97" }, ...] }
```

### GET `/api/data/{siteName}.json`

Returns data for a site. Checks Redis first, falls back to JSON file.

- Query params: `?refresh=true` (bypass cache), `?limit=N&offset=M` (pagination)
- Response: JSON array of TowerDataPoint objects with added `timestamp_readable` and `timestamp_utc` fields

### GET `/api/fetch`

Triggers manual TCP fetch from all configured towers. Returns immediately with `{ status: 'running' }`, then processes in background.

```json
{ "status": "ok", "results": [...], "ok": 5, "fail": 2 }
```

### GET `/api/fetch/status`

Returns current fetch state.

```json
{ "fetchInProgress": false }
```

### POST `/api/admin/clear-redis`

Flushes entire Redis database. Auth-protected via `ADMIN_SECRET` Bearer token.

```json
{ "success": true, "message": "Redis database flushed successfully", "testKey": "verified" }
```

---

## Libraries Reference

### tcp.ts — TCP Client

Connects to EC towers on port 50111 using Node.js `net.Socket`. Sends HTTP/1.0 request, collects tab-separated data, stops when second DAQM timestamp appears (matches Python behavior). Implements semaphore for max 10 concurrent connections.

**Key exports**: `fetchTowerData(ip: string, siteName?: string): Promise<TowerDataPoint[]>`

### storage.ts — File Storage

Reads/writes NDJSON files in `./data/`. Deduplicates by `timestamp_type` key. Caps at 2880 points (oldest dropped).

**Key exports**: `readSiteData(ip)`, `appendSiteData(ip, newPoints)`

### redis.ts — Redis Client

Wrapper around `@redis/client`. Keys: `site:{ip}`. Supports read, save, and append-with-dedup.

**Key exports**: `readSiteDataFromRedis(ip)`, `saveSiteDataToRedis(ip, points)`, `appendSiteDataToRedis(ip, newPoints)`

### poller.ts — Background Polling (deprecated)

Previously started on server boot from `page.tsx`. Now deprecated — fetching is handled by cron job hitting `/api/fetch`.

**Key exports**: `startPolling(sites)`, `stopPolling()`

### columnRegistry.ts — Dynamic Column Tracking

Collects all unique DAQM columns across all towers. Each tower may have different columns. Missing columns get NaN values.

**Key exports**: `columnRegistry` (singleton), `getAllDaqmColumns()`, `siteHasColumn(site, column)`

### timestampConverter.ts

Converts Unix seconds + nanoseconds to ISO string.

**Key export**: `timestampToUTC(seconds, nanoseconds): string`

---

## Running Tests

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# With coverage report
npm run test:coverage
```

**Test files**:

- `src/lib/__tests__/tcp.test.ts` — Unit: verifies tcp module exports
- `src/lib/__tests__/settings.test.ts` — Unit: verifies sensor group structure, unique names, valid jenksClass
- `src/lib/__tests__/data-consistency.test.ts` — Integration: checks backend API endpoints (requires `BACKEND_URL`)

---

## Deployment

### Development

```bash
npm run dev    # Starts on port 3000
```

### Production Build

```bash
npm run build   # Creates .next/ optimized build
npm start       # Runs production server on port from .env or 3000
```

### Vercel Deployment

1. Push to GitHub
2. Connect repo to Vercel
3. Set environment variables in Vercel dashboard
4. Deploy — Next.js auto-builds

**Note**: Poller is disabled during Vercel build (`isBuildTime` check). Manual fetch via `/api/fetch` works in production.

### Scheduled Fetching (Cron)

Set up a cron job to ping the Next.js server every 5 minutes:

```bash
*/5 * * * * curl -s http://localhost:3000/api/fetch > /dev/null 2>&1
```

This triggers data fetching via `/api/fetch` and keeps the server alive. No separate backend needed.

---

## Troubleshooting

| Problem                        | Solution                                                                      |
| ------------------------------ | ----------------------------------------------------------------------------- |
| "No data loaded yet"           | Click "Fetch Now". Check tower IPs are reachable (`telnet <IP> 50111`)        |
| Connection errors on all sites | Verify network access to tower IPs on port **50111** (not 50311)              |
| Charts not showing data        | Check browser console for parse errors. Verify data files exist in `./data/`  |
| Redis connection fails         | Set `REDIS_URL` in `.env.local`. App falls back to JSON file storage          |
| Data not fetching              | Cron job should hit /api/fetch every 5 min. Check cron logs on your host.     |
| Data not updating              | Redis may have stale data. Use "Reset Redis" button or clear manually         |
| Port 3000 already in use       | Change port: `next dev -p 3001`                                               |
| Tests failing                  | Ensure `@testing-library/jest-dom` is installed. Check `tests/setup.ts` mocks |

### Common TCP Issues

- Tower takes >3 min to respond → increase `TOTAL_TIMEOUT_MS` in `tcp.ts`
- Too many concurrent connections → reduce `MAX_CONCURRENT` in `tcp.ts`
- Data not parsing correctly → check column alignment between DAQM header and data rows

---

## Regenerating Sensor Groups

If tower columns change, regenerate sensor group settings:

```bash
node scripts/generate-sensor-groups.js data/your_data_file.json
```

This runs K-means clustering on actual data and writes new `settings.ts` with optimized sensor groups.

---

*Generated from EC_Tower_Live_React project analysis.*
