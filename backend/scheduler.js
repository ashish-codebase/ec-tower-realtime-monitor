const INTERVAL_MS = 300000; // 5 minutes

let intervalId = null;
let lastFetchTime = null;

async function fetchAll(sites, fetchTowerData, dataStore) {
  lastFetchTime = new Date().toISOString();
  console.log(`[Scheduler] Fetching ${sites.length} sites at ${lastFetchTime}`);

  const results = await Promise.allSettled(
    sites.map(async (site) => {
      try {
        const data = await fetchTowerData(site.ip);
        // Append to existing data, cap at 2880 points (24h at 5min intervals)
        const existing = dataStore.get(site.ip) || [];
        const combined = [...existing, ...data].slice(-2880);
        dataStore.set(site.ip, combined);
        return { name: site.name, ip: site.ip, status: 'ok', count: data.length };
      } catch (err) {
        return { name: site.name, ip: site.ip, status: 'error', error: err.message, count: 0 };
      }
    })
  );

  const ok = results.filter(r => r.status === 'fulfilled' && r.value.status === 'ok').length;
  const fail = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && r.value.status === 'error')).length;
  console.log(`[Scheduler] Done: ${ok} ok, ${fail} failed`);
}

function start(loadSites, fetchTowerData, dataStore) {
  // Initial fetch
  const sites = loadSites();
  fetchAll(sites, fetchTowerData, dataStore).catch(console.error);

  // Schedule periodic fetches
  intervalId = setInterval(() => {
    const sites = loadSites();
    fetchAll(sites, fetchTowerData, dataStore).catch(console.error);
  }, INTERVAL_MS);

  console.log(`[Scheduler] Running every ${INTERVAL_MS / 1000}s`);
}

function stop() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

module.exports = { start, stop, lastFetchTime: () => lastFetchTime };
