"""Tests for EC Tower backend — verify key values are computed correctly."""

import json
import os
import sys
from pathlib import Path
from unittest.mock import patch, MagicMock

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

import pytest
from fastapi.testclient import TestClient

from app import app, _resample_to_5min, load_sites_from_csv
from column_registry import ColumnRegistry, column_registry
from storage import append_site_data, get_site_data, clear_site_data, ensure_data_dir, _get_data_path
from tcp_client import (
    parse_ec_data,
    validate_numeric,
    validate_sonic_row,
    _parse_timestamp_ms,
    _avg_numeric,
    _average_rows,
    _resample_sonic_to_1min,
)
from sensor_settings import get_settings, Settings, SensorGroupSetting


# ── Fixtures ──────────────────────────────────────────────────────────

@pytest.fixture
def client():
    """FastAPI test client."""
    return TestClient(app)


@pytest.fixture
def temp_data_dir(tmp_path):
    """Temporary data directory for storage tests."""
    with patch('storage.DATA_DIR', tmp_path):
        yield tmp_path


@pytest.fixture
def sample_sonic_data():
    """Sample DATASONIC raw data."""
    return """DATASONIC\t1700000000\t0\t0\t3.2\t-0.5\t0.1\t345.2\t15.3\t0\t0\t0\t0\t0
DATASONIC\t1700000060\t0\t0\t3.5\t-0.3\t0.2\t345.1\t15.4\t0\t0\t0\t0\t0
DATASONIC\t1700000120\t0\t0\t3.1\t-0.6\t0.0\t345.3\t15.2\t0\t0\t0\t0\t0"""


@pytest.fixture
def sample_daqm_data():
    """Sample DATADAQMH/DATADAQM raw data."""
    return """DATADAQMH\tSECONDS\tNANOSECONDS\tTEMP\tRH\tSWIN
DATADAQM\t1700000000\t0\t15.3\t65.2\t450.5
DATADAQM\t1700000001\t0\t15.4\t65.1\t451.2
DATADAQM\t1700000060\t0\t15.5\t64.8\t448.9
DATADAQM\t1700000061\t0\t15.6\t64.7\t449.1"""


# ── Column Registry Tests ────────────────────────────────────────────

class TestColumnRegistry:
    def test_init_includes_base_columns(self):
        """Registry starts with SECONDS and NANOSECONDS."""
        reg = ColumnRegistry()
        assert "SECONDS" in reg.get_all_columns()
        assert "NANOSECONDS" in reg.get_all_columns()

    def test_add_tower_columns(self):
        """Adding columns updates both site-specific and global sets."""
        reg = ColumnRegistry()
        reg.add_tower_columns("SITE1", ["U", "V", "W", "TEMP"])
        
        assert "U" in reg.get_all_columns()
        assert "V" in reg.get_all_columns()
        assert "W" in reg.get_all_columns()
        assert "TEMP" in reg.get_all_columns()
        
        site_cols = reg.get_tower_columns("SITE1")
        assert set(site_cols) == {"U", "V", "W", "TEMP"}

    def test_has_column(self):
        """has_column returns True/False correctly."""
        reg = ColumnRegistry()
        reg.add_tower_columns("SITE1", ["U", "V"])
        
        assert reg.has_column("SITE1", "U") is True
        assert reg.has_column("SITE1", "W") is False
        assert reg.has_column("UNKNOWN_SITE", "U") is False

    def test_to_dict_roundtrip(self):
        """to_dict and from_dict preserve data."""
        reg = ColumnRegistry()
        reg.add_tower_columns("SITE1", ["U", "V", "W"])
        reg.add_tower_columns("SITE2", ["U", "V", "TEMP"])
        
        d = reg.to_dict()
        reg2 = ColumnRegistry.from_dict(d)
        
        assert set(reg2.get_all_columns()) == set(reg.get_all_columns())
        assert set(reg2.get_tower_columns("SITE1")) == {"U", "V", "W"}
        assert set(reg2.get_tower_columns("SITE2")) == {"U", "V", "TEMP"}

    def test_duplicate_columns_ignored(self):
        """Adding same column twice doesn't duplicate."""
        reg = ColumnRegistry()
        reg.add_tower_columns("SITE1", ["U", "V"])
        reg.add_tower_columns("SITE1", ["U", "W"])  # U is duplicate
        
        all_cols = reg.get_all_columns()
        assert all_cols.count("U") == 1
        assert set(all_cols) == {"SECONDS", "NANOSECONDS", "U", "V", "W"}


