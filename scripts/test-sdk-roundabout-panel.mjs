import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../core/map/sdkRoundaboutPanel.js', import.meta.url), 'utf8');
const { getSdkRoundaboutPanel } = await import(
  `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`,
);
const entry = {
  instructionType: 'RoundaboutGuidanceInstruction',
  roundaboutExitNumber: 3,
  roundaboutTurnAngle: 90,
  roadName: 'Stagsden Road',
  signpostExitNumber: 'A6',
};
const panel = getSdkRoundaboutPanel(entry);
assert.equal(panel.text, 'Take exit 3 onto Stagsden Road');
assert.equal(panel.exitNumber, 3);
assert.equal(panel.turnAngle, 90);
assert.equal(panel.maneuver, 'ROUNDABOUT_ENTER');
const exit = getSdkRoundaboutPanel({ ...entry, instructionType: 'ExitRoundaboutGuidanceInstruction' });
assert.equal(exit.exitNumber, 3);
assert.equal(exit.maneuver, 'ROUNDABOUT_EXIT');
assert.equal(getSdkRoundaboutPanel({ instructionType: 'TurnGuidanceInstruction' }), null);
const absent = getSdkRoundaboutPanel({ instructionType: 'RoundaboutGuidanceInstruction', signpostExitNumber: '3' });
assert.equal(absent.exitNumber, null);
assert.equal(absent.turnAngle, null);
assert.equal(absent.text, 'Enter roundabout');

const routingSource = fs.readFileSync(new URL('../core/map/utils/tomtomRouting.js', import.meta.url), 'utf8');
const extractAngleSource = routingSource.match(/const extractRoundaboutTurnAngle = \(instruction = \{\}\) => \{[\s\S]*?\n\};/);
assert.ok(extractAngleSource, 'REST roundabout angle extractor exists');
const extractAngle = new Function(`${extractAngleSource[0]}; return extractRoundaboutTurnAngle;`)();
const consecutiveRoundabouts = [
  { turnAngle: 90, roundaboutTurnAngle: 90 },
  { turnAngle: 90, roundaboutTurnAngle: 0 },
  { turnAngle: 90, roundaboutTurnAngle: -90 },
  { turnAngle: 90, roundaboutTurnAngleInDecimalDegrees: 137 },
];
assert.deepEqual(consecutiveRoundabouts.map(extractAngle), [90, 0, -90, 137]);
assert.equal(extractAngle({ turnAngleInDecimalDegrees: null, roundaboutTurnAngle: -45 }), -45);
assert.equal(extractAngle({ turnAngle: null, exitAngle: '' }), null);
assert.equal(extractAngle({ turnAngleInDecimalDegrees: 0 }), 0);

const screenSource = fs.readFileSync(new URL('../core/screens/MapScreenRN-TomTom.js', import.meta.url), 'utf8');
const displayAngleSource = screenSource.match(/function getRoundaboutExitAngleDegrees\([\s\S]*?\n\}/);
assert.ok(displayAngleSource, 'Roundabout display angle helper exists');
const displayAngle = new Function(`${displayAngleSource[0]}; return getRoundaboutExitAngleDegrees;`)();
assert.deepEqual(
  consecutiveRoundabouts.map((instruction) => displayAngle('ROUNDABOUT_ENTER', 2, extractAngle(instruction))),
  [0, 270, 180, 47],
);
assert.equal(displayAngle('ROUNDABOUT_ENTER', 2, 179), 89);
assert.equal(displayAngle('ROUNDABOUT_ENTER', 2, -179), 91);
assert.match(screenSource, /<Svg key=\{`\$\{safeExit \?\? "unknown"\}:\$\{angle\}`\}/);
console.log('Passed: SDK roundabouts, consecutive REST angles, missing metadata, full-circle display angles, and SVG refresh identity');