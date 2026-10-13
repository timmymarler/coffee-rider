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
console.log('Passed: SDK third exit, angle, approach/exit phase, non-roundabout, and absent metadata');