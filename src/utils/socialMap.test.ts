import { describe, expect, it } from 'vitest';
import { socialMapViewport } from './socialMap';
import { socialRouteIds } from './socialPost';
describe('route map images', () => {
  it('includes every route point inside a padded viewport and requests only its visible tiles', () => {
    const points = [{ lat: 38.678, lon: -121.771 }, { lat: 38.69, lon: -121.746 }, { lat: 38.678, lon: -121.771 }];
    const view = socialMapViewport(points, 984, 670);
    expect(view.zoom).toBeGreaterThan(10);
    for (const [x, y] of view.line) { expect(x).toBeGreaterThanOrEqual(60); expect(x).toBeLessThanOrEqual(924); expect(y).toBeGreaterThanOrEqual(60); expect(y).toBeLessThanOrEqual(610); }
    expect(view.tiles.length).toBeLessThanOrEqual(20);
    for (const tile of view.tiles) { expect(tile.left).toBeLessThan(984); expect(tile.left + 256).toBeGreaterThan(0); expect(tile.top).toBeLessThan(670); expect(tile.top + 256).toBeGreaterThan(0); }
  });
  it('does not invent a map for missing or invalid geometry', () => {
    for (const points of [[], [{ lat: 1, lon: 2 }], [{ lat: NaN, lon: 1 }, { lat: 1, lon: 2 }], [{ lat: 91, lon: 1 }, { lat: 1, lon: 2 }], [{ lat: 1, lon: 2 }, { lat: 1, lon: 2 }]]) expect(() => socialMapViewport(points, 984, 670)).toThrow('geometry');
  });
  it('preserves saved route order and emits one image per distinct route', () => {
    expect(socialRouteIds({ routeChoices: [{ routeId: 'short' }, { routeId: 'long' }, { routeId: 'short' }] })).toEqual(['short', 'long']);
    expect(socialRouteIds({ routeId: 'legacy-route' })).toEqual(['legacy-route']);
  });
});
