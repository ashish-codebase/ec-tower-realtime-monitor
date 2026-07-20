"""TCP client for EC towers — mirrors src/lib/tcp.ts logic."""

import socket
import asyncio
from typing import Optional


PORT = 50111
TOTAL_TIMEOUT_S = 60
MAX_CONCURRENT = 10


class Semaphore:
    """Async semaphore to limit concurrent connections."""
    def __init__(self, max_connections: int):
        self._max = max_connections
        self._current = 0
        self._lock = asyncio.Lock()

    async def acquire(self):
        async with self._lock:
            while self._current >= self._max:
                await asyncio.sleep(0.1)
            self._current += 1

    def release(self):
        self._current -= 1


_semaphore = Semaphore(MAX_CONCURRENT)


async def fetch_tower_data(ip: str, site_name: str = "unknown") -> list[dict]:
    """Fetch raw data from an EC tower via TCP and parse it."""
    await _semaphore.acquire()
    try:
        print(f"[TCP] Connecting to {ip}:{PORT}...")
        reader, writer = await asyncio.wait_for(
            asyncio.open_connection(ip, PORT),
            timeout=TOTAL_TIMEOUT_S,
        )
        print(f"[TCP] Connected to {ip}:{PORT}")

        # Send HTTP-style request
        request = f"GET / HTTP/1.0\r\nHost: {ip}:{PORT}\r\n\r\n"
        print(f"[TCP] Sending request: {request.strip()}")
        writer.write(request.encode())
        await writer.drain()

        raw = ""
        daqm_timestamps_seen = 0
        first_daqm_ts = ""
        chunks_received = 0

        while True:
            try:
                chunk = await asyncio.wait_for(reader.read(4096), timeout=30)
                if not chunk:
                    print(f"[TCP] Connection closed by server after {chunks_received} chunks")
                    break
                chunks_received += 1
                text = chunk.decode("utf-8", errors="replace")
                print(f"[TCP] Chunk {chunks_received}: {len(text)} chars, first 100: {text[:100].replace(chr(10), ' ')}")
                lines = text.split("\n")
                for line in lines:
                    parts = line.strip().split("\t")
                    if parts[0] == "DATADAQM":
                        ts = parts[1]
                        if daqm_timestamps_seen == 0:
                            first_daqm_ts = ts
                            daqm_timestamps_seen = 1
                            print(f"[TCP] First DATADAQM timestamp: {ts}")
                        elif ts != first_daqm_ts and daqm_timestamps_seen == 1:
                            raw += line + "\n"
                            print(f"[TCP] Second DATADAQM timestamp differs ({ts} != {first_daqm_ts}), stopping read")
                            break
                    raw += line + "\n"
                if daqm_timestamps_seen == 1:
                    break
            except asyncio.TimeoutError:
                print(f"[TCP] Read timeout after {chunks_received} chunks, stopping")
                break

        writer.close()
        try:
            await writer.wait_closed()
        except Exception:
            pass

        print(f"[TCP] Received {len(raw)} bytes raw data from {site_name}")
        print(f"[TCP] Raw data preview (first 500 chars): {raw[:500].replace(chr(10), ' | ')}")

        result = parse_ec_data(raw, site_name)
        print(f"[TCP] Parsed {len(result)} data points from {site_name}")
        if result:
            print(f"[TCP] First point: {result[0]}")
            print(f"[TCP] Last point: {result[-1]}")
        return result

    except Exception as e:
        print(f"[TCP] FAILED to connect to {ip}:{PORT} — {type(e).__name__}: {e}")
        raise ConnectionError(f"Failed to connect to {ip}:{PORT} — {e}")


def _parse_timestamp_ms(seconds: float, nanoseconds: float = 0) -> float:
    """Convert UNIX seconds+nanoseconds to milliseconds."""
    return (seconds + nanoseconds / 1e9) * 1000


def _avg_numeric(values: list) -> Optional[float]:
    """Average numeric values, ignoring NaN and non-numeric."""
    clean = [v for v in values if isinstance(v, (int, float)) and not (isinstance(v, float) and (v != v))]  # noqa: PLR2004
    if not clean:
        return None
    return sum(clean) / len(clean)


