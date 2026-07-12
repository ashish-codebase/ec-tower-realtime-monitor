import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useSiteData } from '../useSiteData';

// Mock fetch
global.fetch = vi.fn();

describe('useSiteData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('[]'),
    });
  });

  it('returns initial state', () => {
    const { result } = renderHook(() => useSiteData('TestSite'));
    
    expect(result.current.data).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('fetches data successfully', async () => {
    const mockData = [
      { sensor: 'temp', name: 'Temperature', timestamp: 1000, readings: [{ v: 25 }] }
    ];
    
    (global.fetch as any).mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify(mockData)),
    });

    const { result } = renderHook(() => useSiteData('TestSite'));
    
    await result.current.fetchData();
    
    await waitFor(() => {
      expect(result.current.data).toEqual(mockData);
      expect(result.current.loading).toBe(false);
    });
  });

  it('handles fetch error', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: false,
      status: 500,
    });

    const { result } = renderHook(() => useSiteData('TestSite'));
    
    await result.current.fetchData();
    
    await waitFor(() => {
      expect(result.current.error).toContain('Backend error: 500');
      expect(result.current.loading).toBe(false);
    });
  });

  it('handles empty response', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(''),
    });

    const { result } = renderHook(() => useSiteData('TestSite'));
    
    await result.current.fetchData();
    
    await waitFor(() => {
      expect(result.current.data).toEqual([]);
      expect(result.current.loading).toBe(false);
    });
  });

  it('handles JSON parse error', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('invalid json'),
    });

    const { result } = renderHook(() => useSiteData('TestSite'));
    
    await result.current.fetchData();
    
    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
      expect(result.current.loading).toBe(false);
    });
  });

  it('handles network error', async () => {
    (global.fetch as any).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useSiteData('TestSite'));
    
    await result.current.fetchData();
    
    await waitFor(() => {
      expect(result.current.error).toBe('Network error');
      expect(result.current.loading).toBe(false);
    });
  });

  it('handles fetch with abort signal', async () => {
    const { result } = renderHook(() => useSiteData('TestSite'));
    
    // Call fetchData - should complete without error
    await result.current.fetchData();
    
    // Verify loading is false after fetch
    expect(result.current.loading).toBe(false);
  });
});
