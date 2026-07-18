import Dashboard from '@/components/Dashboard';
import { startPolling } from '@/lib/poller';
import fs from 'fs';
import path from 'path';

// Start background polling on server boot (multi-threaded via Promise.allSettled)
function initPoller() {
  try {
    const csvPath = path.join(process.cwd(), 'site_name_ip_address.csv');
    if (!fs.existsSync(csvPath)) return;

    const content = fs.readFileSync(csvPath, 'utf-8');
    const sites: { name: string; ip: string }[] = [];
    const seenIps = new Set<string>();

    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const [name, ip] = trimmed.split(',').map((s) => s.trim());
      if (name && ip && !seenIps.has(ip)) {
        seenIps.add(ip);
        sites.push({ name, ip });
      }
    }

    startPolling(sites);
    console.log(`Poller started for ${sites.length} sites: ${sites.map((s) => s.name).join(', ')}`);
  } catch (err) {
    console.error('Failed to start poller:', err);
  }
}

// Prevent HMR from restarting poller in dev
// Skip poller during build (Vercel static generation times out on tower connections)
const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build' || process.env.VERCEL === '1';

if (!isBuildTime) {
  if (process.env.NODE_ENV === 'development') {
    if (!(global as any).__ecPollerStarted) {
      initPoller();
      (global as any).__ecPollerStarted = true;
    }
  } else {
    initPoller();
  }
}

export default function Home() {
  return <Dashboard />;
}
