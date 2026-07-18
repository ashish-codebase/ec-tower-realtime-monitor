'use client';

import '@/lib/chart-init';
import { Chart as ChartComponent } from 'react-chartjs-2';
import 'chartjs-adapter-date-fns';
import { useMemo } from 'react';
import { TowerDataPoint } from '@/types';
import { getSensorGroups } from '@/lib/settings';

interface Reading {
  [key: string]: number;
}

const KEY_NAMES: Record<string, string> = {
  // Wind
  'U': 'U (N-S)', 'V': 'V (E-W)', 'W': 'W (vert)',
  // Temperature
  'TEMP': 'Sonic Temp', 'TA_1_1_1': 'Air Temp',
  // Humidity
  'RH_1_1_1': 'Rel Humidity',
  // Soil
  'TS_1_1_1': 'Soil T1', 'TS_2_1_1': 'Soil T2', 'TS_3_1_1': 'Soil T3',
  'TS_4_1_1': 'Soil T4', 'TS_5_1_1': 'Soil T5', 'TS_6_1_1': 'Soil T6',
  'TS_7_1_1': 'Soil T7', 'TS_8_1_1': 'Soil T8', 'TS_9_1_1': 'Soil T9',
  'THERMISTOR_1_1_1': 'Thermistor',
  // Soil moisture
  'SWC_1_1_1': 'SWC1', 'SWC_2_1_1': 'SWC2', 'SWC_3_1_1': 'SWC3',
  'SWC_4_1_1': 'SWC4', 'SWC_5_1_1': 'SWC5', 'SWC_6_1_1': 'SWC6',
  // Relay
  'Relay_1_1_1': 'Relay1', 'Relay_2_1_1': 'Relay2', 'Relay_3_1_1': 'Relay3',
  // Heat flux
  'SHF_1_1_1': 'HF1', 'SHF_2_1_1': 'HF2', 'SHF_3_1_1': 'HF3',
  'SHFSENS_1_1_1': 'HFS1', 'SHFSENS_2_1_1': 'HFS2', 'SHFSENS_3_1_1': 'HFS3',
  // Radiation
  'SWIN_1_1_1': 'SW_in', 'SWOUT_1_1_1': 'SW_out',
  'LWIN_1_1_1': 'LW_in', 'LWOUT_1_1_1': 'LW_out',
  'RN_1_1_1': 'Net Rad',
  // Albedo
  'ALB_1_1_1': 'Albedo',
  // PAR
  'PPFD_1_1_1': 'PAR',
  // Rain
  'P_RAIN_1_1_1': 'Rain',
  // Power
  'DRM_V_BATTERY_1_1_1': 'Batt V', 'DRM_V_MAIN_1_1_1': 'Main V',
  'DRM_POWER_STATUS_1_1_1': 'Pwr Status',
};

const SENSOR_COLORS = [
  '#2563eb', '#dc2626', '#16a34a', '#ca8a04', '#9333ea',
  '#0891b2', '#e11d48', '#65a30d', '#ea580c', '#7c3aed',
];

interface Props {
  data: TowerDataPoint[];
  sensorKeys: string[]; // e.g. ['45', '116', '129'] for AirTemp group
  title: string;        // e.g. "Air Temperature"
  timeRange?: [number, number]; // optional [start, end] in ms
}

export default function TimeSeriesChart({ data, sensorKeys, title, timeRange }: Props) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const config = useMemo(() => {
    if (sensorKeys.length === 0) return null;

    // Get conversion functions from settings
    const sensorGroups = getSensorGroups();
    const conversionMap = new Map<string, (value: number) => number>();
    sensorGroups.forEach(g => {
      if (g.convert) {
        g.keys.forEach(key => conversionMap.set(key, g.convert!));
      }
    });

    // Group points by type-key combo
    const sensorKeyPoints: Record<string, { x: number; y: number }[]> = {};

    let debugCount = 0;
    for (const point of data) {
      for (const key of sensorKeys) {
        // Check if the key exists in the point (for both old and new format)
        const value = point[key];
        if (value !== undefined && !isNaN(value as number)) {
          // Apply conversion if exists (e.g., PPFD -> W/m²)
          const converter = conversionMap.get(key);
          const convertedValue = converter ? converter(value as number) : (value as number);
          
          // Ensure timestamp is in milliseconds
          // If timestamp looks like seconds (< 1e12), multiply by 1000
          // If already milliseconds (> 1e12), use as-is
          const timestampMs = point.timestamp < 1e12 ? point.timestamp * 1000 : point.timestamp;
          
          // Debug: log first few timestamps
          if (debugCount < 3) {
            console.log(`[Chart] Point ${debugCount}: timestamp=${point.timestamp}, normalized=${timestampMs}, type=${point.type}`);
            debugCount++;
          }
          
          const groupKey = `${point.type}|||${key}`;
          if (!sensorKeyPoints[groupKey]) {
            sensorKeyPoints[groupKey] = [];
          }
          sensorKeyPoints[groupKey].push({ x: timestampMs, y: convertedValue });
        }
      }
    }

    const datasets = Object.entries(sensorKeyPoints).map(([groupKey, points], i) => {
      const [type, key] = groupKey.split('|||');
      const colors = SENSOR_COLORS[i % SENSOR_COLORS.length];
      return {
        label: `${KEY_NAMES[key] || key} (${type})`,
        data: points.sort((a, b) => a.x - b.x),
        borderColor: colors,
        borderWidth: 1.5,
        pointRadius: 2,
        pointBackgroundColor: colors,
        pointHitRadius: 8,
        tension: 0,
        fill: false,
      };
    });

    if (datasets.length === 0) return null;

    const options: any = {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 300 },
      interaction: { mode: 'nearest' as const, intersect: false },
      plugins: {
        title: { display: true, text: title, font: { size: 14 } },
        legend: {
          display: true,
          position: 'top' as const,
        },
        tooltip: {
          callbacks: {
            title: (items: { parsed: { x: number } }[]) => {
              if (!items?.length) return '';
              return new Date(items[0].parsed.x).toLocaleString('en-US', { timeZone: 'America/Denver' });
            },
            label: (item: { parsed: { y: number }; datasetLabel: string }) => {
              return `${item.datasetLabel}: ${item.parsed.y}`;
            },
          },
        },
      },
      scales: {
        x: {
          type: 'time',
          time: {
            unit: 'hour',
            tooltipFormat: 'MMM dd, HH:mm',
            displayFormats: {
              hour: 'HH:mm',
              day: 'MMM dd',
            },
          },
          title: { display: true, text: 'Time (MT)' },
          ticks: { maxTicksLimit: 12 },
        },
        y: {
          title: { display: true, text: title },
        },
      },
    };

    // Apply time range to x-axis
    if (timeRange) {
      options.scales.x.min = timeRange[0];
      options.scales.x.max = timeRange[1];
    }

    return {
      type: 'line' as const,
      data: { datasets },
      options,
    };
  }, [data, sensorKeys, title, timeRange]);

  if (!config) {
    return <div className="text-center py-8 text-gray-400">No data available</div>;
  }

  return (
    <div style={{ width: '100%', height: 300 }}>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <ChartComponent {...(config as any)} />
    </div>
  );
}
