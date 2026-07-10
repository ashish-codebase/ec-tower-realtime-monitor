# EC Tower Live Monitor (React/Next.js)

Real-time dashboard for monitoring eddy covariance tower sites. Built with Next.js, React, Chart.js, and Tailwind CSS.

## Features

- **Multi-site monitoring**: Connect to multiple EC tower sites simultaneously
- **Background polling**: Auto-fetches data every 5 minutes from all towers
- **Time-series charts**: Chart.js with time axis showing sensor readings
- **Site selector**: Radio buttons to switch between monitored sites
- **Dark/Light theme**: Toggle with persistence via localStorage
- **Error banner**: Pulsing red alert for connection failures
- **Statistics table**: Min, max, mean, count, and duration per sensor key
- **Manual fetch**: Button to trigger immediate data pull from all towers

## Quick Start

```bash
cd EC_Tower_Live_React
npm install
npm run dev
```

Open http://localhost:3000

## Setup

### 1. Configure sites

Edit `site_name_ip_address.csv` — one line per site, comma-separated (name, IP):

```csv
Baggs,107.89.240.97
Boulder,166.230.26.67
```

### 2. Copy data files (optional)

To load existing data from the Python project:

```bash
cp ../166_*.json ./data/
# Or rename: 166_230_26_70.json → data/166_230_26_70.json
```

### 3. Start server

```bash
npm run dev    # Development (localhost:3000)
npm run build  # Production build
npm start      # Run production build
```

## Architecture

```
EC Tower (TCP:50311)
    ↓
Next.js API route → TCP proxy (Node net.Socket)
    ↓
JSON files in ./data/ (same NDJSON format)
    ↓
React frontend (App Router + Chart.js)
```

**Key difference from Python version**: Browser can't do raw TCP. A lightweight Next.js backend proxies TCP connections while serving the React frontend.

## Configuration

| Setting         | Location                             | Default  | Description                  |
| --------------- | ------------------------------------ | -------- | ---------------------------- |
| Poll interval   | `src/lib/poller.ts`                  | 5 min    | Seconds between auto-fetches |
| Chart window    | `src/components/TimeSeriesChart.tsx` | 24 hours | Data shown in charts         |
| Max data points | `src/lib/storage.ts`                 | 10,000   | Circular buffer per site     |
| HTTP port       | `.env` or `next.config.js`           | 3000     | Development server port      |

## Project Structure

```
EC_Tower_Live_React/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── sites/route.ts       # List configured sites
│   │   │   ├── data/[...path]/route.ts  # Serve data JSON files
│   │   │   └── fetch/route.ts       # Trigger manual TCP fetch
│   │   ├── layout.tsx               # Root layout + CSS import
│   │   ├── page.tsx                 # Dashboard entry + poller init
│   │   └── globals.css              # Tailwind + theme variables
│   ├── components/
│   │   ├── Dashboard.tsx            # Main dashboard component
│   │   ├── SiteSelector.tsx         # Radio button site picker
│   │   ├── TimeSeriesChart.tsx      # Chart.js line charts
│   │   ├── StatsTable.tsx           # Statistics table
│   │   ├── ErrorBanner.tsx          # Connection error display
│   │   └── ThemeToggle.tsx          # Dark/light theme switcher
│   ├── lib/
│   │   ├── tcp.ts                   # TCP connection to towers
│   │   ├── storage.ts               # JSON file read/write
│   │   └── poller.ts                # Background polling service
│   └── types/
│       └── index.ts                 # TypeScript interfaces
├── data/                            # Tower data files (auto-created)
├── site_name_ip_address.csv         # Site configuration
├── package.json
├── tailwind.config.ts
├── tsconfig.json
└── next.config.js
```

## Data Format

Same NDJSON format as Python version:

```json
{"sensor":"1","name":"CK-00639","timestamp":1783538100,"readings":[{"34":0.213},{"36":19.6}]}
```

## Requirements

- Node.js 18+ (for Next.js 14 App Router)
- Network access to EC tower IPs on port 50311
