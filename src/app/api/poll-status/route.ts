import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    message: 'Polling is active (every 5 min)',
    interval: '5 minutes',
  });
}
