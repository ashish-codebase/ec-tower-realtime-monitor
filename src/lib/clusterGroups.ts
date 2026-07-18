import { getSensorGroups } from './settings';

export interface ClusterGroup {
  id: string;
  name: string;
  keys: string[];
}

export function buildClusterGroups(): ClusterGroup[] {
  const groups = getSensorGroups();
  return groups.map((g) => ({
    id: g.name,
    name: g.name,
    keys: [...g.keys],
  }));
}