# ── Timestamp Parsing Tests ──────────────────────────────────────────

class TestTimestampParsing:
    def test_parse_timestamp_ms_basic(self):
        """Convert seconds to milliseconds."""
        assert _parse_timestamp_ms(1700000000) == 1700000000000.0

    def test_parse_timestamp_ms_with_nanoseconds(self):
        """Include nanoseconds in conversion."""
        # 500ms = 500,000,000 ns
        result = _parse_timestamp_ms(1700000000, 500000000)
        assert result == 1700000000500.0

    def test_parse_timestamp_ms_zero(self):
        """Zero timestamp stays zero."""
        assert _parse_timestamp_ms(0) == 0.0


# ── Average Functions Tests ──────────────────────────────────────────

class TestAverageFunctions:
    def test_avg_numeric_empty(self):
        """Empty list returns None."""
        assert _avg_numeric([]) is None

    def test_avg_numeric_all_nan(self):
        """All NaN/None returns None."""
        assert _avg_numeric([None, float('nan'), None]) is None

    def test_avg_numeric_mixed(self):
        """Averages only numeric values."""
        result = _avg_numeric([10, 20, None, 30])
        assert result == 20.0

    def test_average_rows(self):
        """Averages multiple rows across specified keys."""
        rows = [
            {"timestamp": 1, "U": 3.0, "V": -1.0},
            {"timestamp": 2, "U": 5.0, "V": -2.0},
        ]
        result = _average_rows(rows, ["U", "V"])
        assert result["U"] == 4.0
        assert result["V"] == -1.5


# ── Data Validation Tests ────────────────────────────────────────────

class TestValidateNumeric:
    def test_valid_number(self):
        """Valid numbers pass through."""
        assert validate_numeric(3.14, "TEMP", "SITE") == 3.14
        assert validate_numeric(-10.5, "U", "SITE") == -10.5
        assert validate_numeric(0, "V", "SITE") == 0

    def test_invalid_string(self):
        """Non-numeric strings return None."""
        assert validate_numeric("abc", "TEMP", "SITE") is None
        assert validate_numeric("N/A", "U", "SITE") is None

    def test_empty_value(self):
        """Empty values return None."""
        assert validate_numeric("", "TEMP", "SITE") is None
        assert validate_numeric(None, "U", "SITE") is None

    def test_nan_value(self):
        """NaN values return None."""
        import math
        assert validate_numeric(float('nan'), "TEMP", "SITE") is None

    def test_infinity_value(self):
        """Infinity values return None."""
        assert validate_numeric(float('inf'), "TEMP", "SITE") is None
        assert validate_numeric(float('-inf'), "TEMP", "SITE") is None


class TestValidateSonicRow:
    def test_valid_row(self):
        """Valid sonic row passes validation."""
        row = {
            "SECONDS": 1700000000,
            "NANOSECONDS": 0,
            "U": 3.2,
            "V": -0.5,
            "W": 0.1,
            "TEMP": 15.3,
        }
        result = validate_sonic_row(row, "SITE1")
        assert result is not None
        assert result["U"] == 3.2

    def test_missing_critical_field(self):
        """Missing U/V/W returns None."""
        row = {
            "SECONDS": 1700000000,
            "NANOSECONDS": 0,
            "U": 3.2,
            # V is missing
        }
        result = validate_sonic_row(row, "SITE1")
        assert result is None

    def test_invalid_critical_field(self):
        """Invalid U/V/W returns None."""
        row = {
            "SECONDS": 1700000000,
            "NANOSECONDS": 0,
            "U": "invalid",
            "V": -0.5,
            "W": 0.1,
        }
        result = validate_sonic_row(row, "SITE1")
        assert result is None

    def test_optional_fields_can_be_missing(self):
        """Optional fields like DIAG can be missing."""
        row = {
            "SECONDS": 1700000000,
            "NANOSECONDS": 0,
            "U": 3.2,
            "V": -0.5,
            "W": 0.1,
            # DIAG, SOS, TEMP, AIN1-4, CHK are optional
        }
        result = validate_sonic_row(row, "SITE1")
        assert result is not None


