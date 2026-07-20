# EC Tower Live Monitor

Real-time eddy covariance tower data monitoring system with FastAPI backend and React frontend.

## Overview

This project fetches, stores, and serves eddy covariance (EC) tower data from multiple sites. The backend connects to EC towers via TCP, parses raw data streams, stores data in Redis and JSON files, and exposes REST APIs. The frontend visualizes the data using Chart.js and Plotly.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React + Vite)                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────────┐    │
│  │ Chart.js │  │ Plotly   │  │ DaisyUI  │  │ React State   │    │
│  └──────────┘  └──────────┘  └──────────┘  └───────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │ REST API
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Backend (FastAPI)                           │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌──────────┐   │
│  │ TCP Client │  │ Data Parser│  │  Storage   │  │ API      │   │
│  │            │  │            │  │ (Redis +   │  │ Endpoints│   │
│  │ :50111     │  │ EC Data    │  │  JSON)     │  │          │   │
│  └────────────┘  └────────────┘  └────────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     External Systems                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │ EC Tower 1   │  │ EC Tower 2   │  │ EC Tower N           │   │
│  │ 192.168.1.10 │  │ 192.168.1.11 │  │ 192.168.1.N          │   │
│  └──────────────┘  └──────────────┘  └──────────────────────┘   │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐                             │
│  │   Redis      │  │  JSON Files  │                             │
│  │  localhost   │  │  ./data/     │                             │
│  └──────────────┘  └──────────────┘                             │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow

1. **Fetch**: Backend connects to EC towers via TCP on port `50111`
2. **Parse**: Raw data is parsed into structured format:
   - Sonic data (U, V, W, TEMP, etc.) resampled to 1-minute intervals
   - DAQM data averaged in pairs and combined with sonic data
3. **Store**: Data stored in Redis (fast access) and JSON files (persistence)
4. **Serve**: REST API serves data to frontend with optional 5-minute resampling

## Project Structure

```
├── backend/
│   ├── app.py               # FastAPI main application
│   ├── tcp_client.py        # TCP connection and data parsing
│   ├── storage.py           # JSON file storage layer
│   ├── redis_store.py       # Redis storage layer
│   ├── column_registry.py   # Tracks columns from all towers
│   ├── sensor_settings.py   # Sensor group definitions
│   ├── requirements.txt     # Python dependencies
│   └── .env.example         # Environment variable template
├── frontend/
│   ├── src/
│   │   ├── main.tsx         # React entry point
│   │   └── ...              # React components and utilities
│   ├── index.html           # HTML template
│   ├── package.json         # Node dependencies
│   ├── vite.config.ts       # Vite configuration
│   ├── tailwind.config.js   # Tailwind CSS config
│   └── tsconfig.json        # TypeScript config
├── data/                    # JSON data storage directory
├── site_name_ip_address.csv # Site configurations
└── README.md                # This file
```

## Installation

### Prerequisites

- Python 3.11+
- Node.js 18+
- Redis (optional, for fast in-memory storage)

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment (optional)
cp .env.example .env
# Edit .env to set REDIS_URL if using Redis
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Configure (optional)
# Edit .env.local for API proxy settings
```

## Configuration

### Site Configuration

Edit `site_name_ip_address.csv` to add/remove towers:

```csv
site_name,ip_address
# Comments start with #
SY-TP1,192.168.1.10
SY-TP2,192.168.1.11
```

### Backend Environment Variables

| Variable       | Default                    | Description               |
| -------------- | -------------------------- | ------------------------- |
| `BACKEND_HOST` | `0.0.0.0`                  | Host to bind the server   |
| `BACKEND_PORT` | `8000`                     | Port to run the server on |
| `REDIS_URL`    | `redis://localhost:6379/0` | Redis connection URL      |

### Frontend Environment Variables

Create `.env.local` in `frontend/`:

```bash
# API proxy (optional, for development)
VITE_API_BASE_URL=http://localhost:8000
```

## Running the Application

### Start Backend

```bash
cd backend
python app.py
# Or with uvicorn directly:
uvicorn app:app --host 0.0.0.0 --port 8000
```

Backend starts on `http://localhost:8000`

### Start Frontend

```bash
cd frontend
npm run dev
```

Frontend starts on `http://localhost:5173`

## API Endpoints

### GET `/api/sites`

List all configured sites.

**Response:**

```json
[
  {
    "name": "SY-TP1",
    "ip": "192.168.1.10"
  }
]
```

### GET `/api/fetch`

Trigger a manual data fetch from all towers.

**Response:**

```json
{
  "status": "started"
}
```

### GET `/api/fetch/status`

Check if a fetch is currently in progress.

**Response:**

```json
{
  "in_progress": false
}
```

### GET `/api/data/{site_ip}`

Get stored data for a site.

**Query Parameters:**

- `resample_5min` (boolean, optional): Resample to 5-minute intervals

**Response:**

```json
[
  {
    "timestamp": 1700000000000,
    "U": 3.2,
    "V": -0.5,
    "W": 0.1,
    "TEMP": 15.3,
    ...
  }
]
```

### POST `/api/cache-control/clear`

Clear cached data.

**Query Parameters:**

- `site_ip` (string, optional): Clear only this site's data

**Response:**

```json
{
  "status": "cleared",
  "site": "192.168.1.10"
}
```

### GET `/api/columns`

Get column registry (all columns from all towers).

**Query Parameters:**

- `site_name` (string, optional): Filter to specific tower

**Response:**

```json
{
  "allColumns": ["SECONDS", "NANOSECONDS", "U", "V", "W", ...],
  "towerColumns": {
    "SY-TP1": ["U", "V", "W", "TEMP", ...],
    "SY-TP2": ["U", "V", "W", "TEMP", ...]
  }
}
```

