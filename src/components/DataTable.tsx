'use client';

import { useMemo, useState } from 'react';
import { TowerDataPoint } from '@/types';

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

function formatMstTime(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000);
  return d.toLocaleString('en-US', {
    timeZone: 'America/Denver',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

interface Props {
  data: TowerDataPoint[];
}

export default function DataTable({ data }: Props) {
  const [sortCol, setSortCol] = useState<string>('timestamp');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(0);
  const pageSize = 50;

  // Collect all unique key_sensor combos (e.g. "116_0", "118_1")
  const allKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const p of data) {
      for (const r of p.readings) {
        for (const k of Object.keys(r)) {
          keys.add(`${k}_${p.sensor}`);
        }
      }
    }
    return Array.from(keys).sort();
  }, [data]);

  // Flatten to rows — store values under key_sensor keys
  const rows = useMemo(() => {
    return data.map(p => {
      const row: Record<string, number | string> = {
        timestamp: p.timestamp,
        sensor: p.sensor,
        name: p.name,
      };
      for (const r of p.readings) {
        for (const [k, v] of Object.entries(r)) {
          row[`${k}_${p.sensor}`] = v;
        }
      }
      return row;
    });
  }, [data]);

  // Sort
  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const aVal = a[sortCol];
      const bVal = b[sortCol];
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
      }
      return sortDir === 'asc'
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });
  }, [rows, sortCol, sortDir]);

  // Paginate
  const totalPages = Math.ceil(sorted.length / pageSize);
  const pageData = sorted.slice(page * pageSize, (page + 1) * pageSize);

  const handleSort = (col: string) => {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  const getKeyName = (key: string) => KEY_NAMES[key] || key;

  return (
    <div className="space-y-2">
      {/* Summary */}
      <div className="text-sm text-gray-500 dark:text-gray-400 flex justify-between">
        <span>{rows.length} records · {allKeys.length} keys</span>
        <span>Page {page + 1} of {totalPages || 1}</span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto max-h-[600px] overflow-y-auto border rounded-lg">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 bg-white dark:bg-gray-800 z-10">
            <tr className="border-b border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700">
              <th
                className="text-left py-2 px-3 font-semibold cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 select-none whitespace-nowrap"
                onClick={() => handleSort('timestamp')}
              >
                {sortCol === 'timestamp' ? (sortDir === 'asc' ? '↑' : '↓') : ''} MST Time
              </th>
              <th
                className="text-left py-2 px-3 font-semibold cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 select-none whitespace-nowrap"
                onClick={() => handleSort('sensor')}
              >
                {sortCol === 'sensor' ? (sortDir === 'asc' ? '↑' : '↓') : ''} Sensor
              </th>
              {allKeys.map(key => {
                const parts = key.split('_');
                const sensorNum = parts[parts.length - 1];
                const rawKey = parts.slice(0, -1).join('_');
                return (
                  <th
                    key={key}
                    className="text-right py-2 px-3 font-semibold cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 select-none whitespace-nowrap"
                    onClick={() => handleSort(key)}
                  >
                    {sortCol === key ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                    <div className="text-xs text-gray-400 font-normal">{getKeyName(rawKey)}<sub>{sensorNum}</sub></div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {pageData.map((row, i) => (
              <tr key={i} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="py-1 px-3 font-mono text-xs whitespace-nowrap">
                  {formatMstTime(row.timestamp as number)}
                </td>
                <td className="py-1 px-3">
                  <span className="inline-block px-2 py-0.5 rounded text-xs bg-gray-100 dark:bg-gray-700">
                    S{row.sensor}
                  </span>
                  <span className="text-xs text-gray-400 ml-1">{row.name}</span>
                </td>
                {allKeys.map(key => (
                  <td key={key} className="py-1 px-3 text-right font-mono text-xs">
                    {row[key] !== undefined ? Number(row[key]).toPrecision(4) : '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setPage(p => Math.max(0, p - 1))}
          disabled={page === 0}
          className="px-3 py-1 text-sm rounded border disabled:opacity-30 hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          ← Prev
        </button>
        <div className="flex gap-1">
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            let p: number;
            if (totalPages <= 5) p = i;
            else if (page < 3) p = i;
            else if (page > totalPages - 4) p = totalPages - 5 + i;
            else p = page - 2 + i;
            return (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`w-8 h-8 text-sm rounded ${p === page ? 'bg-blue-600 text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
              >
                {p + 1}
              </button>
            );
          })}
        </div>
        <button
          onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
          disabled={page >= totalPages - 1}
          className="px-3 py-1 text-sm rounded border disabled:opacity-30 hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          Next →
        </button>
      </div>
    </div>
  );
}