# ── Sonic Data Parsing Tests ─────────────────────────────────────────

class TestSonicParsing:
    def test_parse_sonic_data(self, sample_sonic_data):
        """Parse DATASONIC rows correctly."""
        result = parse_ec_data(sample_sonic_data, "TEST")
        
        # Should have 3 data points (one per DATASONIC line)
        assert len(result) == 3
        
        # First point should have timestamp (bucketed to minute boundary)
        first = result[0]
        # Bucket calculation: (1700000000000 // 60000) * 60000 = 1699999980000
        assert first["timestamp"] == 1699999980000.0
        
        # Should have wind components
        assert "U" in first
        assert "V" in first
        assert "W" in first
        
        # Values should be numeric
        assert isinstance(first["U"], float)
        assert first["U"] == 3.2

    def test_parse_sonic_resamples_to_1min(self, sample_sonic_data):
        """Sonic data is resampled to 1-minute intervals."""
        result = parse_ec_data(sample_sonic_data, "TEST")
        
        # All timestamps should be at minute boundaries
        for point in result:
            ts_ms = point["timestamp"]
            ts_sec = ts_ms / 1000
            assert ts_sec % 60 == 0, f"Timestamp {ts_sec} not at minute boundary"


# ── DAQM Data Parsing Tests ──────────────────────────────────────────

class TestDAQMParsing:
    def test_parse_daqm_data(self, sample_daqm_data):
        """Parse DATADAQMH/DATADAQM rows correctly."""
        result = parse_ec_data(sample_daqm_data, "TEST")
        
        # Should have data points (sonic + averaged DAQM)
        assert len(result) > 0
        
        # Should have DAQM columns
        keys = set(result[0].keys()) - {"timestamp"}
        assert "TEMP" in keys or "RH" in keys or "SWIN" in keys

    def test_daqm_averages_pairs(self, sample_daqm_data):
        """Consecutive DAQM rows are averaged."""
        result = parse_ec_data(sample_daqm_data, "TEST")
        
        # Find DAQM-derived points (they'll have different timestamps than sonic)
        daqm_points = [p for p in result if p["timestamp"] % 60000 != 0]
        
        # Should have fewer points than raw DAQM rows (due to averaging)
        raw_daqm_rows = sample_daqm_data.count("DATADAQM\t")
        assert len(daqm_points) <= raw_daqm_rows / 2


class TestMalformedDataHandling:
    """Test that malformed data from remote towers is handled correctly."""
    
    def test_invalid_sonic_values_filtered(self):
        """Sonic rows with invalid wind values are filtered out."""
        raw = """DATASONIC\t1700000000\t0\t0\tabc\t-0.5\t0.1\t345.2\t15.3\t0\t0\t0\t0\t0
DATASONIC\t1700000060\t0\t0\t3.5\t-0.3\t0.2\t345.1\t15.4\t0\t0\t0\t0\t0"""
        
        result = parse_ec_data(raw, "TEST")
        
        # First row has invalid U value, should be filtered
        # Only second row should remain
        assert len(result) == 1
        assert result[0]["U"] == 3.5

    def test_missing_sonic_fields_default_to_zero(self):
        """Sonic rows with fewer fields get 0 for missing values."""
        # Row with only SECONDS and NANOSECONDS (missing U, V, W)
        raw = "DATASONIC\t1700000000\t0"
        
        result = parse_ec_data(raw, "TEST")
        # Missing fields default to 0, so row is kept
        assert len(result) == 1
        assert result[0]["U"] == 0.0
        assert result[0]["V"] == 0.0
        assert result[0]["W"] == 0.0

    def test_daqm_with_invalid_values(self):
        """DAQM rows with invalid values still parse (non-critical)."""
        raw = """DATADAQMH\tSECONDS\tNANOSECONDS\tTEMP\tRH
DATADAQM\t1700000000\t0\tabc\t65.2
DATADAQM\t1700000060\t0\t15.5\t64.8"""
        
        result = parse_ec_data(raw, "TEST")
        
        # Should still have data (invalid TEMP values become 0 or are skipped)
        assert len(result) > 0

    def test_empty_data_returns_empty(self):
        """Empty input returns empty list."""
        result = parse_ec_data("", "TEST")
        assert result == []

    def test_only_headers_no_data(self):
        """Data with only headers and no rows returns empty."""
        raw = """DATADAQMH\tSECONDS\tNANOSECONDS\tTEMP"""
        result = parse_ec_data(raw, "TEST")
        assert result == []


