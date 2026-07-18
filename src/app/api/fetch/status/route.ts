import { NextResponse } from 'next/server';
import { getFetchInProgress } from '@/lib/fetchState';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ fetchInProgress: getFetchInProgress() });
}
