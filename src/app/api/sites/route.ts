import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

async function loadSitesFromCsv() {
  try {
    const csvPath = path.join(process.cwd(), 'site_name_ip_address.csv');
    const content = await fs.readFile(csvPath, 'utf-8');
    const sites = [];
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const [name, ip] = trimmed.split(',').map((s) => s.trim());
      if (name && ip) sites.push({ name, ip });
    }
    return sites;
  } catch (err) {
    console.error('[Sites] CSV load error:', err);
    return [];
  }
}

export async function GET() {
  const sites = await loadSitesFromCsv();
  return NextResponse.json({ sites });
}
