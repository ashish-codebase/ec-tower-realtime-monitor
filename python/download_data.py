"""
Download live real-time EC tower data from multiple sites in parallel.
Connects to port 50111, receives tab-separated data, parses into sonic/daqm DataFrames,
saves as CSV. 60-second timeout per site.
"""

import csv
import socket
import threading
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
import pandas as pd
from build_daqm import parse_ec_data

# Constants
PORT = 50111
DATA_TIMEOUT = 60  # 60 sec to capture all data
MAX_PARALLEL = 10  # Limit concurrent connections
MAX_CSV_ROWS = 2500  # Maximum rows to keep in CSV files


def fetch_tower_data(ip: str, semaphore: threading.Semaphore) -> str:
    """Connect to tower and collect JSON sensor data."""
    with semaphore:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(DATA_TIMEOUT)
        try:
            s.connect((ip, PORT))
            request = f"GET / HTTP/1.0\r\nHost: {ip}:{PORT}\r\n\r\n"
            s.send(request.encode())

            chunks = []
            old_timestamp =''
            try:
                while True:
                    data = s.recv(640)
                    # print(f"  recv: {len(data)} bytes")
                    if not data:
                        break
                    chunks.append(data)
                    lines = data.decode('utf-8')
                    rows = [line.split('\t') for line in lines.strip().split('\n')]                    
                    for row in rows:
                        timestamp = ''
                        if row[0] =='DATADAQM':
                            print(f"\nDAQM data length: {len(data)} bytes")
                            print(row)
                            timestamp = row[1]
                            if old_timestamp == '':
                                old_timestamp = row[1]
                            if old_timestamp != timestamp:
                                return b"".join(chunks).decode("utf-8", errors="replace")
                        

            except socket.timeout:
                pass
            finally:
                s.close()

            # return b"".join(chunks).decode("utf-8", errors="replace")
        except (socket.timeout, OSError):
            return ""



def parse_response(raw: str):
    """Parse raw EC tower data into sonic and daqm DataFrames."""
    rows = [line.split('\t') for line in raw.strip().split('\n')]
    sonic, daqm = parse_ec_data(rows)
    return sonic, daqm


def process_site(site_name: str, ip: str, semaphore: threading.Semaphore):
    """Fetch and process one site, save sonic/daqm DataFrames as CSV."""
    print(f"  Fetching {site_name} ({ip})...", end=" ", flush=True)
    try:
        raw_data = fetch_tower_data(ip, semaphore)
        if not raw_data:
            print("No data received")
            return

        sonic, daqm = parse_response(raw_data)
        print(f"{site_name}: Got {len(sonic)} sonic rows, {len(daqm)} daqm rows", end=" ", flush=True)

        # Define CSV paths
        sonic_path = Path("data") / f"{site_name}_sonic.csv"
        daqm_path = Path("data") / f"{site_name}_daqm.csv"
        
        # Ensure data directory exists
        sonic_path.parent.mkdir(parents=True, exist_ok=True)

        # Load existing data if files exist
        if sonic_path.exists():
            existing_sonic = pd.read_csv(sonic_path, parse_dates=['datetime'])
            sonic = pd.concat([existing_sonic, sonic], ignore_index=True)
        
        if daqm_path.exists():
            existing_daqm = pd.read_csv(daqm_path, parse_dates=['datetime'])
            daqm = pd.concat([existing_daqm, daqm], ignore_index=True)

        # Remove duplicates based on datetime
        sonic = sonic.drop_duplicates(subset=['datetime']).sort_values('datetime')
        daqm = daqm.drop_duplicates(subset=['datetime']).sort_values('datetime')

        # Keep max rows; drop oldest if exceeded
        if len(sonic) > MAX_CSV_ROWS:
            sonic = sonic.tail(MAX_CSV_ROWS)
        if len(daqm) > MAX_CSV_ROWS:
            daqm = daqm.tail(MAX_CSV_ROWS)

        # Save CSVs
        sonic.to_csv(sonic_path, index=False)
        daqm.to_csv(daqm_path, index=False)

        print(f"Saved -> {sonic_path.name} ({len(sonic)} rows), {daqm_path.name} ({len(daqm)} rows)")
    except Exception as e:
        print(f"ERROR: {e}")


def main():
    csv_path = Path("site_name_ip_address.csv")
    sites = []
    seen = set()
    with open(csv_path, newline="") as f:
        reader = csv.reader(f)
        for row in reader:
            if len(row) >= 2:
                name, ip = row[0].strip(), row[1].strip()
                if name not in seen:
                    seen.add(name)
                    sites.append((name, ip))

    print(f"Found {len(sites)} unique sites. Starting parallel download...\n")
    print(f"Max {MAX_PARALLEL} concurrent, 60 sec timeout/site\n")

    semaphore = threading.Semaphore(MAX_PARALLEL)
    max_workers = max(MAX_PARALLEL, __import__("os").cpu_count() or 4)

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {executor.submit(process_site, name, ip, semaphore): (name, ip) for name, ip in sites}
        for future in as_completed(futures):
            name, ip = futures[future]
            try:
                future.result()
            except Exception as e:
                print(f"\nERROR {name} ({ip}): {e}")
    print("\nDone.")


if __name__ == "__main__":
    main()
