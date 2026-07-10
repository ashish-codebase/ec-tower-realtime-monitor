import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { fetchTowerData } from '@/lib/tcp';
import { appendSiteData } from '@/lib/storage';

export async function GET() {
  const csvPath = path.join(process.cwd(), 'site_name_ip_address.csv');
  
  if (!fs.existsSync(csvPath)) {
    return NextResponse.json({ error: 'No site config found' }, { status: 500 });
  }

  const content = fs.readFileSync(csvPath, 'utf-8');
  const sites: { name: string; ip: string }[] = [];

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [name, ip] = trimmed.split(',').map((s) => s.trim());
    if (name && ip) sites.push({ name, ip });
  }

  // Fetch all towers in parallel (not sequential!)
  const results = await Promise.allSettled(
    sites.map(async (site) => {
      try {
        const data = await fetchTowerData(site.ip);
        appendSiteData(site.ip, data);
        return { name: site.name, ip: site.ip, status: 'ok', count: data.length };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { name: site.name, ip: site.ip, status: 'error', error: msg, count: 0 };
      }
    })
  );

  // Convert PromiseSettledResult to plain objects
  const formatted = results.map((r) =>
    r.status === 'fulfilled' ? r.value : { name: '', ip: '', status: 'error', error: 'Unknown', count: 0 }
  );

  return NextResponse.json({ results: formatted });
}
