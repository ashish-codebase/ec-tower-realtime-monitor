'use client';

import { useMemo } from 'react';
import { getSensorGroups } from '@/lib/settings';
import { TowerDataPoint } from '@/types';

// Key name lookup table for display
const KEY_NAMES: Record<string, string> = {
  'U': 'Wind U', 'V': 'Wind V', 'W': 'Wind W',
  'SOS': 'Sonic Temp', 'TEMP': 'Air Temp',
  'TS_1_1_1': 'Soil T1', 'TS_2_1_1': 'Soil T2', 'TS_3_1_1': 'Soil T3',
  'TS_4_1_1': 'Soil T4', 'TS_5_1_1': 'Soil T5', 'TS_6_1_1': 'Soil T6',
  'TS_7_1_1': 'Soil T7', 'TS_8_1_1': 'Soil T8', 'TS_9_1_1': 'Soil T9',
  'SWC_1_1_1': 'Soil M1', 'SWC_2_1_1': 'Soil M2', 'SWC_3_1_1': 'Soil M3',
  'SWC_4_1_1': 'Soil M4', 'SWC_5_1_1': 'Soil M5', 'SWC_6_1_1': 'Soil M6',
  'SWIN_1_1_1': 'SW In', 'SWOUT_1_1_1': 'SW Out',
  'LWIN_1_1_1': 'LW In', 'LWOUT_1_1_1': 'LW Out',
  'PPFD_1_1_1': 'PAR (W/m²)',
  'RN_1_1_1': 'Net Rad', 'ALB_1_1_1': 'Albedo',
  'TA_1_1_1': 'Air T', 'RH_1_1_1': 'Humidity',
  'P_RAIN_1_1_1': 'Rain',
};

interface Stats {
  id: string;
  key: string;
  count: number;
  min: number;
  max: number;
  mean: number;
  stdev: number;
  duration: string;
}

function formatKey(key: string): string {
  return KEY_NAMES[key] || key;
}

interface Props {
  data: TowerDataPoint[];
}

export default function StatsTable({ data }: Props) {
  const stats = useMemo<Stats[]>(() => {
    if (data.length === 0) return [];

    // Get conversion functions from settings
    const sensorGroups = getSensorGroups();
    const conversionMap = new Map<string, (value: number) => number>();
    sensorGroups.forEach(g => {
      if (g.convert) {
        g.keys.forEach(key => conversionMap.set(key, g.convert!));
      }
    });

    // Group by key_type combo
    const groups = new Map<string, { values: number[]; firstTs: number; lastTs: number }>();

    for (const point of data) {
      for (const [key, value] of Object.entries(point)) {
        // Skip metadata fields
        if (['timestamp', 'type', 'SECONDS', 'NANOSECONDS'].includes(key)) continue;
        if (typeof value !== 'number' || isNaN(value)) continue;
        
        // Apply conversion if exists
        const converter = conversionMap.get(key);
        const convertedValue = converter ? converter(value) : value;
        
        const timestampMs = point.timestamp;
        
        if (!groups.has(key)) {
          groups.set(key, { values: [], firstTs: timestampMs, lastTs: timestampMs });
        }
        const g = groups.get(key)!;
        g.values.push(convertedValue);
        if (timestampMs < g.firstTs) g.firstTs = timestampMs;
        if (timestampMs > g.lastTs) g.lastTs = timestampMs;
      }
    }

    const result = Array.from(groups.entries())
      .map(([key, g]) => {
        const values = g.values;
        const durationMs = g.lastTs - g.firstTs;
        const durationMin = Math.round(durationMs / 60000);
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;

        return {
          id: key,
          key,
          count: values.length,
          min: Math.min(...values),
          max: Math.max(...values),
          mean,
          stdev: Math.sqrt(variance),
          duration: `${durationMin} min`,
        };
      })
      .sort((a, b) => a.id.localeCompare(b.id));

    return result;
  }, [data]);

  if (stats.length === 0) return null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-gray-300 dark:border-gray-600">
            <th className="text-center py-2 px-3 font-semibold w-12">ID</th>
            <th className="text-left py-2 px-3 font-semibold">Key</th>
            <th className="text-right py-2 px-3 font-semibold">Count</th>
            <th className="text-right py-2 px-3 font-semibold">Min</th>
            <th className="text-right py-2 px-3 font-semibold">Max</th>
            <th className="text-right py-2 px-3 font-semibold">Mean</th>
            <th className="text-right py-2 px-3 font-semibold">StDev</th>
            <th className="text-right py-2 px-3 font-semibold">Duration</th>
          </tr>
        </thead>
        <tbody>
          {stats.map((s) => (
            <tr key={s.key} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">
              <td className="py-1.5 px-3 text-center font-mono text-xs">{s.id}</td>
              <td className="py-1.5 px-3 font-mono text-xs">{formatKey(s.key)}</td>
              <td className="py-1.5 px-3 text-right">{s.count}</td>
              <td className="py-1.5 px-3 text-right">{s.min.toFixed(2)}</td>
              <td className="py-1.5 px-3 text-right">{s.max.toFixed(2)}</td>
              <td className="py-1.5 px-3 text-right">{s.mean.toFixed(2)}</td>
              <td className="py-1.5 px-3 text-right">{s.stdev.toFixed(2)}</td>
              <td className="py-1.5 px-3 text-right">{s.duration}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