def _average_rows(rows: list[dict], keys: list[str]) -> dict:
    """Average multiple data rows across specified keys."""
    avg = {"timestamp": 0}
    for key in keys:
        vals = [row.get(key) for row in rows if isinstance(row.get(key), (int, float))]
        if vals:
            avg[key] = sum(vals) / len(vals)
    return avg


def validate_numeric(value, field_name: str, site_name: str) -> Optional[float]:
    """Validate and convert a value to float. Returns None if invalid."""
    if value is None or value == '':
        return None
    try:
        val = float(value)
        if not (val == val):  # NaN check
            return None
        if not (val == float('inf') or val == float('-inf')):
            return val
        return None
    except (ValueError, TypeError):
        print(f"[Validate] Invalid numeric value for {field_name} at {site_name}: {value}")
        return None


def validate_sonic_row(row: dict, site_name: str) -> Optional[dict]:
    """Validate a parsed sonic row. Returns None if invalid."""
    # Check required fields exist
    required = ["SECONDS", "NANOSECONDS", "U", "V", "W"]
    for field in required:
        if field not in row or row[field] is None:
            print(f"[Validate] Missing required field {field} at {site_name}")
            return None
    
    # Validate numeric values
    for field in required:
        val = validate_numeric(row[field], field, site_name)
        if val is None and field in ["U", "V", "W"]:  # Wind components are critical
            print(f"[Validate] Critical field {field} is invalid at {site_name}")
            return None
    
    return row


