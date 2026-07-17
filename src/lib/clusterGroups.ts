import { getSensorGroups } from './settings';

export interface ClusterGroup {
  id: number;
  name: string;
  keys: string[];
}

export function buildClusterGroups(): ClusterGroup[] {
  const groups = getSensorGroups();
  const clusters = new Map<number, ClusterGroup>();

  groups.forEach((g) => {
    if (!clusters.has(g.jenksClass)) {
      clusters.set(g.jenksClass, {
        id: g.jenksClass,
        name: g.name,
        keys: [],
      });
    }
    clusters.get(g.jenksClass)!.keys.push(...g.keys);
  });

  return Array.from(clusters.values());
}