# ── Storage Tests ────────────────────────────────────────────────────

class TestStorage:
    def test_ensure_data_dir(self, temp_data_dir):
        """ensure_data_dir creates the directory."""
        new_dir = temp_data_dir / "new_subdir"
        with patch('storage.DATA_DIR', new_dir):
            ensure_data_dir()
            assert new_dir.exists()

    def test_get_data_path(self, temp_data_dir):
        """_get_data_path converts IP to safe filename."""
        with patch('storage.DATA_DIR', temp_data_dir):
            path = _get_data_path("192.168.1.10")
            assert path == temp_data_dir / "192_168_1_10.json"

    def test_append_and_get_site_data(self, temp_data_dir):
        """Append data and retrieve it."""
        with patch('storage.DATA_DIR', temp_data_dir):
            # Clear any existing data
            clear_site_data("192.168.1.10")
            
            # Append data
            data = [
                {"timestamp": 1000, "U": 3.0},
                {"timestamp": 2000, "V": -1.0},
            ]
            append_site_data("192.168.1.10", data)
            
            # Retrieve data
            result = get_site_data("192.168.1.10")
            assert len(result) == 2
            assert result[0]["U"] == 3.0
            assert result[1]["V"] == -1.0

    def test_append_appends_to_existing(self, temp_data_dir):
        """Appending to existing data extends the list."""
        with patch('storage.DATA_DIR', temp_data_dir):
            clear_site_data("10.0.0.1")
            
            # First append
            append_site_data("10.0.0.1", [{"timestamp": 1000, "U": 3.0}])
            
            # Second append
            append_site_data("10.0.0.1", [{"timestamp": 2000, "V": -1.0}])
            
            result = get_site_data("10.0.0.1")
            assert len(result) == 2

    def test_get_nonexistent_site(self, temp_data_dir):
        """Getting data for nonexistent site returns empty list."""
        with patch('storage.DATA_DIR', temp_data_dir):
            result = get_site_data("999.999.999.999")
            assert result == []

    def test_clear_site_data(self, temp_data_dir):
        """Clear removes the data file."""
        with patch('storage.DATA_DIR', temp_data_dir):
            append_site_data("1.2.3.4", [{"timestamp": 1000}])
            clear_site_data("1.2.3.4")
            result = get_site_data("1.2.3.4")
            assert result == []


# ── Resample Tests ───────────────────────────────────────────────────

class TestResample:
    def test_resample_to_5min(self):
        """Resample data to 5-minute intervals by averaging."""
        data = [
            {"timestamp": 1000, "U": 3.0},
            {"timestamp": 2000, "U": 4.0},
            {"timestamp": 3000, "U": 5.0},  # Same 5-min bucket as above
            {"timestamp": 301000, "U": 6.0},  # Next 5-min bucket
        ]
        
        result = _resample_to_5min(data)
        
        # Should have 2 buckets
        assert len(result) == 2
        
        # First bucket average
        first_avg = result[0]
        assert first_avg["timestamp"] == 0  # First bucket starts at 0
        assert first_avg["U"] == 4.0  # (3+4+5)/3

    def test_resample_single_point(self):
        """Single point passes through unchanged."""
        data = [{"timestamp": 1000, "U": 3.0}]
        result = _resample_to_5min(data)
        assert result == data

    def test_resample_empty(self):
        """Empty list returns empty."""
        assert _resample_to_5min([]) == []


# ── Sensor Settings Tests ────────────────────────────────────────────

class TestSensorSettings:
    def test_get_settings_returns_settings(self):
        """get_settings returns a Settings object."""
        settings = get_settings()
        assert isinstance(settings, Settings)
        assert len(settings.sensor_groups) > 0

    def test_sensor_groups_have_keys(self):
        """Each sensor group has name and keys."""
        settings = get_settings()
        for group in settings.sensor_groups:
            assert group.name
            assert len(group.keys) > 0

    def test_ppfd_has_conversion(self):
        """PPFD sensor group has conversion function."""
        settings = get_settings()
        ppfd_group = next((g for g in settings.sensor_groups if "PPFD" in g.name), None)
        assert ppfd_group is not None
        assert ppfd_group.convert is not None

    def test_all_daqm_columns_listed(self):
        """All DAQM columns are in the settings."""
        settings = get_settings()
        assert "SECONDS" in settings.all_daqm_columns
        assert "U" in settings.all_daqm_columns
        assert "TEMP" in settings.all_daqm_columns


