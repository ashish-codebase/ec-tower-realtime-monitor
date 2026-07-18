import { Site, TowerDataPoint } from '@/types';
import { fetchTowerData } from './tcp';
import { appendSiteData, ensureDataDir } from './storage';
import { appendSiteDataToRedis } from './redis';

const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
let pollerInterval: NodeJS.Timeout | null = null;
let isPolling = false;

export function startPolling(sites: Site[]) {
  ensureDataDir();
  if (pollerInterval) return;

  async function tick() {
    if (isPolling) return;
    isPolling = true;
    try {
      const promises = sites.map(async (site) => {
        try {
          const data = await fetchTowerData(site.ip, site.name);
          if (data.length > 0) {
            await appendSiteDataToRedis(site.ip, data);
            appendSiteData(site.ip, data);
          }
        } catch (err) {
          console.error(`Poll error for ${site.name} (${site.ip}):`, err instanceof Error ? err.message : err);
        }
      });
      await Promise.allSettled(promises);
    } finally {
      isPolling = false;
    }
  }

  // Run immediately on start
  tick();
  pollerInterval = setInterval(tick, POLL_INTERVAL_MS);
}

export function stopPolling() {
  if (pollerInterval) {
    clearInterval(pollerInterval);
    pollerInterval = null;
  }
}
