import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const helperUrl = new URL('../core/map/tomtomPlaceClusters.js', import.meta.url);
const source = fs.readFileSync(helperUrl, 'utf8').replace(
  "'supercluster'",
  JSON.stringify(pathToFileURL(require.resolve('supercluster')).href),
);
const { createPlaceClusterIndex, getPlaceClusters } = await import(
  `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`,
);

const places = Array.from({ length: 2000 }, (_, index) => ({
  id: String(index),
  latitude: 51 + index / 100000,
  longitude: -0.1 + index / 100000,
  iconGlyph: 123,
  fillColor: '#123456',
}));
const stop = { id: 'route-waypoint-0', latitude: 51, longitude: -0.1 };
const index = createPlaceClusterIndex([...places, stop]);
const low = getPlaceClusters(index, { zoom: 4 });
assert.equal(low.length, 2);
assert.equal(low.find(item => item.clusterCount).clusterCount, 2000);
assert(low.includes(stop));
assert(low.find(item => item.clusterCount).expansionZoom > 4);
const high = getPlaceClusters(index, { zoom: 18 });
assert.equal(high.length, 2001);
assert(high.includes(places[0]));
const neighbourhood = getPlaceClusters(index, { zoom: 10 });
assert.equal(neighbourhood.length, 2001);
assert(neighbourhood.every(item => !item.clusterCount));
assert(getPlaceClusters(index, { zoom: 9 }).some(item => item.clusterCount));
assert.deepEqual(getPlaceClusters(index, { zoom: 10, bounds: [10, 10, 11, 11] }), [stop]);
const filtered = createPlaceClusterIndex([places[0], stop]);
assert.deepEqual(getPlaceClusters(filtered, { zoom: 4 }), [places[0], stop]);
assert.deepEqual(getPlaceClusters(createPlaceClusterIndex([]), { zoom: 4 }), []);
const spacedPlaces = createPlaceClusterIndex([
  { id: 'first', latitude: 51, longitude: 0 },
  { id: 'second', latitude: 51, longitude: 0.008 },
]);
assert.equal(getPlaceClusters(spacedPlaces, { zoom: 10 }).length, 2);
assert.equal(getPlaceClusters(spacedPlaces, { zoom: 9 })[0].clusterCount, 2);
console.log('Passed: clustering, counts, expansion, viewport culling, filters, styling, route stops, and empty input');