import { NextRequest, NextResponse } from 'next/server';
import { createClient } from 'redis';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  // Optional auth - skip if ADMIN_SECRET not configured
  const adminSecret = process.env.ADMIN_SECRET;
  if (adminSecret) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${adminSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const REDIS_URL = process.env.REDIS_URL || process.env.ec_live_db_REDIS_URL;
  if (!REDIS_URL) {
    return NextResponse.json({ error: 'Redis not configured' }, { status: 500 });
  }

  try {
    const client = createClient({ url: REDIS_URL });
    await client.connect();
    
    // Flush entire database (like Python script)
    await client.flushDb();
    
    // Verify with test key
    await client.set('foo', 'bar');
    const testVal = await client.get('foo');
    await client.del('foo');
    
    await client.disconnect();
    
    return NextResponse.json({ 
      success: true, 
      message: 'Redis database flushed successfully',
      testKey: testVal === 'bar' ? 'verified' : 'failed'
    });
  } catch (err) {
    console.error('[Admin] Clear Redis error:', err);
    return NextResponse.json({ error: 'Failed to clear Redis' }, { status: 500 });
  }
}
