'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  const [fetching, setFetching] = useState(false);
  const [lastFetchTime, setLastFetchTime] = useState<Date | null>(null);
  const [timeRange, setTimeRange] = useState<[number, number] | null>(null);
  const [siteStatuses, setSiteStatuses] = useState<{ [key: string]: 'live' | 'not-found' | 'checking' }>({});

  // Load sites
  useEffect(() => {
    fetch('/api/sites', { signal: AbortSignal.timeout(10000) })
      .then((r) => {
        if (!r.ok) throw new Error(`Sites error: ${r.status}`);
        return r.text();
      })
      .then((text) => {
        if (!text) return { sites: [] };
        return JSON.parse(text);
      })
      .then((json) => {
        setSites(json.sites || []);
        if (json.sites?.length && !selectedIp) {
          setSelectedIp(json.sites[0].ip);
        }
      })
      .catch(() => setSites([]));
  }, [selectedIp]);

  // Load data for selected site
  const loadData = useCallback(async () => {
    if (!selectedIp) return;
    setLoading(true);
    setError(null);
    try {
      // Find site name from selected IP
      const selectedSite = sites.find((s) => s.ip === selectedIp);
      const siteName = selectedSite?.name || selectedIp.replace(/\./g, '_');
      
      const res = await fetch(`/api/data/${siteName}.json`, {
        signal: AbortSignal.timeout(30000)
      });
      
      if (!res.ok) {
        throw new Error(`Backend error: ${res.status}`);
      }
      
      const text = await res.text();
      if (!text) {
        setData([]);
        setLastFetchTime(new Date());
        return;
      }
      
      const json = JSON.parse(text);
      const data = Array.isArray(json) ? json : json.data || [];
      
      setData(data);
      setLastFetchTime(new Date());
      if (selectedSite) {
        setSiteStatuses(prev => ({ ...prev, [selectedIp]: 'live' }));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setSiteStatuses(prev => ({ ...prev, [selectedIp]: 'not-found' }));
    } finally {
      setLoading(false);
    }
  }, [selectedIp, sites]);

  // Ref for loadData to avoid stale closures
  const loadDataRef = useRef(loadData);
  loadDataRef.current = loadData;

  // Load data when site changes (only once per site change)
  useEffect(() => {
    if (selectedIp) {
      console.log(`[Dashboard] Site changed to ${selectedIp}, loading data...`);
      loadDataRef.current();
    }
  }, [selectedIp]);

  // Auto-poll every 5 minutes (stable interval)
  useEffect(() => {
    const interval = setInterval(() => {
      if (selectedIp) {
        loadDataRef.current();
      }
    }, POLL_MS);
    return () => clearInterval(interval);
  }, [selectedIp]); // Only depend on selectedIp

  // Initialize time range to full data range
  useEffect(() => {
    if (data.length > 0 && !timeRange) {
      const timestamps = data.map(p => p.timestamp * 1000);
      const min = Math.min(...timestamps);
      const max = Math.max(...timestamps);
      setTimeRange([min, max]);
    }
  }, [data, timeRange]);

  // Filter data by time range - DISABLED (show all)
  const filteredData = data; // useMemo(() => {
  //   if (!timeRange || timeRange[0] === 0 && timeRange[1] === 0) return data;
  //   return data.filter(p => {
  //     const ts = p.timestamp * 1000;
  //     return ts >= timeRange[0] && ts <= timeRange[1];
  //   });
  // }, [data, timeRange]);

  // Trigger manual fetch (async - returns immediately, polls for completion)
  const handleFetch = async () => {
    setFetching(true);
    setError(null);
    try {
      // Start fetch (returns immediately)
      const res = await fetch('/api/fetch', {
        signal: AbortSignal.timeout(15000)
      });
      
      if (!res.ok) {
        throw new Error(`Backend error: ${res.status}`);
      }
      
      // Check if response is empty
      const text = await res.text();
      if (!text) {
        throw new Error('Empty response from backend');
      }
      
      const json = JSON.parse(text);
      
      if (json.status === 'running') {
        // Poll for completion via Render backend
        const RENDER_BACKEND = process.env.NEXT_PUBLIC_RENDER_BACKEND_URL || 'https://ec-tower-backend.onrender.com';
        const pollInterval = setInterval(async () => {
          try {
            const statusRes = await fetch(`${RENDER_BACKEND}/api/status`, {
              signal: AbortSignal.timeout(10000)
            });
            
            if (!statusRes.ok) {
              throw new Error(`Status error: ${statusRes.status}`);
            }
            
            const statusText = await statusRes.text();
            if (!statusText) {
              throw new Error('Empty status response');
            }
            
            const status = JSON.parse(statusText);
            
            if (!status.fetchInProgress) {
              clearInterval(pollInterval);
              setFetching(false);
              await loadData();
            }
          } catch (err) {
            clearInterval(pollInterval);
            setFetching(false);
            setError(err instanceof Error ? err.message : String(err));
          }
        }, 60000); // Poll every 60s
        
        // Timeout after 5 minutes
        setTimeout(() => {
          clearInterval(pollInterval);
          setFetching(false);
        }, 300000);
      } else {
        setFetching(false);
        await loadData();
      }
    } catch (err) {
      setFetching(false);
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const selectedSite = sites.find((s) => s.ip === selectedIp);

  // Build cluster groups from settings
  const clusterGroups = useMemo(() => {
    const groups = getSensorGroups();
    const clusters = new Map<number, { name: string; keys: string[] }>();
    const siteName = selectedSite?.name || 'Site';
    
    groups.forEach((g) => {
      if (!clusters.has(g.jenksClass)) {
        clusters.set(g.jenksClass, {
          name: siteName,
          keys: [],
        });
      }
      clusters.get(g.jenksClass)!.keys.push(...g.keys);
    });
    
    return Array.from(clusters.values());
  }, [selectedSite]);
  
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
        </div>
        <ThemeToggle />
      </div>

      {/* Error Banner */}
      <ErrorBanner message={error} onClose={() => setError(null)} />

      {/* Site Selector */}
      <SiteSelector 
        sites={sites} 
        selected={selectedIp} 
        onChange={setSelectedIp}
        siteStatuses={siteStatuses}
      />

      {/* Controls */}
      <div className="mb-4 flex gap-3">
        <button
          onClick={handleFetch}
          disabled={fetching || loading}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded text-sm font-medium transition"
        >
          {fetching ? '⏳ Fetching (polling)...' : loading ? 'Loading...' : '🔄 Fetch Now'}
        </button>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-gray-500 self-center">Auto-poll every 5 min</span>
          {lastFetchTime && (
            <span className="text-xs text-gray-400">
              Last fetched: {lastFetchTime.toLocaleString()}
            </span>
          )}
        </div>
      </div>

      {/* Time Range Slider - DISABLED */}
      {/* {data.length > 0 && timeRange && (
        <div className="mb-6">
          <TimeRangeSlider
            minTimestamp={Math.min(...data.map(p => p.timestamp * 1000))}
            maxTimestamp={Math.max(...data.map(p => p.timestamp * 1000))}
            value={timeRange}
            onChange={setTimeRange}
          />
        </div>
      )} */}

      {/* Charts - grouped by K-means clusters */}
      {filteredData.length > 0 && activeClusters.length > 0 && (
        <div key={selectedIp} className="space-y-8 mb-8">
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
// BUGGY BUT WORKING
// LESS BUGGY & BETTER!!
