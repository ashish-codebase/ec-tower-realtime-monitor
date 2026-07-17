import { NextResponse } from 'next/server';
import { getFetchInProgress } from '@/lib/fetchState';

export async function GET() {
  return NextResponse.json({ fetchInProgress: getFetchInProgress() });
}
