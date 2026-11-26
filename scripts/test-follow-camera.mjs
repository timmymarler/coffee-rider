import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../core/screens/MapScreenRN-TomTom.js', import.meta.url), 'utf8');
const zoomMatch = source.match(/const FOLLOW_ZOOM = Platform\.OS === "ios" \? (\d+) : (\d+);/);
assert.ok(zoomMatch, 'Platform-specific follow zoom exists');
const iosZoom = Number(zoomMatch[1]);
assert.equal(Number(zoomMatch[2]), 17, 'Android follow zoom is unchanged');
const altitudeMatch = source.match(/cameraConfig\.altitude = (Math\.pow\(2, 13 - effectiveZoom\) \* 10);/);
assert.ok(altitudeMatch, 'iOS follow altitude conversion exists');
const altitudeFor = new Function('effectiveZoom', `return ${altitudeMatch[1]};`);
assert.equal(altitudeFor(iosZoom), 640, 'iOS follow uses the original starting altitude');
assert.match(source, /recenterOnUser\(\{ zoom: FOLLOW_ZOOM, pitch: 35, followMode: true \}\)/);
assert.match(source, /const preserveIosCamera = Platform\.OS === "ios" && followMode && preserveZoom;/);
assert.match(source, /!preserveIosCamera && pitch !== null/);
assert.match(source, /if \(!preserveIosCamera && effectiveZoom !== null\)/);
assert.match(source, /if \(Platform\.OS === "ios" && followMode && preserveZoom && isAnimatingRef\.current\) return;/);
assert.match(source, /mapRef\.current\.animateCamera\(cameraConfig, \{ duration: 350 \}\)/);
console.log('Passed: iOS initial follow altitude, Android zoom, and manual camera preservation');