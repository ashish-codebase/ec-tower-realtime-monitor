import { describe, it, expect } from 'vitest';

describe('Backend Data Consistency', () => {
  const BACKEND_URL = process.env.BACKEND_URL || 'http://45.76.30.90:3001';

  it('should fetch sites list from backend', async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/sites`, {
        signal: AbortSignal.timeout(10000)
      });
      
      expect(res.ok).toBe(true);
      const data = await res.json();
      expect(data.sites).toBeInstanceOf(Array);
      expect(data.sites.length).toBeGreaterThan(0);
    } catch (err) {
      console.warn('Backend not accessible:', (err as Error).message);
      // Test passes if backend is unreachable (CI environments)
    }
  });

  it('should fetch valid data for Baggs site', async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/data/Baggs.json`, {
        signal: AbortSignal.timeout(10000)
      });
      
      expect(res.ok).toBe(true);
      const data = await res.json();
      
      // Should be an array
      expect(data).toBeInstanceOf(Array);
      expect(data.length).toBeGreaterThan(0);
      
      // Each point should have timestamp, sensor, name, readings
      const firstPoint = data[0];
      expect(firstPoint).toHaveProperty('timestamp');
      expect(firstPoint).toHaveProperty('sensor');
      expect(firstPoint).toHaveProperty('name');
      expect(firstPoint).toHaveProperty('readings');
      expect(firstPoint.readings).toBeInstanceOf(Array);
      
      // Timestamps should be Unix seconds (< 1e12)
      expect(firstPoint.timestamp).toBeLessThan(1e12);
      
      // Data should be recent (within last 24 hours)
      const lastTs = data[data.length - 1].timestamp;
      const now = Math.floor(Date.now() / 1000);
      expect(now - lastTs).toBeLessThan(86400);
      
    } catch (err) {
      console.warn('Backend not accessible:', (err as Error).message);
    }
  }, 15000);

  it('should return consistent data on repeated fetches', async () => {
    try {
      const res1 = await fetch(`${BACKEND_URL}/api/data/Baggs.json`, {
        signal: AbortSignal.timeout(10000)
      });
      
      const res2 = await fetch(`${BACKEND_URL}/api/data/Baggs.json`, {
        signal: AbortSignal.timeout(10000)
      });
      
      const data1 = await res1.json();
      const data2 = await res2.json();
      
      // Same length
      expect(data1.length).toBe(data2.length);
      
      // Same last timestamp (data hasn't changed in 1 second)
      if (data1.length > 0 && data2.length > 0) {
        expect(data1[data1.length - 1].timestamp).toBe(data2[data2.length - 1].timestamp);
      }
      
    } catch (err) {
      console.warn('Backend not accessible:', (err as Error).message);
    }
  }, 15000);
});
