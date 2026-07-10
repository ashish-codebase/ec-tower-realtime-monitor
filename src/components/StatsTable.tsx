'use client';

import { useMemo } from 'react';
import { getSensorGroups } from '@/lib/settings';

interface Reading {
  [key: string]: number;
}

export interface SensorDataPoint {
  sensor: string;
  name: string;
  timestamp: number;
  readings: Reading[];
}

// Key name lookup table
const KEY_NAMES: Record<string, string> = {
  '22': 'WNV', '23': 'WNW', '24': 'WNZ',
  '34': 'UST', '43': 'Ustar', '36': 'H',
  '52': 'LE', '122': 'G', '45': 'Tair',
  '116': 'T2m', '88': 'Tsoil1', '89': 'Tsoil2',
  '115': 'CO2_flux', '117': 'wCO2', '119': 'wQ',
  '54': 'Rn', '123': 'SW_down', '124': 'SW_up',
  '125': 'LW_down', '127': 'LW_up', '128': 'VPD',
  '129': 'Tair_129', '130': 'Press_130', '131': 'CO2_dens',
  '132': 'H2O_dens', '121': 'PAR', '210': 'WindSpd',
  '211': 'WindDir', '118': 'RH', '120': 'Press',
};

interface Stats {
  id: number;
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
  data: SensorDataPoint[];
}

export default function StatsTable({ data }: Props) {
  const stats = useMemo<Stats[]>(() => {
    if (data.length === 0) return [];

    // Group by key_sensor combo
    const groups = new Map<string, { values: number[]; firstTs: number; lastTs: number }>();

    for (const point of data) {
      for (const r of point.readings) {
        for (const [key, value] of Object.entries(r)) {
          const comboKey = `${key}_${point.sensor}`;
          if (!groups.has(comboKey)) {
            groups.set(comboKey, { values: [], firstTs: point.timestamp * 1000, lastTs: point.timestamp * 1000 });
          }
          const g = groups.get(comboKey)!;
          g.values.push(value);
          const ts = point.timestamp * 1000;
          if (ts < g.firstTs) g.firstTs = ts;
          if (ts > g.lastTs) g.lastTs = ts;
        }
      }
    }

    const result = Array.from(groups.entries())
      .map(([comboKey, g]) => {
        const parts = comboKey.split('_');
        const sensor = parts[parts.length - 1];
        const key = parts.slice(0, -1).join('_');
        const id = parseInt(key, 10);
        const values = g.values;
        const durationMs = g.lastTs - g.firstTs;
        const durationMin = Math.round(durationMs / 60000);

        return {
          id,
          key,
          sensor,
          count: values.length,
          min: Math.min(...values),
          max: Math.max(...values),
          mean: values.reduce((a, b) => a + b, 0) / values.length,
          duration: `${durationMin} min`,
        };
      })
      .sort((a, b) => a.id - b.id);

    // Assign Jenks classes from settings (pre-computed, one-time)
    const sensorGroups = getSensorGroups();
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
