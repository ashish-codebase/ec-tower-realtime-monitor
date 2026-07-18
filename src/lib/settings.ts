// Sensor group settings - grouped by similar measurements
// Based on Python build_daqm.py column names

export interface SensorGroupSetting {
  name: string;
  keys: string[];
  jenksClass: number;
  convert?: (value: number) => number; // optional conversion function
}

export interface Settings {
  sensorGroups: SensorGroupSetting[];
  generatedAt: string;
  numClasses: number;
}

export const SETTINGS: Settings = {
  "sensorGroups": [
    {
      "name": "Wind (U, V, W)",
      "keys": ["U", "V", "W"],
      "jenksClass": 0
    },
    {
      "name": "Soil Temperature (TS_*)",
      "keys": ["TS_1_1_1", "TS_2_1_1", "TS_3_1_1", "TS_4_1_1", "TS_5_1_1", "TS_6_1_1", "TS_7_1_1", "TS_8_1_1", "TS_9_1_1"],
      "jenksClass": 1
    },
    {
      "name": "Soil Moisture (SWC_*)",
      "keys": ["SWC_1_1_1", "SWC_2_1_1", "SWC_3_1_1", "SWC_4_1_1", "SWC_5_1_1", "SWC_6_1_1"],
      "jenksClass": 2
    },
    {
      "name": "Relay Status",
      "keys": ["Relay_1_1_1", "Relay_2_1_1", "Relay_3_1_1"],
      "jenksClass": 3
    },
    {
      "name": "Heat Flux (SHF_*)",
      "keys": ["SHF_1_1_1", "SHF_2_1_1", "SHF_3_1_1"],
      "jenksClass": 4
    },
    {
      "name": "Heat Flux Sensor (SHFSENS_*)",
      "keys": ["SHFSENS_1_1_1", "SHFSENS_2_1_1", "SHFSENS_3_1_1"],
      "jenksClass": 5
    },
    {
      "name": "Radiation (SWIN, SWOUT, LWIN, LWOUT)",
      "keys": ["SWIN_1_1_1", "SWOUT_1_1_1", "LWIN_1_1_1", "LWOUT_1_1_1"],
      "jenksClass": 6
    },
    {
      "name": "PAR (PPFD → W/m²)",
      "keys": ["PPFD_1_1_1"],
      "jenksClass": 7,
      "convert": (value: number) => value * 0.51
    },
    {
      "name": "Net Radiation (RN)",
      "keys": ["RN_1_1_1"],
      "jenksClass": 8
    },
    {
      "name": "Albedo (ALB)",
      "keys": ["ALB_1_1_1"],
      "jenksClass": 9
    },
    {
      "name": "Air Temperature (TA)",
      "keys": ["TA_1_1_1"],
      "jenksClass": 10
    },
    {
      "name": "Humidity (RH)",
      "keys": ["RH_1_1_1"],
      "jenksClass": 11
    },
    {
      "name": "Rain (P_RAIN)",
      "keys": ["P_RAIN_1_1_1"],
      "jenksClass": 12
    },
    {
      "name": "Sonic Temperature (SOS)",
      "keys": ["SOS"],
      "jenksClass": 13
    },
    {
      "name": "Sonic Temp (TEMP)",
      "keys": ["TEMP"],
      "jenksClass": 14
    },
    {
      "name": "Thermocouple (TC_*)",
      "keys": ["TC_1_1_1", "TSENSOR_1_1_1"],
      "jenksClass": 15
    },
    {
      "name": "DAQM Voltage/Temp",
      "keys": ["DAQM_V_1_1_1", "DAQM_T_1_1_1"],
      "jenksClass": 16
    },
    {
      "name": "Battery Power",
      "keys": ["DRM_V_BATTERY_1_1_1", "DRM_V_MAIN_1_1_1", "DRM_POWER_STATUS_1_1_1"],
      "jenksClass": 17
    }
  ],
  "generatedAt": new Date().toISOString(),
  "numClasses": 18
};

export function getSensorGroups(): SensorGroupSetting[] {
  return SETTINGS.sensorGroups;
}
