"""JSON file storage for tower data — mirrors src/lib/storage.ts."""

import json
import os
from pathlib import Path
from typing import Optional


DATA_DIR = Path(__file__).parent.parent / "data"


def ensure_data_dir():
    DATA_DIR.mkdir(parents=True, exist_ok=True)


def _get_data_path(site_ip: str) -> Path:
    safe_name = site_ip.replace(".", "_").replace(":", "_")
    return DATA_DIR / f"{safe_name}.json"


def append_site_data(site_ip: str, data: list[dict]):
    """Append data points to a JSON file for the given site IP."""
    ensure_data_dir()
    path = _get_data_path(site_ip)

    existing = []
    if path.exists():
        try:
            with open(path, "r") as f:
                existing = json.load(f)
        except (json.JSONDecodeError, IOError):
            existing = []

    if isinstance(existing, list):
        existing.extend(data)
    else:
        existing = data

    with open(path, "w") as f:
        json.dump(existing, f)


def get_site_data(site_ip: str) -> list[dict]:
    """Read all data for a site from JSON file."""
    path = _get_data_path(site_ip)
    if not path.exists():
        return []
    try:
        with open(path, "r") as f:
            data = json.load(f)
        return data if isinstance(data, list) else []
    except (json.JSONDecodeError, IOError):
        return []


def clear_site_data(site_ip: str):
    """Delete the JSON file for a site."""
    path = _get_data_path(site_ip)
    if path.exists():
        path.unlink()
