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
  sensor: string;
  count: number;
  min: number;
  max: number;
  mean: number;
  duration: string;
  jenksClass: number;
}

function formatKey(key: string, sensor: string): string {
  const name = KEY_NAMES[key] || key;
  return `${name}<sub>${sensor}</sub>`;
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
        
        const comboKey = `${key}__${point.type}`;
        if (!groups.has(comboKey)) {
          groups.set(comboKey, { values: [], firstTs: point.timestamp * 1000, lastTs: point.timestamp * 1000 });
        }
        const g = groups.get(comboKey)!;
        g.values.push(convertedValue);
        const ts = point.timestamp * 1000;
        if (ts < g.firstTs) g.firstTs = ts;
        if (ts > g.lastTs) g.lastTs = ts;
      }
    }

    const result = Array.from(groups.entries())
      .map(([comboKey, g]) => {
        // Split on double underscore to preserve keys with single underscores
        const parts = comboKey.split('__');
        const key = parts[0];
        const type = parts[1];
        const values = g.values;
        const durationMs = g.lastTs - g.firstTs;
        const durationMin = Math.round(durationMs / 60000);

        return {
          id: key,
          key,
          sensor: type,
          count: values.length,
          min: Math.min(...values),
          max: Math.max(...values),
          mean: values.reduce((a, b) => a + b, 0) / values.length,
          duration: `${durationMin} min`,
          jenksClass: 0,
        };
      })
      .sort((a, b) => a.id.localeCompare(b.id));

    // Assign Jenks classes from settings (pre-computed, one-time)
    result.forEach(s => {
      const group = sensorGroups.find(g => g.keys.includes(s.key));
      s.jenksClass = group ? group.jenksClass : 0;
    });

    return result;
  }, [data]);

  if (stats.length === 0) return null;

  // Jenks class colors
  const classColors = [
    'bg-blue-100 dark:bg-blue-900/30',
    'bg-green-100 dark:bg-green-900/30',
    'bg-yellow-100 dark:bg-yellow-900/30',
    'bg-orange-100 dark:bg-orange-900/30',
    'bg-red-100 dark:bg-red-900/30',
  ];

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
            <th className="text-center py-2 px-3 font-semibold">Class</th>
            <th className="text-right py-2 px-3 font-semibold">Duration</th>
          </tr>
        </thead>
        <tbody>
          {stats.map((s) => (
            <tr key={`${s.key}_${s.sensor}`} className={`border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 ${classColors[s.jenksClass] || ''}`}>
              <td className="py-1.5 px-3 text-center font-mono text-xs">{s.id}</td>
              <td className="py-1.5 px-3 font-mono text-xs" dangerouslySetInnerHTML={{ __html: formatKey(s.key, s.sensor) }} />
              <td className="py-1.5 px-3 text-right">{s.count}</td>
              <td className="py-1.5 px-3 text-right">{s.min.toFixed(2)}</td>
              <td className="py-1.5 px-3 text-right">{s.max.toFixed(2)}</td>
              <td className="py-1.5 px-3 text-right">{s.mean.toFixed(2)}</td>
              <td className="py-1.5 px-3 text-center font-semibold">{s.jenksClass + 1}</td>
              <td className="py-1.5 px-3 text-right">{s.duration}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
