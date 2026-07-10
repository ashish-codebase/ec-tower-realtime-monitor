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

  // Force env var check
  if (!RENDER_BACKEND || RENDER_BACKEND === 'http://localhost:3001') {
    throw new Error(`RENDER_BACKEND_URL not set! Current: ${RENDER_BACKEND}`);
  }

  try {
    // Convert underscores back to dots for Render backend
    const renderIp = ipFile.replace(/_/g, '.');
    const backendUrl = `${RENDER_BACKEND}/api/data/${renderIp}.json`;
    console.log(`[VercelData] RENDER_BACKEND=${RENDER_BACKEND}`);
    console.log(`[VercelData] Proxying to: ${backendUrl}`);
    
    const res = await fetch(backendUrl, {
      signal: AbortSignal.timeout(10000)
    });
    
    console.log(`[VercelData] Backend status: ${res.status} ${res.statusText}`);
    console.log(`[VercelData] Backend headers: ${res.headers.get('content-type')}`);
    
    if (!res.ok) {
      const text = await res.text();
      console.error(`[DEBUG] Backend error ${res.status}:`, text.substring(0, 200));
      return NextResponse.json({ error: `Backend error: ${res.status}` }, { status: 502 });
    }
    
    const contentType = res.headers.get('content-type');
    const text = await res.text();
    
    console.log(`[VercelData] Backend body length: ${text.length}`);
    console.log(`[VercelData] Backend body start: ${text.substring(0, 100)}`);
    
    if (!contentType || !contentType.includes('application/json')) {
      console.error('[VercelData] Backend returned non-JSON');
      return NextResponse.json({ error: 'Backend returned invalid response' }, { status: 502 });
    }
    
    console.log(`[VercelData] Returning ${text.length} bytes`);
    return new Response(text, {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[DEBUG] Fetch error:', msg);
    return NextResponse.json({ error: `Fetch error: ${msg}` }, { status: 502 });
  }
}
