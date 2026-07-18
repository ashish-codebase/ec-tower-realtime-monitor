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
    expect(group.keys).toBeInstanceOf(Array);
  });

  it('returns groups with unique names', () => {
    const groups = getSensorGroups();
    const names = groups.map(g => g.name);
    const uniqueNames = new Set(names);
    
    expect(names.length).toBe(uniqueNames.size);
  });

  it('has at least one group', () => {
    const groups = getSensorGroups();
    expect(groups.length).toBeGreaterThanOrEqual(1);
  });
});
