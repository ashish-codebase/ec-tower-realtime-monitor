import { describe, it, expect, vi } from 'vitest';

// Test that the module exports work
describe('tcp module', () => {
  it('has fetchTowerData exported', async () => {
    const tcp = await import('../tcp');
    expect(tcp.fetchTowerData).toBeDefined();
    expect(typeof tcp.fetchTowerData).toBe('function');
  });

  it('fetchTowerData is a function', async () => {
    const tcp = await import('../tcp');
    expect(tcp.fetchTowerData).toBeInstanceOf(Function);
  });
});