def parse_ec_data(raw: str, site_name: str) -> list[dict]:
    """Parse raw tower data into list of data point dicts."""
    # Strip HTTP headers
    header_end = raw.find("\r\n\r\n")
    body = raw[header_end + 4:] if header_end != -1 else raw

    rows = [line.strip() for line in body.split("\n") if line.strip()]
    parsed_rows = [row.split("\t") for row in rows]

    # Parse sonic data
    sonic_rows: list[dict] = []
    daqm_header: list[str] = []
    raw_daqm_rows: list[dict] = []

    for row in parsed_rows:
        if not row:
            continue
        tag = row[0]

        if tag == "DATASONIC":
            data = row[1:]
            try:
                sonic_row = {
                    "SECONDS": float(data[0]) if data[0] else 0,
                    "NANOSECONDS": float(data[1]) if len(data) > 1 and data[1] else 0,
                    "DIAG": float(data[2]) if len(data) > 2 and data[2] else 0,
                    "U": float(data[3]) if len(data) > 3 and data[3] else 0,
                    "V": float(data[4]) if len(data) > 4 and data[4] else 0,
                    "W": float(data[5]) if len(data) > 5 and data[5] else 0,
                    "SOS": float(data[6]) if len(data) > 6 and data[6] else 0,
                    "TEMP": float(data[7]) if len(data) > 7 and data[7] else 0,
                    "AIN1": float(data[8]) if len(data) > 8 and data[8] else 0,
                    "AIN2": float(data[9]) if len(data) > 9 and data[9] else 0,
                    "AIN3": float(data[10]) if len(data) > 10 and data[10] else 0,
                    "AIN4": float(data[11]) if len(data) > 11 and data[11] else 0,
                    "CHK": float(data[12]) if len(data) > 12 and data[12] else 0,
                }
                # Validate the row
                validated = validate_sonic_row(sonic_row, site_name)
                if validated:
                    sonic_rows.append(validated)
            except (ValueError, IndexError) as e:
                print(f"[Parse] Error parsing DATASONIC row at {site_name}: {e}")

        elif tag == "DATADAQMH":
            # Header row: DATADAQMH, SECONDS, NANOSECONDS, col1, col2, ...
            daqm_header = row[3:]

        elif tag == "DATADAQM":
            data = row[1:]
            daqm_row: dict = {
                "SECONDS": float(data[0]) if data[0] else 0,
                "NANOSECONDS": float(data[1]) if len(data) > 1 and data[1] else 0,
            }
            for j in range(2, len(data)):
                if j - 2 < len(daqm_header):
                    try:
                        val = float(data[j])
                        daqm_row[daqm_header[j - 2]] = val
                    except (ValueError, IndexError):
                        pass
            # Validate DAQM row (check required fields)
            if "SECONDS" in daqm_row and daqm_row["SECONDS"]:
                raw_daqm_rows.append(daqm_row)

    # Resample sonic to 1-minute intervals
    sonic_resampled = _resample_sonic_to_1min(sonic_rows)

    # Average consecutive DAQM pairs
    averaged_daqm: list[dict] = []
    for i in range(0, len(raw_daqm_rows), 2):
        if i + 1 < len(raw_daqm_rows):
            a, b = raw_daqm_rows[i], raw_daqm_rows[i + 1]
            avg_ts = (a["SECONDS"] + b["SECONDS"]) / 2
            avg_row: dict = {"timestamp": _parse_timestamp_ms(avg_ts)}
            for col in daqm_header:
                vals = [a.get(col), b.get(col)]
                avg_row[col] = _avg_numeric(vals)
            averaged_daqm.append(avg_row)
        else:
            # Odd row out — keep as-is
            r = raw_daqm_rows[i]
            averaged_daqm.append({"timestamp": _parse_timestamp_ms(r["SECONDS"])})
            for col in daqm_header:
                averaged_daqm[-1][col] = r.get(col)

    # Combine sonic + averaged daqm
    combined: list[dict] = []

    for row in sonic_resampled:
        ts = _parse_timestamp_ms(row["SECONDS"], row.get("NANOSECONDS", 0))
        point: dict = {"timestamp": ts}
        for k, v in row.items():
            if k not in ("SECONDS", "NANOSECONDS"):
                point[k] = v
        combined.append(point)

    for row in averaged_daqm:
        ts = row["timestamp"]
        point: dict = {"timestamp": ts}
        for k, v in row.items():
            if k != "timestamp":
                point[k] = v
        combined.append(point)

    # Sort by timestamp
    combined.sort(key=lambda p: p["timestamp"])

    # Dedup: group by millisecond timestamp and average
    points_by_ms: dict[float, list[dict]] = {}
    for point in combined:
        ts = point["timestamp"]
        if ts not in points_by_ms:
            points_by_ms[ts] = []
        points_by_ms[ts].append(point)

    deduped: list[dict] = []
    for ts, points in points_by_ms.items():
        if len(points) == 1:
            deduped.append(points[0])
        else:
            avg_point: dict = {"timestamp": ts}
            all_keys = set()
            for p in points:
                all_keys.update(k for k in p if k != "timestamp")
            for key in all_keys:
                vals = [p[key] for p in points if isinstance(p.get(key), (int, float))]
                if vals:
                    avg_point[key] = sum(vals) / len(vals)
            deduped.append(avg_point)

    deduped.sort(key=lambda p: p["timestamp"])
    return deduped


def _resample_sonic_to_1min(sonic_rows: list[dict]) -> list[dict]:
    """Group sonic rows into 1-minute buckets and average."""
    if not sonic_rows:
        return []

    minute_groups: dict[int, list[dict]] = {}

    for row in sonic_rows:
        ms = int(row["SECONDS"] * 1000 + row.get("NANOSECONDS", 0) / 1e6)
        minute_ms = (ms // 60000) * 60000
        if minute_ms not in minute_groups:
            minute_groups[minute_ms] = []
        minute_groups[minute_ms].append(row)

    resampled: list[dict] = []
    for minute_ms, rows in minute_groups.items():
        avg: dict = {"SECONDS": minute_ms // 1000, "NANOSECONDS": 0}
        all_keys = set()
        for r in rows:
            all_keys.update(k for k in r if k not in ("SECONDS", "NANOSECONDS"))
        for key in all_keys:
            vals = [r.get(key, 0) or 0 for r in rows]
            avg[key] = sum(vals) / len(vals)
        resampled.append(avg)

    resampled.sort(key=lambda r: r["SECONDS"])
    return resampled
