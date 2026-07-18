# Graph Report - .  (2026-07-12)

## Corpus Check
- Corpus is ~21,893 words - fits in a single context window. You may not need a graph.

## Summary
- 275 nodes · 297 edges · 28 communities (25 shown, 3 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 8 edges (avg confidence: 0.57)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Dev Dependencies
- React UI Components
- TypeScript Config
- Backend Server
- Runtime Dependencies
- Core Data Lib
- K-value Testing
- Project Architecture
- Stats & Settings
- Data Pipeline
- Backend Package
- NPM Scripts
- Sensor Grouping Script
- DataTable Component
- Data API Route
- API Routes & Render
- Clustering Logic
- App Layout
- Next.js Config
- Tailwind Config

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 15 edges
2. `Dashboard Component` - 8 edges
3. `scripts` - 7 edges
4. `getSensorGroups()` - 6 edges
5. `Site` - 5 edges
6. `SensorDataPoint` - 5 edges
7. `include` - 5 edges
8. `JSON Storage Layer` - 5 edges
9. `startPolling()` - 4 edges
10. `readSiteData()` - 4 edges

## Surprising Connections (you probably didn't know these)
- `JSON Storage Layer` --uses--> `NDJSON Data Format`  [EXTRACTED]
  src/lib/storage.ts → README.md
- `State Management Concerns` --describes--> `Dashboard Component`  [EXTRACTED]
  north_mini_recommendations.md → src/components/Dashboard.tsx
- `EC Tower Live Monitor` --uses--> `Chart.js Visualization`  [EXTRACTED]
  README.md → src/components/TimeSeriesChart.tsx
- `EC Tower Live Monitor` --implements--> `Next.js Backend`  [EXTRACTED]
  README.md → src/app/page.tsx
- `EC Tower Live Monitor` --implements--> `React Frontend`  [EXTRACTED]
  README.md → src/components/Dashboard.tsx

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Data Pipeline: Tower â†’ Backend â†’ Frontend** — src_lib_tcp_proxy_layer, background_poller, json_storage_layer, api_data_route, src_components_dashboard_component [EXTRACTED 0.90]
- **Sensor Monitoring: Eddy Covariance Measurements** — eddy_covariance_sensors, sensor_grouping_system, chart_js_visualization, stats_table_component [EXTRACTED 0.85]
- **Deployment: Vercel Frontend + Render Backend** — next_js_backend, render_deployment, render_backend_service, api_sites_route [INFERRED 0.75]

## Communities (28 total, 3 thin omitted)

### Community 0 - "Dev Dependencies"
Cohesion: 0.06
Nodes (31): autoprefixer, jsdom, devDependencies, autoprefixer, jsdom, postcss, tailwindcss, @testing-library/jest-dom (+23 more)

### Community 1 - "React UI Components"
Cohesion: 0.09
Nodes (18): ErrorBanner(), Props, Props, ThemeToggle(), TimeRangeSliderProps, KEY_NAMES, Props, Reading (+10 more)

### Community 2 - "TypeScript Config"
Cohesion: 0.07
Nodes (27): dom, dom.iterable, esnext, next-env.d.ts, .next/types/**/*.ts, node_modules, ./src/*, **/*.ts (+19 more)

### Community 3 - "Backend Server"
Cohesion: 0.11
Nodes (16): fetchAll(), sleep(), start(), app, cors, DATA_DIR, dataStore, express (+8 more)

### Community 4 - "Runtime Dependencies"
Cohesion: 0.11
Nodes (19): chart.js, chartjs-adapter-date-fns, date-fns, lodash.merge, ml-kmeans, next, dependencies, chart.js (+11 more)

### Community 5 - "Core Data Lib"
Cohesion: 0.21
Nodes (11): initPoller(), startPolling(), appendSiteData(), DATA_DIR, ensureDataDir(), getFilePath(), readAllSiteData(), readSiteData() (+3 more)

### Community 6 - "K-value Testing"
Cohesion: 0.12
Nodes (15): content, data, dataFile, fs, groups, { kmeans }, lines, means (+7 more)

### Community 7 - "Project Architecture"
Cohesion: 0.14
Nodes (14): Chart.js Visualization, Data Table Component, EC Tower Live Monitor, Error Banner UI, Next.js Backend, React Frontend, Server-Side I/O Issue, Site Selector UI (+6 more)

### Community 8 - "Stats & Settings"
Cohesion: 0.19
Nodes (11): Dashboard(), formatKey(), KEY_NAMES, Props, Reading, SensorDataPoint, Stats, StatsTable() (+3 more)

### Community 9 - "Data Pipeline"
Cohesion: 0.17
Nodes (13): /api/data Route, Background Poller, Circular Buffer (2880 points), Data Deduplication Logic, Eddy Covariance Sensors, Environmental Science Domain, HTTP/1.0 Protocol, JSON Storage Layer (+5 more)

### Community 10 - "Backend Package"
Cohesion: 0.17
Nodes (11): dependencies, cors, express, description, main, name, scripts, start (+3 more)

### Community 11 - "NPM Scripts"
Cohesion: 0.18
Nodes (10): name, private, scripts, build, dev, start, test, test:coverage (+2 more)

### Community 12 - "Sensor Grouping Script"
Cohesion: 0.25
Nodes (5): fs, KEY_NAMES, { kmeans }, path, SENSOR_CATEGORIES

### Community 13 - "DataTable Component"
Cohesion: 0.33
Nodes (6): DataTable(), formatMstTime(), KEY_NAMES, Props, Reading, SensorDataPoint

### Community 14 - "Data API Route"
Cohesion: 0.47
Nodes (5): addReadableTimestamps(), dataCache, GET(), getDataFileFromFileSystem(), lastRequestTimes

### Community 15 - "API Routes & Render"
Cohesion: 0.50
Nodes (4): /api/fetch Route, /api/sites Route, Render Backend Service, Render Deployment

### Community 16 - "Clustering Logic"
Cohesion: 0.67
Nodes (3): Jenks Natural Breaks Algorithm, K-means Clustering Script, Sensor Grouping System

## Knowledge Gaps
- **133 isolated node(s):** `name`, `version`, `description`, `main`, `start` (+128 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `devDependencies` connect `Dev Dependencies` to `NPM Scripts`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._
- **Why does `dependencies` connect `Runtime Dependencies` to `NPM Scripts`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `Dashboard Component` (e.g. with `Data Table Component` and `Time Range Slider`) actually correct?**
  _`Dashboard Component` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `name`, `version`, `description` to the rest of the system?**
  _133 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Dev Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.06451612903225806 - nodes in this community are weakly interconnected._
- **Should `React UI Components` be split into smaller, more focused modules?**
  _Cohesion score 0.09032258064516129 - nodes in this community are weakly interconnected._
- **Should `TypeScript Config` be split into smaller, more focused modules?**
  _Cohesion score 0.07142857142857142 - nodes in this community are weakly interconnected._