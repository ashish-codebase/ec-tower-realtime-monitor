import { Site, TowerDataPoint } from '@/types';
import { fetchTowerData } from './tcp';
import { appendSiteData, ensureDataDir } from './storage';
import { appendSiteDataToRedis } from './redis';

const PAUSE_MS = 5 * 60 * 1000; // 5 minutes pause after all fetches complete
let pollerTimeout: NodeJS.Timeout | null = null;
let keepAliveInterval: NodeJS.Timeout | null = null;
let isRunning = false;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function tick(sites: Site[]) {
  if (isRunning) return;
  isRunning = true;
  try {
    const promises = sites.map(async (site) => {
      try {
        const data = await fetchTowerData(site.ip, site.name);
        if (data.length > 0) {
          await appendSiteDataToRedis(site.ip, data);
          appendSiteData(site.ip, data);
          console.log(`[Poller] ${site.name}: stored ${data.length} points`);
        }
      } catch (err) {
        console.error(`[Poller] Error for ${site.name} (${site.ip}):`, err instanceof Error ? err.message : err);
      }
    });
    await Promise.allSettled(promises);
  } finally {
    isRunning = false;
  }
}

export function startPolling(sites: Site[]) {
  ensureDataDir();
  if (pollerTimeout) return;

  // Keep-alive: prevent Next.js dev server from going idle
  keepAliveInterval = setInterval(() => {
    console.log('[Poller] Keep-alive ping — server is running');
  }, 60000); // Every minute

  async function loop() {
    try {
      await tick(sites);
      console.log(`[Poller] All sites fetched, pausing ${PAUSE_MS / 60000} min...`);
    } catch (err) {
      console.error('[Poller] Loop error:', err instanceof Error ? err.message : err);
    }
    pollerTimeout = setTimeout(loop, PAUSE_MS);
  }

  // Run immediately on start
  loop();
}

export function stopPolling() {
  if (pollerTimeout) {
    clearTimeout(pollerTimeout);
    pollerTimeout = null;
  }
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
    keepAliveInterval = null;
  }
}
