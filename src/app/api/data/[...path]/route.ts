import { NextRequest, NextResponse } from 'next/server';

const RENDER_BACKEND = process.env.RENDER_BACKEND_URL || 'http://localhost:3001';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const resolved = await params;
  const [ipFile] = resolved.path;

  if (!ipFile) {
    return NextResponse.json({ error: 'No data file specified' }, { status: 400 });
  }

  try {
    const res = await fetch(`${RENDER_BACKEND}/api/data/${ipFile}`);
    if (!res.ok) throw new Error(`Backend error: ${res.status}`);
    return NextResponse.json(await res.json());
  } catch (err) {
    return NextResponse.json({ data: [] }, { status: 502 });
  }
}
