'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Site, SensorDataPoint } from '@/types';
import { getSensorGroups } from '@/lib/settings';
import SiteSelector from './SiteSelector';
import TimeSeriesChart from './TimeSeriesChart';
import StatsTable from './StatsTable';
import ErrorBanner from './ErrorBanner';
import ThemeToggle from './ThemeToggle';
import TimeRangeSlider from './TimeRangeSlider';

const POLL_MS = 5 * 60 * 1000; // 5 minutes

export default function Dashboard() {
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedIp, setSelectedIp] = useState<string>('');
  const [data, setData] = useState<SensorDataPoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [timeRange, setTimeRange] = useState<[number, number] | null>(null);

  // Load sites
  useEffect(() => {
    fetch('/api/sites')
      .then((r) => r.json())
      .then((json) => {
        setSites(json.sites || []);
        if (json.sites?.length && !selectedIp) {
          setSelectedIp(json.sites[0].ip);
        }
      });
  }, [selectedIp]);

  // Load data for selected site
  const loadData = useCallback(async () => {
    if (!selectedIp) return;
    setLoading(true);
    setError(null);
    try {
      const ipFile = selectedIp.replace(/\./g, '_');
      const res = await fetch(`/api/data/${ipFile}.json`);
      const json = await res.json();
      setData(json.data || []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [selectedIp]);

  // Auto-poll every 5 minutes + load on mount/site change
  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, POLL_MS);
    return () => clearInterval(interval);
  }, [loadData]);

  // Initialize time range to full data range
  useEffect(() => {
    if (data.length > 0 && !timeRange) {
      const timestamps = data.map(p => p.timestamp * 1000);
      const min = Math.min(...timestamps);
      const max = Math.max(...timestamps);
      setTimeRange([min, max]);
    }
  }, [data, timeRange]);

  // Filter data by time range
  const filteredData = useMemo(() => {
    if (!timeRange || timeRange[0] === 0 && timeRange[1] === 0) return data;
    return data.filter(p => {
      const ts = p.timestamp * 1000;
      return ts >= timeRange[0] && ts <= timeRange[1];
    });
  }, [data, timeRange]);

  // Trigger manual fetch (for towers on reachable network)
  const handleFetch = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/fetch');
      const json = await res.json();
      if (json.results?.some((r: any) => r.status === 'error')) {
        const errs = json.results.filter((r: any) => r.status === 'error');
        setError(`${errs.length} site(s) failed to fetch`);
      }
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const selectedSite = sites.find((s) => s.ip === selectedIp);

  // Build cluster groups from settings
  const clusterGroups = useMemo(() => {
    const groups = getSensorGroups();
    const clusters = new Map<number, { name: string; keys: string[] }>();
    
    groups.forEach((g) => {
      if (!clusters.has(g.jenksClass)) {
        clusters.set(g.jenksClass, {
          name: `Cluster ${g.jenksClass + 1}`,
          keys: [],
        });
      }
      clusters.get(g.jenksClass)!.keys.push(...g.keys);
    });
    
    return Array.from(clusters.values());
  }, []);
  
  // Filter clusters to only those with data
  const activeClusters = clusterGroups.filter((c) =>
    data.some((p) =>
      p.readings.some((r) => c.keys.some((k) => k in r))
    )
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">EC Tower Live Monitor</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {selectedSite ? `${selectedSite.name} (${selectedIp})` : 'Select a site'}
          </p>
        </div>
        <ThemeToggle />
      </div>

      {/* Error Banner */}
      <ErrorBanner message={error} onClose={() => setError(null)} />

      {/* Site Selector */}
      <SiteSelector sites={sites} selected={selectedIp} onChange={setSelectedIp} />

      {/* Controls */}
      <div className="mb-4 flex gap-3">
        <button
          onClick={handleFetch}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded text-sm font-medium transition"
        >
          {loading ? 'Fetching...' : '🔄 Fetch Now'}
        </button>
        <span className="text-xs text-gray-500 self-center">Auto-poll every 5 min</span>
      </div>

      {/* Time Range Slider */}
      {data.length > 0 && timeRange && (
        <div className="mb-6">
          <TimeRangeSlider
            minTimestamp={Math.min(...data.map(p => p.timestamp * 1000))}
            maxTimestamp={Math.max(...data.map(p => p.timestamp * 1000))}
            value={timeRange}
            onChange={setTimeRange}
          />
        </div>
      )}

      {/* Charts - grouped by K-means clusters */}
      {filteredData.length > 0 && activeClusters.length > 0 && (
        <div className="space-y-8 mb-8">
          {activeClusters.map((cluster) => (
            <div key={cluster.name} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700" style={{ minHeight: 300 }}>
              <TimeSeriesChart 
                data={filteredData} 
                sensorKeys={cluster.keys} 
                title={cluster.name}
                timeRange={timeRange || undefined}
              />
            </div>
          ))}
        </div>
      )}

      {/* Stats Table */}
      {filteredData.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold mb-3">Statistics</h2>
          <StatsTable data={filteredData} />
        </div>
      )}

      {/* No data state */}
      {data.length === 0 && !loading && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg">No data loaded yet.</p>
          <p className="text-sm mt-2">Click "Fetch Now" to pull data from the tower.</p>
        </div>
      )}

      {/* No active clusters */}
      {data.length > 0 && activeClusters.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg">No sensor data matches configured groups.</p>
        </div>
      )}
    </div>
  );
}