# ── API Endpoint Tests ───────────────────────────────────────────────

class TestAPIEndpoints:
    def test_health_check(self, client):
        """Health endpoint returns ok."""
        response = client.get("/api/health")
        assert response.status_code == 200
        assert response.json() == {"status": "ok"}

    def test_get_sites(self, client, tmp_path):
        """Get sites returns configured sites from CSV."""
        # Create a test CSV
        csv_path = tmp_path / "site_name_ip_address.csv"
        csv_path.write_text("SITE1,192.168.1.10\nSITE2,192.168.1.11\n")
        
        with patch('app.CSV_PATH', csv_path):
            response = client.get("/api/sites")
            assert response.status_code == 200
            sites = response.json()
            assert len(sites) == 2
            assert sites[0]["name"] == "SITE1"
            assert sites[0]["ip"] == "192.168.1.10"

    def test_get_sensor_groups(self, client):
        """Get sensor groups returns configured groups."""
        response = client.get("/api/sensor-groups")
        assert response.status_code == 200
        data = response.json()
        assert "sensorGroups" in data
        assert len(data["sensorGroups"]) > 0
        assert "allDaqmColumns" in data

    def test_get_columns(self, client):
        """Get columns returns column registry."""
        response = client.get("/api/columns")
        assert response.status_code == 200
        data = response.json()
        assert "allColumns" in data
        assert "towerColumns" in data

    def test_get_data_empty(self, client, temp_data_dir):
        """Get data for site with no data returns empty list."""
        with patch('storage.DATA_DIR', temp_data_dir):
            response = client.get("/api/data/999.999.999.999")
            assert response.status_code == 200
            assert response.json() == []

    def test_trigger_fetch_returns_started(self, client):
        """Trigger fetch returns started status."""
        response = client.get("/api/fetch")
        assert response.status_code == 200
        assert response.json()["status"] == "started"

    def test_fetch_status(self, client):
        """Fetch status returns in_progress flag."""
        response = client.get("/api/fetch/status")
        assert response.status_code == 200
        assert "in_progress" in response.json()

    def test_poll_status(self, client):
        """Poll status returns interval info."""
        response = client.get("/api/poll-status")
        assert response.status_code == 200
        data = response.json()
        assert "interval" in data
        assert "5 minutes" in data["interval"]


# ── Integration Tests ────────────────────────────────────────────────

class TestIntegration:
    def test_full_data_flow(self, temp_data_dir):
        """Test complete data flow: parse → store → retrieve."""
        # Parse data
        raw = """DATASONIC\t1700000000\t0\t0\t3.2\t-0.5\t0.1\t345.2\t15.3\t0\t0\t0\t0\t0"""
        parsed = parse_ec_data(raw, "TEST")
        
        assert len(parsed) > 0
        assert "U" in parsed[0]
        assert parsed[0]["U"] == 3.2
        
        # Store data
        with patch('storage.DATA_DIR', temp_data_dir):
            clear_site_data("10.0.0.1")
            append_site_data("10.0.0.1", parsed)
            
            # Retrieve data
            retrieved = get_site_data("10.0.0.1")
            assert len(retrieved) == len(parsed)
            assert retrieved[0]["U"] == 3.2

    def test_column_registry_integration(self):
        """Test column registry with real data."""
        raw = """DATASONIC\t1700000000\t0\t0\t3.2\t-0.5\t0.1\t345.2\t15.3\t0\t0\t0\t0\t0"""
        parsed = parse_ec_data(raw, "SITE1")
        
        # Extract columns from parsed data
        if parsed:
            cols = [k for k in parsed[0].keys() if k != "timestamp"]
            
            reg = ColumnRegistry()
            reg.add_tower_columns("SITE1", cols)
            
            assert "U" in reg.get_all_columns()
            assert "V" in reg.get_all_columns()
            assert "W" in reg.get_all_columns()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
