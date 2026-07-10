import { NextResponse } from 'next/server';

const RENDER_BACKEND = process.env.RENDER_BACKEND_URL || 'http://localhost:3001';

export async function GET() {
  try {
    const res = await fetch(`${RENDER_BACKEND}/api/sites`);
    if (!res.ok) throw new Error(`Backend error: ${res.status}`);
    return NextResponse.json(await res.json());
  } catch (err) {
    return NextResponse.json({ sites: [] }, { status: 502 });
  }
}
