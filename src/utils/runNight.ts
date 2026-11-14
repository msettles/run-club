import type { CheckInRecord } from '../types';
export function runNightCounts(checkins: CheckInRecord[]) {
  const routes = new Map<string, { id: string; name: string; count: number; running: number; walking: number }>();
  for (const row of checkins) {
    const name = `${row.routeName || 'Saved route'} · ${row.actualMiles.toFixed(2)} miles`;
    const key = `${String(row.distanceChoice)}:${row.loops || 1}`;
    const group = routes.get(key) || { id: key, name, count: 0, running: 0, walking: 0 };
    group.count++; group[row.activity === 'walking' ? 'walking' : 'running']++; routes.set(key, group);
  }
  return { total: checkins.length, running: checkins.filter((c) => c.activity === 'running').length,
    walking: checkins.filter((c) => c.activity === 'walking').length, pets: checkins.filter((c) => c.withPet).length,
    routes: [...routes.values()] };
}
