import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  const csvPath = path.join(process.cwd(), 'site_name_ip_address.csv');
  
  if (!fs.existsSync(csvPath)) {
    return NextResponse.json({ sites: [] });
  }

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

  return NextResponse.json({ sites });
}
