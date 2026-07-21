# EC Tower Live Monitor — Frontend

A real-time dashboard for monitoring **eddy covariance (EC) tower** sensor data from multiple field sites. It fetches, visualizes, and displays environmental measurements (wind speed/direction, air/canopy/soil temperature, humidity, soil moisture, PAR, net radiation, etc.) from hardware sensors connected to meteorological towers.

---

## Tech Stack

| Layer                | Technology                   |
| -------------------- | ---------------------------- |
| Framework            | React 18 + TypeScript        |
| Build                | Vite 6                       |
| Styling              | Tailwind CSS + daisyUI       |
| Charts (time series) | Chart.js 4 + react-chartjs-2 |
| Charts (wind rose)   | Plotly.js + react-plotly.js  |
| Date adapter         | chartjs-adapter-date-fns     |

---

## Quick Start

```bash
# Install dependencies
npm install

# Start Vite dev server (HMR enabled)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

The frontend runs on `http://localhost:5173` and proxies API calls to the FastAPI backend on port 8000.

---

## Project Structure

```
frontend/
├── index.html                # Vite entry HTML
├── package.json              # Dependencies (React, Chart.js, Plotly, Tailwind, daisyUI)
├── tsconfig.json             # TypeScript config
├── vite.config.ts            # Vite config (proxy to backend)
├── tailwind.config.js        # Tailwind + daisyUI config
├── src/
│   ├── main.tsx              # Entry point — renders <App /> inside StrictMode
│   ├── index.css             # Global styles (Tailwind directives)
│   ├── App.tsx               # Root component — renders <Dashboard />
│   ├── types.ts              # TypeScript interfaces (Site, TowerDataPoint, SensorGroup, etc.)
│   ├── api.ts                # HTTP client functions (all /api/* calls)
│   ├── utils.ts              # Pure utilities (formatMstTime, getConversionMap, SENSOR_COLORS)
│   └── components/
│       ├── Dashboard.tsx           # Central hub — owns all state, tab navigation, data loading
│       ├── SiteSelector.tsx        # Site picker with live status indicators
│       ├── TimeSeriesChart.tsx     # Line charts per sensor group (Chart.js)
│       ├── WindRoseChart.tsx       # Polar scatter plot for wind direction/speed (Plotly.js)
│       ├── StatsTable.tsx          # Statistical summary table
│       ├── DataTable.tsx           # Paginated raw data table
│       ├── ErrorBanner.tsx         # Dismissable error alert
│       └── ThemeToggle.tsx         # Dark/light mode toggle (localStorage + prefers-color-scheme)
```

---

## Data Flow

```
main.tsx
  └─ App.tsx
       └─ Dashboard.tsx  ← owns all state, all API calls
            ├─ SiteSelector     → sends selectedIp back to Dashboard
            ├─ ThemeToggle      → toggles dark mode (no state shared)
            ├─ ErrorBanner      → displays Dashboard.error
            │
            ├─ Tab: Charts
            │    ├─ TimeSeriesChart(data, sensorKeys[], title) × N groups
            │    └─ WindRoseChart(data)          [rendered last]
            │
            ├─ Tab: Statistics
            │    └─ StatsTable(data, sensorGroups)
            │
            └─ Tab: Data Table
                 └─ DataTable(data)
```

---

## Dashboard State & Logic

**`Dashboard.tsx`** is the central hub. All state lives here — no Redux, no context, no custom hooks.

```
State: sites[], selectedIp, data[], sensorGroups[], loading, fetching, error, siteStatuses{}, activeTab
```

| Trigger            | Behavior                                                                         |
| ------------------ | -------------------------------------------------------------------------------- |
| **Mount**          | Fetches site list (`/api/sites`) + sensor groups (`/api/sensor-groups`) from API |
| **Site selection** | Loads data for that site via `getSiteData(ip)`                                   |
| **"Fetch Now"**    | Triggers backend data pull via TCP, polls `/api/fetch/status` every 2s           |
| **"Clear Cache"**  | Clears backend cache + resets local data state                                   |

Passes `data` down to all child components. Passes `sensorGroups` to `TimeSeriesChart` (one chart per group) and `StatsTable`.

---

## Sensor Groups

Sensor groups are defined in the **backend** (`backend/sensor_settings.py`) and served via `GET /api/sensor-groups`. Each group maps related sensor keys to a single chart.

