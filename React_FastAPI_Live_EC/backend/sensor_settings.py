"""Sensor group settings — mirrors src/lib/settings.ts"""

from typing import Callable, Optional


class SensorGroupSetting:
    def __init__(self, name: str, keys: list[str], convert: Optional[Callable[[float], float]] = None):
        self.name = name
        self.keys = keys
        self.convert = convert


class Settings:
    def __init__(self, sensor_groups: list[SensorGroupSetting], all_daqm_columns: list[str]):
        self.sensor_groups = sensor_groups
        self.all_daqm_columns = all_daqm_columns
        self.generated_at = "2025-07-19T00:00:00Z"


ALL_DAQM_COLUMNS = [
    "SECONDS", "NANOSECONDS",
    "U", "V", "W", "TEMP", "SOS", "DIAG",
    "AIN1", "AIN2", "AIN3", "AIN4", "CHK",
    "Relay_1_1_1", "Relay_2_1_1", "Relay_3_1_1",
    "SWC_1_1_1", "SWC_2_1_1", "SWC_3_1_1", "SWC_4_1_1", "SWC_5_1_1", "SWC_6_1_1",
    "TS_1_1_1", "TS_2_1_1", "TS_3_1_1", "TS_4_1_1", "TS_5_1_1", "TS_6_1_1",
    "TS_7_1_1", "TS_8_1_1", "TS_9_1_1",
    "THERMISTOR_1_1_1",
    "TC_1_1_1", "TCNR4_C_1_1_1",
    "TSENSOR_1_1_1", "TA_1_1_1",
    "SHF_1_1_1", "SHF_2_1_1", "SHF_3_1_1",
    "SHFSENS_1_1_1", "SHFSENS_2_1_1", "SHFSENS_3_1_1",
    "SWIN_1_1_1", "SWOUT_1_1_1",
    "LWIN_1_1_1", "LWOUT_1_1_1",
    "RN_1_1_1",
    "ALB_1_1_1",
    "RH_1_1_1",
    "PPFD_1_1_1",
    "P_RAIN_1_1_1",
    "DAQM_V_1_1_1", "DAQM_T_1_1_1",
    "DRM_POWER_STATUS_1_1_1",
    "DRM_V_BATTERY_1_1_1", "DRM_V_MAIN_1_1_1",
    "AMP", "m+3m-3",
]

PPFD_CONVERT = lambda v: v * 0.51


def get_settings() -> Settings:
    return Settings(
        sensor_groups=[
            SensorGroupSetting("Wind (U, V, W)", ["U", "V", "W"]),
            SensorGroupSetting("Air Temperature (TA)", ["TA_1_1_1"]),
            SensorGroupSetting("Relative Humidity (RH)", ["RH_1_1_1"]),
            SensorGroupSetting("Soil Temperature (TS_*)", ["TS_1_1_1", "TS_2_1_1", "TS_3_1_1", "TS_4_1_1", "TS_5_1_1", "TS_6_1_1", "TS_7_1_1", "TS_8_1_1", "TS_9_1_1"]),
            SensorGroupSetting("Thermistor (THERMISTOR_*)", ["THERMISTOR_1_1_1"]),
            SensorGroupSetting("Soil Moisture (SWC_*)", ["SWC_1_1_1", "SWC_2_1_1", "SWC_3_1_1", "SWC_4_1_1", "SWC_5_1_1", "SWC_6_1_1"]),
            SensorGroupSetting("Relay Status", ["Relay_1_1_1", "Relay_2_1_1", "Relay_3_1_1"]),
            SensorGroupSetting("Heat Flux (SHF_*)", ["SHF_1_1_1", "SHF_2_1_1", "SHF_3_1_1"]),
            SensorGroupSetting("Heat Flux Sensor (SHFSENS_*)", ["SHFSENS_1_1_1", "SHFSENS_2_1_1", "SHFSENS_3_1_1"]),
            SensorGroupSetting("Radiation (SWIN, SWOUT, LWIN, LWOUT, PPFD)", ["SWIN_1_1_1", "SWOUT_1_1_1", "LWIN_1_1_1", "LWOUT_1_1_1", "PPFD_1_1_1"], PPFD_CONVERT),
            SensorGroupSetting("Net Radiation (RN)", ["RN_1_1_1"]),
            SensorGroupSetting("Albedo (ALB)", ["ALB_1_1_1"]),
            SensorGroupSetting("Rain (P_RAIN)", ["P_RAIN_1_1_1"]),
            SensorGroupSetting("DRM Power & Voltage", ["DRM_V_MAIN_1_1_1", "DRM_POWER_STATUS_1_1_1"]),
        ],
        all_daqm_columns=ALL_DAQM_COLUMNS,
    )
