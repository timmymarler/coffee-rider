import assert from 'node:assert/strict';
import fs from 'node:fs';

const routing = fs.readFileSync(new URL('../core/map/utils/tomtomRouting.js', import.meta.url), 'utf8');
const helpers = routing.match(/const MAJOR_ROAD_PATTERN[\s\S]*?\nexport function selectGoogleRouteIndex[\s\S]*?\n\}/);
assert.ok(helpers, 'Google route selection helpers exist');
const select = new Function(`${helpers[0].replace('export function', 'function')}; return selectGoogleRouteIndex;`)();

const route = (durationS, distanceM, steps) => ({
  legs: [{
    duration: { value: durationS },
    distance: { value: distanceM },
    steps: steps.map(([text, metres]) => ({ html_instructions: text, distance: { value: metres } })),
  }],
});
const busyFast = route(600, 4000, [['Turn left onto <b>A421</b>', 3000], ['Continue', 1000]]);
const quietSlow = route(900, 4500, [['Turn right onto <b>Church Lane</b>', 4500]]);
const short = route(800, 3500, [['Head north on <b>A5</b>', 500], ['Continue', 3000]]);
const routes = [busyFast, quietSlow, short];

assert.equal(select(routes, 'recommended'), 0, 'Google recommended route kept');
assert.equal(select(routes, 'fastest'), 0);
assert.equal(select(routes, 'shortest'), 2);
assert.equal(select(routes, 'quietest'), 1);
assert.equal(select([busyFast], 'quietest'), 0);
assert.equal(select(routes, 'unknown'), 0);
assert.equal(select([route(700, 1, [['Take <b>A6</b>', 150]]), route(500, 1, [['Take <b>Mill Road</b>', 1]])], 'quietest'), 0, 'small gains keep the recommended route');
assert.equal(select([route(1, 1000, []), route(1, 900, [])], 'shortest'), 0, 'a 100 m saving keeps the recommended route');
assert.equal(select([route(1, 1, [['Join the <b>M1</b>', 500]]), route(2, 1, [['Take a left by the church', 1]])], 'quietest'), 1, 'plain "a " text is not an A-road');

const context = fs.readFileSync(new URL('../core/context/RoutingPreferencesContext.js', import.meta.url), 'utf8');
const configs = new Function(`const AVOID_KEYS = ["motorways", "tollRoads", "unpavedRoads", "ferries"]; ${context.match(/const THEME_CONFIGS = \{[\s\S]*?\n\};/)[0]}; return THEME_CONFIGS;`)();
const ids = name => configs[name].routeTypes.map(option => option.id);
assert.deepEqual(ids('cyclist'), ['recommended', 'quietest', 'shortest']);
assert.equal(configs.cyclist.defaultRouteType, 'recommended');
assert.deepEqual(ids('strider'), ['shortest', 'quietest']);
assert.deepEqual(configs.cyclist.avoidKeys, ['ferries']);
assert.deepEqual(configs.strider.avoidKeys, ['ferries']);
for (const name of ['cyclist', 'strider']) assert.ok(ids(name).includes(configs[name].defaultRouteType));
assert.deepEqual(ids('rider'), ['fastest', 'shortest', 'curvy']);
assert.equal(configs.rider.avoidKeys.length, 4);

console.log('Passed: cycling/walking route options, avoid options, and Google fastest/shortest/quietest selection');
