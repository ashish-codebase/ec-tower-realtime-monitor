// Sensor group settings - grouped by similar measurements
// Dynamically generated from all tower column data

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
  allDaqmColumns: string[];
}

// Comprehensive column list based on all known tower configurations
// This includes columns from sample data and live towers
const ALL_DAQM_COLUMNS = [
  // Timestamps
  'SECONDS',
  'NANOSECONDS',
  
  // Sonic columns
  'U', 'V', 'W', 'TEMP', 'SOS', 'DIAG',
  'AIN1', 'AIN2', 'AIN3', 'AIN4', 'CHK',
  
  // Relay status
  'Relay_1_1_1', 'Relay_2_1_1', 'Relay_3_1_1',
  
  // Soil moisture (volumetric water content)
  'SWC_1_1_1', 'SWC_2_1_1', 'SWC_3_1_1', 'SWC_4_1_1', 'SWC_5_1_1', 'SWC_6_1_1',
  
  // Soil temperature
  'TS_1_1_1', 'TS_2_1_1', 'TS_3_1_1', 'TS_4_1_1', 'TS_5_1_1', 'TS_6_1_1',
  'TS_7_1_1', 'TS_8_1_1', 'TS_9_1_1',
  
  // Thermistors
  'THERMISTOR_1_1_1',
  
  // Thermocouples
  'TC_1_1_1', 'TCNR4_C_1_1_1',
  
  // Temperature sensors
  'TSENSOR_1_1_1', 'TA_1_1_1',
  
  // Heat flux
  'SHF_1_1_1', 'SHF_2_1_1', 'SHF_3_1_1',
  'SHFSENS_1_1_1', 'SHFSENS_2_1_1', 'SHFSENS_3_1_1',
  
  // Radiation
  'SWIN_1_1_1', 'SWOUT_1_1_1',
  'LWIN_1_1_1', 'LWOUT_1_1_1',
  'RN_1_1_1',
  
  // Albedo
  'ALB_1_1_1',
  
  // Air temperature and humidity
  'RH_1_1_1',
  
  // Photosynthetically active radiation
  'PPFD_1_1_1',
  
  // Rain
  'P_RAIN_1_1_1',
  
  // DAQM voltage and temperature
  'DAQM_V_1_1_1', 'DAQM_T_1_1_1',
  
  // Power status
  'DRM_POWER_STATUS_1_1_1',
  'DRM_V_BATTERY_1_1_1', 'DRM_V_MAIN_1_1_1',
  
  // AMP (current)
  'AMP',
  
  // Distance/height
  'm+3m-3',
];

// Get sensor groups (used by clusterGroups.ts)
export function getSensorGroups() {
  return SETTINGS.sensorGroups;
}

// Map column names to human-readable labels for chart titles
export const COLUMN_LABELS: Record<string, string> = {
  'U': 'Wind U',
  'V': 'Wind V',
  'W': 'Wind W',
  'TEMP': 'Sonic Temp',
  'TA_1_1_1': 'Air Temperature',
  'RH_1_1_1': 'Relative Humidity',
  'TS_1_1_1': 'Soil Temp 1',
  'TS_2_1_1': 'Soil Temp 2',
  'TS_3_1_1': 'Soil Temp 3',
  'TS_4_1_1': 'Soil Temp 4',
  'TS_5_1_1': 'Soil Temp 5',
  'TS_6_1_1': 'Soil Temp 6',
  'TS_7_1_1': 'Soil Temp 7',
  'TS_8_1_1': 'Soil Temp 8',
  'TS_9_1_1': 'Soil Temp 9',
  'SWC_1_1_1': 'Soil Moisture 1',
  'SWC_2_1_1': 'Soil Moisture 2',
  'SWC_3_1_1': 'Soil Moisture 3',
  'SWC_4_1_1': 'Soil Moisture 4',
  'SWC_5_1_1': 'Soil Moisture 5',
  'SWC_6_1_1': 'Soil Moisture 6',
};

export const SETTINGS: Settings = {
  sensorGroups: [
    {
      name: "Wind (U, V, W)",
      keys: ["U", "V", "W"],
      jenksClass: 0,
    },
    {
      name: "Air Temperature (TA)",
      keys: ["TA_1_1_1"],
      jenksClass: 1,
    },
    {
      name: "Relative Humidity (RH)",
      keys: ["RH_1_1_1"],
      jenksClass: 2,
    },
    {
      name: "Soil Temperature (TS_*)",
      keys: [
        "TS_1_1_1", "TS_2_1_1", "TS_3_1_1", "TS_4_1_1", "TS_5_1_1",
        "TS_6_1_1", "TS_7_1_1", "TS_8_1_1", "TS_9_1_1",
      ],
      jenksClass: 3,
    },
    {
      name: "Thermistor (THERMISTOR_*)",
      keys: ["THERMISTOR_1_1_1"],
      jenksClass: 4,
    },
    {
      name: "Soil Moisture (SWC_*)",
      keys: [
        "SWC_1_1_1", "SWC_2_1_1", "SWC_3_1_1", "SWC_4_1_1", "SWC_5_1_1",
        "SWC_6_1_1",
      ],
      jenksClass: 5,
    },
    {
      name: "Relay Status",
      keys: ["Relay_1_1_1", "Relay_2_1_1", "Relay_3_1_1"],
      jenksClass: 6,
    },
    {
      name: "Heat Flux (SHF_*)",
      keys: ["SHF_1_1_1", "SHF_2_1_1", "SHF_3_1_1"],
      jenksClass: 7,
    },
    {
      name: "Heat Flux Sensor (SHFSENS_*)",
      keys: ["SHFSENS_1_1_1", "SHFSENS_2_1_1", "SHFSENS_3_1_1"],
      jenksClass: 8,
    },
    {
      name: "Radiation (SWIN, SWOUT, LWIN, LWOUT, PPFD)",
      keys: ["SWIN_1_1_1", "SWOUT_1_1_1", "LWIN_1_1_1", "LWOUT_1_1_1", "PPFD_1_1_1"],
      jenksClass: 9,
    },
    {
      name: "Net Radiation (RN)",
      keys: ["RN_1_1_1"],
      jenksClass: 11,
    },
    {
      name: "Albedo (ALB)",
      keys: ["ALB_1_1_1"],
      jenksClass: 12,
    },

    {
      name: "Rain (P_RAIN)",
      keys: ["P_RAIN_1_1_1"],
      jenksClass: 14,
    },
    {
      name: "Battery Voltage (DRM_V_BATTERY)",
      keys: ["DRM_V_BATTERY_1_1_1"],
      jenksClass: 15,
    },
    {
      name: "Main Voltage (DRM_V_MAIN)",
      keys: ["DRM_V_MAIN_1_1_1"],
      jenksClass: 16,
    },
    {
      name: "Power Status",
      keys: ["DRM_POWER_STATUS_1_1_1"],
      jenksClass: 17,
    },
  ],
  generatedAt: new Date().toISOString(),
  numClasses: 18,
  allDaqmColumns: ALL_DAQM_COLUMNS,
};