| Group Name                   | Keys                                           | Description                                     |
| ---------------------------- | ---------------------------------------------- | ----------------------------------------------- |
| Wind (U, V, W)               | U, V, W                                        | 3D wind components                              |
| Air Temperature (TA)         | TA_1_1_1, TC_1_1_1, TEMP, TCNR4_C_1_1_1        | Air, canopy, sonic temp, CNR4 thermistor        |
| Relative Humidity (RH)       | RH_1_1_1                                       | Relative humidity                               |
| Soil Temperature (5 cm)      | TS 1,2,3,7,8,9                                 | Six sensors at 5 cm depth                       |
| Soil Temperature (20-60 cm)  | TS_4_1_1(20cm), TS_5_1_1(40cm), TS_6_1_1(60cm) | Vertical soil temp profile                      |
| Thermistor                   | THERMISTOR_1_1_1                               | General thermistor                              |
| Soil Moisture (SWC_*)        | SWC 1–6                                        | Volumetric water content                        |
| Relay Status                 | Relay 1,2,3                                    | Digital relay states                            |
| Heat Flux (SHF_*)            | SHF 1,2,3                                      | Heat flux plates                                |
| Heat Flux Sensor (SHFSENS_*) | SHFSENS 1,2,3                                  | Heat flux sensor readings                       |
| Radiation                    | SWIN, SWOUT, LWIN, LWOUT, PPFD                 | Shortwave/longwave radiation + PAR (PPFD ×0.51) |
| Net Radiation (RN)           | RN_1_1_1                                       | Net radiation                                   |
| Albedo (ALB)                 | ALB_1_1_1                                      | Albedo ratio                                    |
| Rain (P_RAIN)                | P_RAIN_1_1_1                                   | Precipitation                                   |
| DRM Power & Voltage          | DRM_V_MAIN, DRM_POWER_STATUS                   | Power system status                             |

---

## API Endpoints

**`api.ts`** → All HTTP calls to the FastAPI backend (`/api/*`):

| Function            | Endpoint                        | Used By                   |
| ------------------- | ------------------------------- | ------------------------- |
| `fetchSites()`      | `GET /api/sites`                | Dashboard (sites list)    |
| `triggerFetch()`    | `GET /api/fetch`                | Dashboard (fetch button)  |
| `getFetchStatus()`  | `GET /api/fetch/status`         | Dashboard (polling loop)  |
| `getSiteData(ip)`   | `GET /api/data/{ip}`            | Dashboard (load data)     |
| `clearCache(ip?)`   | `POST /api/cache-control/clear` | Dashboard (clear button)  |
| `getSensorGroups()` | `GET /api/sensor-groups`        | Dashboard (sensor config) |

---

## Component Details

### `TimeSeriesChart.tsx`

Renders one line chart per sensor group using **Chart.js**.

- Receives `data`, `sensorKeys[]`, `siteName`, and `title` from Dashboard.
- Handles PPFD conversion (×0.51) internally via `getConversionMap()`.
- Each sensor key gets a unique color from `SENSOR_COLORS`.
- **Timestamp filter**: Drops points with timestamps before Jan 1, 2023 (garbage epoch data).
- **Dynamic time axis**: Auto-selects hour/day/month granularity based on data span.
- Empty datasets are hidden from the chart area but kept in the legend (`hidden: true`).

### `WindRoseChart.tsx`

Polar scatter plot of wind direction vs speed using **Plotly.js**.

- Receives raw `data` from Dashboard.
- Converts U/V wind vectors to polar coordinates (speed = radius, compass direction = theta).
- Direction math: `theta = 90 - atan2(v,u)×180/π` → 0°=N, clockwise.
- Samples down to 2000 points for performance.
- Radial axis range is computed from actual max wind speed (capped at 20 m/s).
- Point size: 8px. Color gradient: blue (high speed) → yellow (low speed).

### `SiteSelector.tsx`

Custom button-based site picker (not native radio inputs — daisyUI CSS overrides suppress them). Shows live status indicators: 🟢 live, 🔴 no-data, ⚪ not-found, 🔄 checking.

### `StatsTable.tsx`

Statistical summary table (count / min / max / mean / stdev / duration). Receives `data` and `sensorGroups` from Dashboard. Displays sensor keys with depth suffixes for soil temperature sensors.

### `DataTable.tsx`

Paginated, sortable raw data table. Receives `data` from Dashboard. Shows all numeric sensor keys with MST-formatted timestamps. 50 rows per page, column sorting.

### `ErrorBanner.tsx`

Dismissable red alert banner. Receives `message` and `onClose` from Dashboard's error state.

### `ThemeToggle.tsx`

Standalone dark/light mode toggle. Uses `localStorage` + `prefers-color-scheme`. No props needed; toggles the `dark` class on `<html>`.

---

## Key Design Decisions

1. **Single source of truth**: `Dashboard.tsx` holds all state. No Redux, no context, no custom hooks — just `useState` + `useEffect`.

2. **Sensor grouping in backend**: Groups are defined in `sensor_settings.py` and served via API, so frontend charts are generated dynamically without hardcoded chart configs.

3. **Responsive grid layout**: Charts render in a 2-column grid on desktop (`md:grid-cols-2`) and single column on mobile (`grid-cols-1`).

4. **Site name prefixing**: All chart titles are prefixed with the selected site name (e.g., `"Baggs: Wind(U, V, W)"`).

5. **Empty data handling**: Empty sensor datasets are hidden from the chart area but preserved in the legend (`hidden: true`) to maintain axis scale and legend consistency.

6. **Garbage timestamp filtering**: Points with timestamps before Jan 1, 2023 are filtered out to prevent Chart.js time-scale crashes from invalid epoch values.

7. **Wind rose direction**: Unified angle calculation `theta = 90 - atan2(v,u)×180/π` ensures plot position and tooltip text both use standard compass directions (0°=N, clockwise).
