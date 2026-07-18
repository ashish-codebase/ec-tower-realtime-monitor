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
  '14': 'Temp', '22': 'WNV', '23': 'WNW', '24': 'WNZ',
  '34': 'UST', '36': 'H', '43': 'Ustar', '45': 'Tair',
  '52': 'LE', '54': 'Rn', '61': 'Voltage', '63': 'Current',
  '70': 'Resistivity', '72': 'Pressure', '79': 'Depth', '81': 'Level',
  '88': 'Tsoil1', '89': 'Tsoil2', '115': 'CO2_flux',
  '116': 'T2m', '117': 'wCO2', '118': 'RH', '119': 'wQ',
  '120': 'Press', '121': 'PAR', '122': 'G', '123': 'SW_down',
  '124': 'SW_up', '125': 'LW_down', '127': 'LW_up', '128': 'VPD',
  '129': 'Tair_129', '130': 'Press_130', '131': 'CO2_dens',
  '132': 'H2O_dens', '210': 'WindSpd', '211': 'WindDir',
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
