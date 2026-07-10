import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const resolved = await params;
  const [ipFile] = resolved.path;

  if (!ipFile) {
    return NextResponse.json({ error: 'No data file specified' }, { status: 400 });
  }

  const filePath = path.join(process.cwd(), 'data', ipFile);

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ data: [] });
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter((l) => l.trim());
  const data = lines.map((line) => {
    try {
      return JSON.parse(line.trim());
    } catch {
      return null;
    }
  }).filter(Boolean);

  return NextResponse.json({ data });
}
