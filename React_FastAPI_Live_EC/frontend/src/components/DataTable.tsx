import { useMemo, useState } from 'react';
import { TowerDataPoint } from '../types';
import { formatMstTime } from '../utils';

interface Props {
  data: TowerDataPoint[];
}

export default function DataTable({ data }: Props) {
  const [sortCol, setSortCol] = useState<string>('timestamp');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(0);
  const pageSize = 50;

  const allKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const p of data) {
      for (const k of Object.keys(p)) {
        if (['timestamp', 'SECONDS', 'NANOSECONDS'].includes(k)) continue;
        if (typeof p[k] !== 'number') continue;
        keys.add(k);
      }
    }
    return Array.from(keys).sort();
  }, [data]);

  const rows = useMemo(() => {
    return data.map(p => {
      const row: Record<string, number | string> = { timestamp: p.timestamp };
      for (const [k, v] of Object.entries(p)) {
        if (['timestamp', 'SECONDS', 'NANOSECONDS'].includes(k)) continue;
        if (typeof v !== 'number') continue;
        row[k] = v;
      }
      return row;
    });
  }, [data]);

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

  return (
    <div className="space-y-2">
      <div className="text-sm text-gray-500 dark:text-gray-400 flex justify-between">
        <span>{rows.length} records · {allKeys.length} keys</span>
        <span>Page {page + 1} of {totalPages || 1}</span>
      </div>

      <div className="overflow-x-auto max-h-[600px] overflow-y-auto border rounded-lg">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 bg-white dark:bg-gray-800 z-10">
            <tr className="border-b border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700">
              <th className="text-left py-2 px-3 font-semibold cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 select-none whitespace-nowrap" onClick={() => handleSort('timestamp')}>
                {sortCol === 'timestamp' ? (sortDir === 'asc' ? '↑' : '↓') : ''} MST Time
              </th>
              {allKeys.map(key => (
                <th key={key} className="text-right py-2 px-3 font-semibold cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 select-none whitespace-nowrap" onClick={() => handleSort(key)}>
                  {sortCol === key ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                  <div className="text-xs text-gray-400 font-normal">{key}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageData.map((row, i) => (
              <tr key={i} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="py-1 px-3 font-mono text-xs whitespace-nowrap">{formatMstTime(row.timestamp as number)}</td>
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

      <div className="flex items-center justify-between">
        <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="px-3 py-1 text-sm rounded border disabled:opacity-30 hover:bg-gray-100 dark:hover:bg-gray-700">← Prev</button>
        <div className="flex gap-1">
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            let p: number;
            if (totalPages <= 5) p = i;
            else if (page < 3) p = i;
            else if (page > totalPages - 4) p = totalPages - 5 + i;
            else p = page - 2 + i;
            return (
              <button key={p} onClick={() => setPage(p)} className={`w-8 h-8 text-sm rounded ${p === page ? 'bg-blue-600 text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}>{p + 1}</button>
            );
          })}
        </div>
        <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="px-3 py-1 text-sm rounded border disabled:opacity-30 hover:bg-gray-100 dark:hover:bg-gray-700">Next →</button>
      </div>
    </div>
  );
}
