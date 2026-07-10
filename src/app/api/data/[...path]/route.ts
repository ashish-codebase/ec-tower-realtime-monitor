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
    // Convert underscores back to dots for Render backend
    const renderIp = ipFile.replace(/_/g, '.');
    const res = await fetch(`${RENDER_BACKEND}/api/data/${renderIp}.json`, {
      signal: AbortSignal.timeout(10000)
    });
    
    if (!res.ok) {
      const text = await res.text();
      console.error(`Backend error ${res.status}:`, text.substring(0, 200));
      return NextResponse.json({ data: [] }, { status: 502 });
    }
    
    const contentType = res.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await res.text();
      console.error('Backend returned non-JSON:', text.substring(0, 200));
      return NextResponse.json({ data: [] }, { status: 502 });
    }
    
    return NextResponse.json(await res.json());
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Fetch error:', msg);
    return NextResponse.json({ data: [] }, { status: 502 });
  }
}
