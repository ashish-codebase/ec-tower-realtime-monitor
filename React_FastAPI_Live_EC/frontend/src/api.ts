const API_BASE = '/api';

export async function fetchSites(): Promise<Array<{ name: string; ip: string }>> {
  const res = await fetch(`${API_BASE}/sites`);
  if (!res.ok) throw new Error('Failed to load sites');
  return res.json();
}

export async function triggerFetch(): Promise<{ status: string }> {
  const res = await fetch(`${API_BASE}/fetch`, { method: 'GET' });
  if (!res.ok) throw new Error('Failed to trigger fetch');
  return res.json();
}

export async function getFetchStatus(): Promise<{ in_progress: boolean }> {
  const res = await fetch(`${API_BASE}/fetch/status`);
  if (!res.ok) throw new Error('Failed to get fetch status');
  return res.json();
}

export async function getSiteData(siteIp: string, resample5min = false): Promise<any[]> {
  const params = new URLSearchParams({ resample_5min: String(resample5min) });
  const res = await fetch(`${API_BASE}/data/${siteIp}?${params}`);
  if (!res.ok) throw new Error(`Failed to load data for ${siteIp}`);
  return res.json();
}

export async function clearCache(siteIp?: string): Promise<{ status: string }> {
  const params = siteIp ? `?site_ip=${encodeURIComponent(siteIp)}` : '';
  const res = await fetch(`${API_BASE}/cache-control/clear${params}`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to clear cache');
  return res.json();
}

export async function getColumns(): Promise<{ allColumns: string[]; towerColumns: Record<string, string[]> }> {
  const res = await fetch(`${API_BASE}/columns`);
  if (!res.ok) throw new Error('Failed to load columns');
  return res.json();
}

export async function getSensorGroups(): Promise<{ sensorGroups: Array<{ name: string; keys: string[] }>; allDaqmColumns: string[] }> {
  const res = await fetch(`${API_BASE}/sensor-groups`);
  if (!res.ok) throw new Error('Failed to load sensor groups');
  return res.json();
}

export async function healthCheck(): Promise<{ status: string }> {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) throw new Error('Health check failed');
  return res.json();
}
