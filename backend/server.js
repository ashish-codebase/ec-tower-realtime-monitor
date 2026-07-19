/**
 * DEPRECATED - Removed 2025
 * 
 * This Express backend (port 3001) has been removed. Data fetching is now
 * handled exclusively by the Next.js API route at /api/fetch (port 3000).
 * 
 * The cron job pings port 3000 which keeps the Next.js server alive and
 * triggers data fetches via the /api/fetch endpoint.
 * 
 * See src/app/api/fetch/route.ts for current fetcher implementation.
 */

console.log('[Express] This server has been removed. Use Next.js /api/fetch instead.');
process.exit(0);
