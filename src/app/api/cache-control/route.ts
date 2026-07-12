import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    "message": "Rate limit exceeded - too many requests",
    "retryAfter": 60,
    "currentRate": "200 requests/second",
    "recommendedRate": "1 request/minute"
  }, {
    status: 429,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, max-age=0',
      'Retry-After': '60'
    }
  });
}