import { useState, useRef, useCallback } from 'react';
import type { SensorDataPoint } from '@/types';

export function useSiteData(siteName: string) {
  const [data, setData] = useState<SensorDataPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastFetchRef = useRef(0);

  const fetchData = useCallback(async () => {
    const now = Date.now();
    if (now - lastFetchRef.current < 1000) return; // 1s throttle
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/data/${siteName}.json`, {
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) throw new Error(`Backend error: ${res.status}`);
      const text = await res.text();
      if (!text) {
        setData([]);
        return;
      }
      const json = JSON.parse(text);
      const arr = Array.isArray(json) ? json : json.data || [];
      setData(arr as SensorDataPoint[]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
      lastFetchRef.current = Date.now();
    }
  }, [siteName]);

  return { data, loading, error, fetchData };
}
