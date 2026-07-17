import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Dashboard from '@/components/Dashboard';

vi.mock('../TimeSeriesChart', () => ({
  default: ({ title, sensorKeys }: { title: string; sensorKeys: string[] }) => (
    <div data-testid="chart" data-title={title} data-keys={sensorKeys.join(',')}>
      {title}
    </div>
  ),
}));

describe('Dashboard', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    global.fetch = vi.fn((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;
      const normalizedUrl = decodeURIComponent(url.toString());
      if (normalizedUrl.includes('/api/sites')) {
        return Promise.resolve(new Response(JSON.stringify({ sites: [
          { name: 'Site A', ip: '1.1.1.1' },
          { name: 'Site B', ip: '2.2.2.2' },
        ] }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }

      if (normalizedUrl.includes('/api/data/Site A.json')) {
        return Promise.resolve(new Response(JSON.stringify([
          { timestamp: 1680000000, sensor: 'CK-0001', readings: [{ '116': 42 }] },
        ]), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }

      if (normalizedUrl.includes('/api/data/Site B.json')) {
        return Promise.resolve(new Response(JSON.stringify([
          { timestamp: 1680000600, sensor: 'CK-0002', readings: [{ '121': 100 }] },
        ]), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }

      return Promise.resolve(new Response('{}', { status: 404, headers: { 'Content-Type': 'application/json' } }));
    }) as unknown as typeof global.fetch;
  });

  it('updates rendered chart set when switching sites', async () => {
    const { unmount } = render(<Dashboard />);

    await waitFor(() => expect(screen.getByText('Site A')).toBeInTheDocument());

    const siteACharts = await screen.findAllByTestId('chart');
    expect(siteACharts.length).toBeGreaterThan(0);
    expect(siteACharts.map((el) => el.getAttribute('data-title'))).toEqual(
      expect.arrayContaining(['Cluster 8', 'Cluster 9'])
    );

    const siteBInput = screen.getByRole('radio', { name: '🔄Site B' }) as HTMLInputElement;
    fireEvent.click(siteBInput);
    fireEvent.change(siteBInput, { target: { checked: true } });

    await waitFor(() => expect(siteBInput).toBeChecked(), { timeout: 2000 });

    await waitFor(
      () => {
        const charts = screen.getAllByTestId('chart');
        expect(charts.some((chart) => chart.getAttribute('data-title') === 'Cluster 2')).toBe(true);
      },
      { timeout: 2000 }
    );

    const siteBCharts = screen.getAllByTestId('chart').filter(
      (chart) => chart.getAttribute('data-title') === 'Cluster 2'
    );

    expect(siteBCharts).toHaveLength(1);
    expect(siteBCharts[0]).toHaveAttribute('data-title', 'Cluster 2');

    unmount();
  });
});
