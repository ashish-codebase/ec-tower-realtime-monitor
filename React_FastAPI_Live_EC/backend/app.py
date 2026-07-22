"""FastAPI backend — TCP fetch, data parsing, storage, API endpoints."""

import asyncio
import csv
import math
import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

# Load .env from backend directory
load_dotenv(dotenv_path=Path(__file__).parent / ".env")

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from tcp_client import fetch_tower_data
from column_registry import column_registry
from storage import append_site_data, ensure_data_dir
from turso_store import (
    append_site_data_to_redis,
    get_site_data_from_redis,
    clear_redis_site,
    clear_all_redis,
    init_db,
    close,
)
from sensor_settings import get_settings


# ── State ──────────────────────────────────────────────────────────────

_fetch_in_progress = False
_background_task: Optional[asyncio.Task] = None


def clean_data(obj):
    """Remove NaN values from data (JSON doesn't support NaN)."""
    if isinstance(obj, dict):
        return {k: clean_data(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [clean_data(i) for i in obj]
    elif isinstance(obj, float) and math.isnan(obj):
        return None
    return obj


# ── Config ─────────────────────────────────────────────────────────────

CSV_PATH = Path(__file__).parent.parent / "site_name_ip_address.csv"


def load_sites_from_csv() -> list[dict]:
    """Load site configs from CSV file."""
    sites = []
    if not CSV_PATH.exists():
        return sites
    with open(CSV_PATH, "r", newline="") as f:
        reader = csv.reader(f)
        for row in reader:
            if len(row) < 2:
                continue
            name = row[0].strip()
            ip = row[1].strip()
            if not name or not ip or name.startswith("#"):
                continue
            sites.append({"name": name, "ip": ip})
    return sites


# ── Fetch orchestrator ────────────────────────────────────────────────


async def _perform_fetch():
    """Fetch data from all configured towers in parallel."""
    global _fetch_in_progress
    try:
        ensure_data_dir()
        sites = load_sites_from_csv()
        if not sites:
            print("[Fetch] No sites configured")
            return

        # Fetch all sites concurrently (semaphore limits to MAX_CONCURRENT=10)
        tasks = [fetch_tower_data(site["ip"], site["name"]) for site in sites]
        results_list = await asyncio.gather(*tasks, return_exceptions=True)

        async def _store_site(site: dict, data: list) -> dict:
            """Store fetched data for a single site (async-safe)."""
            try:
                if data:
                    append_site_data_to_redis(site["ip"], data)
                    append_site_data(site["ip"], data)
                    if len(data) > 0:
                        cols = [k for k in data[0].keys() if k not in ("timestamp",)]
                        column_registry.add_tower_columns(site["name"], cols)
                return {
                    "name": site["name"],
                    "ip": site["ip"],
                    "status": "ok",
                    "count": len(data) if data else 0,
                }
            except Exception as e:
                print(f"[Fetch] Store error for {site['name']}: {e}")
                return {
                    "name": site["name"],
                    "ip": site["ip"],
                    "status": "error",
                    "error": str(e),
                }

        # Store each site's data concurrently to avoid blocking on slow I/O
        store_coros = [
            _store_site(site, result)
            for site, result in zip(sites, results_list)
            if isinstance(result, list)
        ]
        # For failed sites, produce error dicts synchronously
        error_dicts = [
            {
                "name": site["name"],
                "ip": site["ip"],
                "status": "error",
                "error": str(result),
            }
            for site, result in zip(sites, results_list)
            if isinstance(result, Exception)
        ]

        # Await only the successful stores
        store_results = await asyncio.gather(
            *store_coros,
            return_exceptions=True,
        )
        results = []
        for r in store_results:
            if isinstance(r, Exception):
                print(f"[Fetch] Store failed: {r}")
            else:
                results.append(r)
        results += error_dicts

        ok = sum(1 for r in results if r["status"] == "ok")
        fail = len(results) - ok
        print(f"[Fetch] Complete: {ok} ok, {fail} failed")

    except Exception as e:
        print(f"[Fetch] Fatal error: {e}")
    finally:
        _fetch_in_progress = False


# ── Pydantic models ───────────────────────────────────────────────────


class FetchResult(BaseModel):
    name: str
    ip: str
    status: str
    count: Optional[int] = None
    error: Optional[str] = None


# ── App ────────────────────────────────────────────────────────────────


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize Turso DB on startup, close on shutdown."""
    # Initialize Turso database schema
    init_db()
    # Load existing columns from stored data
    ensure_data_dir()
    yield
    # Cleanup on shutdown
    global _background_task
    if _background_task and not _background_task.done():
        _background_task.cancel()
    close()


app = FastAPI(
    title="EC Tower Live Monitor API",
    description="FastAPI backend for eddy covariance tower data",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict in production: ["http://localhost:5173"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Endpoints ──────────────────────────────────────────────────────────


@app.get("/api/sites")
async def get_sites():
    """List all configured sites."""
    return load_sites_from_csv()


@app.get("/api/fetch")
async def trigger_fetch():
    """Trigger a manual data fetch from all towers. Returns immediately."""
    global _fetch_in_progress, _background_task

    if _fetch_in_progress:
        return {"status": "running"}

    _fetch_in_progress = True
    _background_task = asyncio.create_task(_perform_fetch())
    return {"status": "started"}


@app.get("/api/fetch/status")
async def get_fetch_status():
    """Check if a fetch is currently in progress."""
    return {"in_progress": _fetch_in_progress}


@app.get("/api/data/{site_ip}")
async def get_data(site_ip: str, resample_5min: bool = Query(default=False)):
    """Get stored data for a site from Turso."""
    data = get_site_data_from_redis(site_ip)

    if data is None:
        data = []

    # Resample to 5-min if requested
    if resample_5min and len(data) > 1:
        data = _resample_to_5min(data)

    # Clean NaN values (JSON doesn't support NaN)
    data = clean_data(data)

    return data


@app.post("/api/cache-control/clear")
async def clear_cache(site_ip: str = Query(default=None)):
    """Clear cached data from Turso."""
    if site_ip:
        clear_redis_site(site_ip)
        return {"status": "cleared", "site": site_ip}
    else:
        clear_all_redis()
        return {"status": "cleared_all"}


@app.get("/api/poll-status")
async def get_poll_status():
    """Get polling status info."""
    return {
        "message": "Polling is active (every 5 min)",
        "interval": "5 minutes",
    }


@app.get("/api/columns")
async def get_columns(site_name: Optional[str] = Query(default=None)):
    """Get column registry. Optionally filter to a specific site."""
    if site_name:
        return {
            "columns": column_registry.get_tower_columns(site_name),
        }
    return {
        "allColumns": column_registry.get_all_columns(),
        "towerColumns": column_registry.to_dict()["towerColumns"],
    }


@app.get("/api/sensor-groups")
async def get_sensor_groups():
    """Get sensor group settings."""
    settings = get_settings()
    groups = []
    for g in settings.sensor_groups:
        entry = {"name": g.name, "keys": g.keys}
        if g.convert:
            # Store conversion info — can't serialize function directly
            if "PPFD" in g.name:
                entry["convert"] = "multiply_0.51"  # PPFD -> W/m²
        groups.append(entry)
    return {
        "sensorGroups": groups,
        "allDaqmColumns": settings.all_daqm_columns,
    }


@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok"}


# ── Resample helper (mirrors src/lib/resample.ts) ─────────────────────


def _resample_to_5min(data: list[dict]) -> list[dict]:
    """Downsample data to 5-minute intervals by averaging."""
    FIVE_MIN_MS = 5 * 60 * 1000

    if len(data) <= 1:
        return data

    buckets: dict[int, list[dict]] = {}
    for point in data:
        bucket = int(point["timestamp"] // FIVE_MIN_MS)
        if bucket not in buckets:
            buckets[bucket] = []
        buckets[bucket].append(point)

    result: list[dict] = []
    for bucket, points in buckets.items():
        if len(points) == 1:
            result.append(points[0])
        else:
            avg: dict = {"timestamp": bucket * FIVE_MIN_MS}
            all_keys = set()
            for p in points:
                all_keys.update(k for k in p if k != "timestamp")
            for key in all_keys:
                vals = [p[key] for p in points if isinstance(p.get(key), (int, float))]
                if vals:
                    avg[key] = sum(vals) / len(vals)
            result.append(avg)

    result.sort(key=lambda p: p["timestamp"])
    return result


if __name__ == "__main__":
    import uvicorn

    host = os.getenv("BACKEND_HOST", "0.0.0.0")
    port = int(os.getenv("BACKEND_PORT", "8000"))
    print(f"[Server] Starting on {host}:{port}")
    uvicorn.run(app, host=host, port=port)