### GET `/api/sensor-groups`

Get sensor group settings for visualization.

**Response:**

```json
{
  "sensorGroups": [
    {
      "name": "Wind (U, V, W)",
      "keys": ["U", "V", "W"]
    },
    {
      "name": "Air Temperature (TA)",
      "keys": ["TA_1_1_1"]
    },
    ...
  ],
  "allDaqmColumns": ["SECONDS", "NANOSECONDS", "U", ...]
}
```

### GET `/api/poll-status`

Get polling status information.

**Response:**

```json
{
  "message": "Polling is active (every 5 min)",
  "interval": "5 minutes"
}
```

### GET `/api/health`

Health check endpoint.

**Response:**

```json
{
  "status": "ok"
}
```

## Data Parsing Details

### Sonic Data (DATASONIC)

Raw sonic anemometer data with fields:

- `SECONDS`, `NANOSECONDS`: Timestamp
- `DIAG`: Diagnostic flag
- `U`, `V`, `W`: Wind components (m/s)
- `SOS`: Speed of sound (m/s)
- `TEMP`: Air temperature (°C)
- `AIN1-AIN4`: Auxiliary analog inputs
- `CHK`: Checksum

Sonic data is resampled to 1-minute intervals by averaging.

### DAQM Data (DATADAQMH/DATADAQM)

Raw data logger data with:

- Header row (`DATADAQMH`) defines column names
- Data rows (`DATADAQM`) contain measurements
- Consecutive pairs are averaged
- Timestamps converted from seconds+nanoseconds to milliseconds

### Combined Output

Sonic and DAQM data are combined, sorted by timestamp, and deduplicated (multiple readings at same millisecond are averaged).

## Storage

### Redis (Optional)

Fast in-memory storage for recent data. Each site's data is stored as a JSON array under key `site:{ip}`.

**Advantages:**

- Fast reads/writes
- No disk I/O
- Automatic expiration (if configured)

**Disadvantages:**

- Data lost on restart (unless persisted)
- Requires Redis server

### JSON Files (Required)

Persistent storage in `data/` directory. Each site gets a file named `{ip_with_underscores}.json`.

**Advantages:**

- Persistent across restarts
- No external dependencies
- Easy to inspect/debug

**Disadvantages:**

- Slower than Redis
- File locking required for concurrent writes

## Frontend Features

- **Real-time updates**: Fetches data on interval (default 5 minutes)
- **Multiple chart types**: Line charts (Chart.js) and scatter plots (Plotly)
- **Sensor groups**: Pre-configured groupings for common analyses:
  - Wind components (U, V, W)
  - Air temperature
  - Relative humidity
  - Soil temperature (multiple depths)
  - Soil moisture (multiple depths)
  - Heat flux
  - Radiation (SWIN, SWOUT, LWIN, LWOUT, PPFD)
  - Net radiation
  - Albedo
  - Rainfall
- **Responsive design**: DaisyUI components for mobile/desktop
- **Data resampling**: Optional 5-minute averaging for large datasets

## Development

### Backend Development

```bash
# Run with auto-reload
uvicorn app:app --reload --host 0.0.0.0 --port 8000

# Access API docs
# http://localhost:8000/docs
```

### Frontend Development

```bash
# Run with hot reload
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Testing

Test the API without a live tower:

```bash
# Trigger fetch (will fail if no towers configured)
curl http://localhost:8000/api/fetch

# Check status
curl http://localhost:8000/api/fetch/status

# Get data for a site
curl http://localhost:8000/api/data/192.168.1.10
```

## Deployment

### Production Backend

```bash
# Install dependencies
pip install -r requirements.txt

# Run with gunicorn (recommended)
gunicorn app:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000

# Or with systemd (Linux)
# See backend/deploy/README.md for systemd setup
```

### Production Frontend

```bash
npm run build

# Serve the dist/ directory with any static file server
# Example with nginx:
# location / {
#     root /path/to/frontend/dist;
#     try_files $uri $uri/ /index.html;
# }
```

### Docker (Recommended)

See `docker/` directory for Dockerfile and docker-compose setup.

## Troubleshooting

### Backend won't start

- Check Python version (3.11+)
- Verify dependencies installed: `pip install -r requirements.txt`
- Check port availability: `netstat -an | grep 8000`

### Frontend won't start

- Check Node.js version (18+)
- Clear npm cache: `npm cache clean --force`
- Reinstall dependencies: `rm -rf node_modules && npm install`

### TCP connection fails

- Verify tower IP in `site_name_ip_address.csv`
- Check network connectivity: `ping {tower_ip}`
- Verify tower is listening on port 50111: `telnet {tower_ip} 50111`
- Check firewall rules

### Redis connection fails

- Start Redis server: `redis-server`
- Verify URL in `.env`: `REDIS_URL=redis://localhost:6379/0`
- Check Redis is running: `redis-cli ping` (should return PONG)

### No data returned

- Trigger manual fetch: `GET /api/fetch`
- Check fetch status: `GET /api/fetch/status`
- Verify towers are configured in CSV
- Check backend logs for errors

## Performance Notes

- **Concurrent connections**: Limited to 10 simultaneous TCP connections (`MAX_CONCURRENT`)
- **Timeouts**: 60s total, 30s per chunk read
- **Memory**: Redis stores all data in memory; JSON files on disk
- **Resampling**: 5-min resampling reduces data volume by ~12x

## Security Considerations

- **CORS**: Currently allows all origins (`*`). Restrict in production.
- **Authentication**: Not implemented. Add JWT or API keys for production.
- **Network**: EC towers should be on private network. Use VPN or firewall.
- **Data**: Sensitive tower data should be encrypted at rest and in transit.

## License

See LICENSE file.

## Contact

For issues or questions, open an issue on GitHub.
