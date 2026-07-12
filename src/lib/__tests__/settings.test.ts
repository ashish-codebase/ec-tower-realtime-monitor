import { describe, it, expect } from 'vitest';
import { getSensorGroups } from '../settings';

describe('getSensorGroups', () => {
  it('returns sensor groups', () => {
    const groups = getSensorGroups();
    
    expect(groups).toBeInstanceOf(Array);
    expect(groups.length).toBeGreaterThan(0);
    
    // Check structure of first group
    const group = groups[0];
    expect(group).toHaveProperty('name');
    expect(group).toHaveProperty('keys');
    expect(group).toHaveProperty('jenksClass');
    expect(group.keys).toBeInstanceOf(Array);
  });

  it('returns groups with unique names', () => {
    const groups = getSensorGroups();
    const names = groups.map(g => g.name);
    const uniqueNames = new Set(names);
    
    expect(names.length).toBe(uniqueNames.size);
  });

  it('returns groups with valid jenksClass values', () => {
    const groups = getSensorGroups();
    
    groups.forEach(group => {
      expect(typeof group.jenksClass).toBe('number');
      expect(group.jenksClass).toBeGreaterThanOrEqual(0);
    });
  });

  it('has at least one group', () => {
    const groups = getSensorGroups();
    expect(groups.length).toBeGreaterThanOrEqual(1);
  });
});
