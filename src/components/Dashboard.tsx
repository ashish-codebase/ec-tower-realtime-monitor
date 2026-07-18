'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Site, TowerDataPoint } from '@/types';
import { useSiteData } from '@/hooks/useSiteData';
import { buildClusterGroups } from '@/lib/clusterGroups';
import SiteSelector from './SiteSelector';
import TimeSeriesChart from './TimeSeriesChart';
import StatsTable from './StatsTable';
import ErrorBanner from './ErrorBanner';
import ThemeToggle from './ThemeToggle';

const POLL_MS = 5 * 60 * 1000; // 5 minutes

export default function Dashboard() {
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedIp, setSelectedIp] = useState<string>('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<TowerDataPoint[]>([]);
  const [fetching, setFetching] = useState(false);
  const [lastFetchTime, setLastFetchTime] = useState<Date | null>(null);
  const [timeRange, setTimeRange] = useState<[number, number] | null>(null);
  const [siteStatuses, setSiteStatuses] = useState<{ [key: string]: 'live' | 'no-data' | 'not-found' | 'checking' }>({});
  const [resetting, setResetting] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);

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
    const now = Date.now();
    if (lastFetchTimestampRef.current && now - lastFetchTimestampRef.current < 1000) {
      return; // throttle to 1 request per second
    }
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
      lastFetchTimestampRef.current = now;
      setLastFetchTime(new Date());
      if (selectedSite) {
        setSiteStatuses(prev => ({ 
          ...prev, 
          [selectedIp]: data.length > 0 ? 'live' : 'no-data' 
        }));
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
  const lastFetchTimestampRef = useRef(0);
const loadDataRef = useRef(loadData);
  loadDataRef.current = loadData;

  // Load data when site changes (only once per site change)
  useEffect(() => {
    if (selectedIp) {
      console.log(`[Dashboard] Site changed to ${selectedIp}, loading data...`);
      loadDataRef.current();
    }
  }, [selectedIp]);

  // Auto-poll every 5 minutes: trigger backend fetch + reload data
  useEffect(() => {
    console.log(`[Dashboard] Starting poll interval for ${selectedIp}`);
    const interval = setInterval(async () => {
      console.log('[Dashboard] Auto-polling...');
      try {
        // Trigger backend to fetch fresh data from towers
        const fetchRes = await fetch('/api/fetch', { signal: AbortSignal.timeout(30000) });
        if (fetchRes.ok) {
          console.log('[Dashboard] Backend fetch triggered');
        }
        // Reload data from Redis after fetch (bypass cache)
        const selectedSite = sites.find((s) => s.ip === selectedIp);
        const siteName = selectedSite?.name || selectedIp.replace(/\./g, '_');
        const res = await fetch(`/api/data/${siteName}.json?refresh=true`, { signal: AbortSignal.timeout(30000) });
        if (res.ok) {
          const text = await res.text();
          const json = JSON.parse(text);
          const data = Array.isArray(json) ? json : json.data || [];
          setData(data);
          lastFetchTimestampRef.current = Date.now();
          setLastFetchTime(new Date());
        }
      } catch (err) {
        console.error('[Dashboard] Auto-poll error:', err);
      }
    }, POLL_MS);
    return () => {
      clearInterval(interval);
    };
  }, [selectedIp, sites]);



  // Filter data by time range - DISABLED (show all)
  const filteredData = data; // useMemo(() => {
  //   if (!timeRange || timeRange[0] === 0 && timeRange[1] === 0) return data;
  //   return data.filter(p => {
  //     const ts = p.timestamp * 1000;
  //     return ts >= timeRange[0] && ts <= timeRange[1];
  //   });
  // }, [data, timeRange]);

  const manualFetchEnabled = true;

  // Trigger manual fetch (async - returns immediately, polls for completion)
  const handleFetch = async () => {
    setFetching(true);
    setError(null);
    try {
      const res = await fetch('/api/fetch', {
        signal: AbortSignal.timeout(15000)
      });
      
      if (!res.ok) {
        throw new Error(`Backend error: ${res.status}`);
      }
      
      const json = await res.json();
      
      if (json.status === 'disabled') {
        throw new Error(json.message || 'Manual fetch is not available.');
      }

      if (json.status === 'running') {
        const pollInterval = setInterval(async () => {
          try {
            const statusRes = await fetch('/api/fetch/status', {
              signal: AbortSignal.timeout(10000)
            });
            
            if (!statusRes.ok) {
              throw new Error(`Status error: ${statusRes.status}`);
            }
            
            const status = await statusRes.json();
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
        }, 5000); // Poll every 5s
        
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

  // Reset Redis database
  const handleResetRedis = async () => {
    if (!confirm('⚠️ This will clear ALL cached data from Redis. Are you sure?')) {
      return;
    }
    
    setResetting(true);
    setResetMessage(null);
    try {
      const adminSecret = process.env.NEXT_PUBLIC_ADMIN_SECRET;
      const headers: Record<string, string> = {};
      if (adminSecret) {
        headers['Authorization'] = `Bearer ${adminSecret}`;
      }
      
      const res = await fetch('/api/admin/clear-redis', {
        method: 'POST',
        headers,
      });
      
      const json = await res.json();
      if (res.ok) {
        setResetMessage(`✓ ${json.message}`);
        // Clear local data and reload
        setData([]);
        await loadData();
      } else {
        setResetMessage(`✗ ${json.error}`);
      }
    } catch (err) {
      setResetMessage(`✗ ${err instanceof Error ? err.message : 'Failed to reset'}`);
    } finally {
      setResetting(false);
    }
  };

  // Build cluster groups from settings
  const clusterGroups = useMemo(() => buildClusterGroups(), []);
  
  // Filter clusters to only those with data
  const activeClusters = clusterGroups.filter((c) =>
    data.some((p) =>
      c.keys.some((k) => k in p)
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
          disabled={fetching || loading || !manualFetchEnabled}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded text-sm font-medium transition"
          title={!manualFetchEnabled ? 'Manual fetch is not configured in production' : undefined}
        >
          {fetching ? '⏳ Fetching (polling)...' : loading ? 'Loading...' : '🔄 Fetch Now'}
        </button>
        
        <button
          onClick={handleResetRedis}
          disabled={resetting}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded text-sm font-medium transition"
        >
          {resetting ? '⏳ Resetting...' : '🗑️ Reset Redis'}
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
      
      {resetMessage && (
        <div className={`mb-4 p-3 rounded text-sm ${resetMessage.startsWith('✓') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {resetMessage}
        </div>
      )}

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
            <div key={cluster.id} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700" style={{ minHeight: 300 }}>
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
