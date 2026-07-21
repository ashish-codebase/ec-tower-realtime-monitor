"""Redis storage layer — mirrors src/lib/redis.ts."""

import os
import json
from typing import Optional

import redis


def _get_redis_client():
    url = os.getenv("REDIS_URL")
    if not url:
        raise RuntimeError(
            "REDIS_URL environment variable is required. "
            "Set it in .env (see .env.example)."
        )
    return redis.from_url(url, decode_responses=True, socket_connect_timeout=5)


def append_site_data_to_redis(site_ip: str, data: list[dict]):
    """Append data to a Redis key for the site."""
    try:
        client = _get_redis_client()
        # Store as JSON array — overwrite with combined data
        existing_raw = client.get(f"site:{site_ip}")
        if existing_raw:
            existing = json.loads(existing_raw)
            if isinstance(existing, list):
                existing.extend(data)
                data = existing
        client.set(f"site:{site_ip}", json.dumps(data))
    except Exception as e:
        print(f"[Redis] Error storing {site_ip}: {e}")


def get_site_data_from_redis(site_ip: str) -> Optional[list[dict]]:
    """Get all data for a site from Redis."""
    try:
        client = _get_redis_client()
        raw = client.get(f"site:{site_ip}")
        if raw:
            return json.loads(raw)
    except Exception as e:
        print(f"[Redis] Error reading {site_ip}: {e}")
    return None


def clear_redis_site(site_ip: str):
    """Delete a site's data from Redis."""
    try:
        client = _get_redis_client()
        client.delete(f"site:{site_ip}")
    except Exception as e:
        print(f"[Redis] Error clearing {site_ip}: {e}")


def clear_all_redis():
    """Flush entire Redis DB."""
    try:
        client = _get_redis_client()
        client.flushdb()
    except Exception as e:
        print(f"[Redis] Error flushing: {e}")
