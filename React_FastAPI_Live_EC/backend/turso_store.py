"""Turso (libsql) storage layer — replaces Redis.

Connects to a Turso Cloud database using TURSO_IP (database URL) and
TURSO_KEY (auth token) environment variables.
"""

import json
import os

import libsql

# Module-level connection (initialized in app lifespan)
_conn = None


def _get_conn():
    """Get or create the Turso database connection."""
    global _conn
    if _conn is not None:
        return _conn

    db_url = os.getenv("TURSO_IP")
    auth_token = os.getenv("TURSO_KEY")

    if not db_url or not auth_token:
        raise RuntimeError(
            "TURSO_IP and TURSO_KEY environment variables are required. "
            "Set them in .env (see .env.example)."
        )

    _conn = libsql.connect(
        database=db_url,
        auth_token=auth_token,
    )
    return _conn


def init_db():
    """Create tables if they don't exist."""
    conn = _get_conn()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS tower_data (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            site_ip TEXT NOT NULL,
            data TEXT NOT NULL
        )
    """)
    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_tower_data_site_ip
        ON tower_data(site_ip)
    """)
    conn.commit()


def append_site_data_to_redis(site_ip: str, data: list[dict]):
    """Append data for a site — stores the full combined list (Turso is append-only)."""
    try:
        conn = _get_conn()
        # Read existing data for this site
        existing_raw = conn.execute(
            "SELECT data FROM tower_data WHERE site_ip = ?", (site_ip,)
        ).fetchone()

        if existing_raw:
            existing = json.loads(existing_raw[0])
            if isinstance(existing, list):
                existing.extend(data)
                data = existing

        conn.execute(
            "INSERT INTO tower_data (site_ip, data) VALUES (?, ?)",
            (site_ip, json.dumps(data)),
        )
        conn.commit()
    except Exception as e:
        print(f"[Turso] Error storing {site_ip}: {e}")


def get_site_data_from_redis(site_ip: str) -> list[dict] | None:
    """Get all data for a site from Turso."""
    try:
        conn = _get_conn()
        row = conn.execute(
            "SELECT data FROM tower_data WHERE site_ip = ?", (site_ip,)
        ).fetchone()
        if row:
            return json.loads(row[0])
    except Exception as e:
        print(f"[Turso] Error reading {site_ip}: {e}")
    return None


def clear_redis_site(site_ip: str):
    """Delete a site's data from Turso."""
    try:
        conn = _get_conn()
        conn.execute("DELETE FROM tower_data WHERE site_ip = ?", (site_ip,))
        conn.commit()
    except Exception as e:
        print(f"[Turso] Error clearing {site_ip}: {e}")


def clear_all_redis():
    """Delete all data from Turso."""
    try:
        conn = _get_conn()
        conn.execute("DELETE FROM tower_data")
        conn.commit()
    except Exception as e:
        print(f"[Turso] Error clearing all: {e}")


def close():
    """Close the database connection."""
    global _conn
    if _conn is not None:
        _conn.close()
        _conn = None
