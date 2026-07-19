import Dashboard from '@/components/Dashboard';

// Data fetching is handled by cron job hitting /api/fetch on port 3000.
// No auto-poller needed — single fetcher eliminates dual-server race conditions.

export default function Home() {
  return <Dashboard />;
}
