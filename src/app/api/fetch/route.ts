import { NextResponse } from 'next/server';
import { fetchTowerData } from '@/lib/tcp';
import { appendSiteData, ensureDataDir } from '@/lib/storage';
import { appendSiteDataToRedis } from '@/lib/redis';
import { getFetchInProgress, setFetchInProgress } from '@/lib/fetchState';
import path from 'path';
import { promises as fs } from 'fs';

export const dynamic = 'force-dynamic';

async function loadSitesFromCsv() {
  try {
    const csvPath = path.join(process.cwd(), 'site_name_ip_address.csv');
    const content = await fs.readFile(csvPath, 'utf-8');
    const sites = [] as { name: string; ip: string }[];
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const [name, ip] = trimmed.split(',').map((s) => s.trim());
      if (name && ip) sites.push({ name, ip });
    }
    return sites;
  } catch (err) {
    console.error('[Fetch] CSV load error:', err);
    return [] as { name: string; ip: string }[];
  }
}

async function performFetch() {
  try {
    ensureDataDir();

    const sites = await loadSitesFromCsv();
    if (sites.length === 0) {
      console.error('[Fetch] No sites configured');
      return;
    }

    const results = await Promise.allSettled(
      sites.map(async (site) => {
        try {
          console.log(`[Fetch] Fetching data from ${site.name} (${site.ip})...`);
          const data = await fetchTowerData(site.ip, site.name);
          console.log(`[Fetch] Got ${data.length} data points from ${site.name}`);

          if (data.length > 0) {
            await appendSiteDataToRedis(site.ip, data);
            appendSiteData(site.ip, data);
          }
          return { name: site.name, ip: site.ip, status: 'ok', count: data.length };
        } catch (err) {
          console.error(`[Fetch] Error fetching from ${site.name}:`, err);
          return { name: site.name, ip: site.ip, status: 'error', error: err instanceof Error ? err.message : String(err) };
        }
      })
    );

    const ok = results.filter((r) => r.status === 'fulfilled' && r.value.status === 'ok').length;
    const fail = results.filter((r) => r.status === 'rejected' || (r.status === 'fulfilled' && r.value.status === 'error')).length;
    console.log(`[Fetch] Complete: ${ok} ok, ${fail} failed`);
  } catch (err) {
    console.error('[Fetch] Fatal error:', err);
  } finally {
    setFetchInProgress(false);
  }
}

export async function GET() {
  if (getFetchInProgress()) {
    return NextResponse.json({ status: 'running' });
  }

  // Fire-and-forget: return immediately so HTTP clients (cron-job.org) don't timeout.
  // The actual TCP fetch runs in background.
  setFetchInProgress(true);
  performFetch().catch(console.error);

  return NextResponse.json({ status: 'started' });
}
