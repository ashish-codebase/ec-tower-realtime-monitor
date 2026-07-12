import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://45.76.30.90:3001';

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
    // Use site name directly (no IP conversion needed)
    const searchParams = _request.nextUrl.searchParams;
    const limit = searchParams.get('limit') || '1000';
    const offset = searchParams.get('offset') || '0';
    const backendUrl = `${BACKEND_URL}/api/data/${ipFile}?limit=${limit}&offset=${offset}`;
    
    console.log(`[VercelData] Proxying to: ${backendUrl}`);
    
    const res = await fetch(backendUrl, {
      signal: AbortSignal.timeout(30000) // 30s for large responses
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
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300'
      }
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[DEBUG] Fetch error:', msg);
    return NextResponse.json({ error: `Fetch error: ${msg}` }, { status: 502 });
  }
}
