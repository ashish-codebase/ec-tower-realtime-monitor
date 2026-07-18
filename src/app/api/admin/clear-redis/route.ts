import { NextRequest, NextResponse } from 'next/server';
import { createClient } from 'redis';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.ADMIN_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const REDIS_URL = process.env.REDIS_URL || process.env.ec_live_db_REDIS_URL;
  if (!REDIS_URL) {
    return NextResponse.json({ error: 'Redis not configured' }, { status: 500 });
  }

  try {
    const client = createClient({ url: REDIS_URL });
    await client.connect();
    
    // Get all site keys
    const keys = await client.keys('site:*');
    let deleted = 0;
    
    for (const key of keys) {
      await client.del(key);
      deleted++;
    }
    
    await client.disconnect();
    
    return NextResponse.json({ 
      success: true, 
      message: `Cleared ${deleted} site(s) from Redis`,
      cleared: keys 
    });
  } catch (err) {
    console.error('[Admin] Clear Redis error:', err);
    return NextResponse.json({ error: 'Failed to clear Redis' }, { status: 500 });
  }
}
