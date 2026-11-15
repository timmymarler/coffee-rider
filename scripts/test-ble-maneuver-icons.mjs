import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const sketch = fs.readFileSync(new URL('../experiments/esp32-round-ble-directions/esp32_round_ble_directions/esp32_round_ble_directions.ino', import.meta.url), 'utf8');
const functions = ['drawArrowBearLeft', 'drawArrowBearRight'].map((name) => {
  const match = sketch.match(new RegExp(`static void ${name}\\([^]*?\\n\\}`));
  assert.ok(match, `${name} exists`);
  return match[0];
}).join('\n');
const transmitter = fs.readFileSync(new URL('../core/ble/directionsTransmitter.js', import.meta.url), 'utf8');
const compactSource = transmitter.match(/function compact\([^]*?\n\}/)[0];
const normalizeSource = transmitter.match(/function normalizeManeuver\([^]*?\n\}/)[0];
const normalize = new Function(`${compactSource}\n${normalizeSource}\nreturn normalizeManeuver;`)();
for (const side of ['LEFT', 'RIGHT']) {
  for (const prefix of ['KEEP', 'BEAR', 'TURN_SLIGHT', 'MERGE']) {
    assert.equal(normalize(`${prefix}_${side}`), `BEAR_${side}`);
  }
  assert.equal(normalize(`TURN_${side}`), side);
}

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'coffee-rider-ble-icons-'));
try {
  const source = path.join(directory, 'icons.cpp');
  const executable = path.join(directory, 'icons');
  fs.writeFileSync(source, `
#include <cassert>
#include <vector>
struct Line { int x1, y1, x2, y2; };
struct Triangle { int x1, y1, x2, y2, x3, y3; };
std::vector<Line> lines;
std::vector<Triangle> triangles;
struct Display {
  void fillCircle(int, int, int, int) { assert(false && "No vertical joint needed"); }
  void fillTriangle(int x1, int y1, int x2, int y2, int x3, int y3, int) {
    triangles.push_back({x1, y1, x2, y2, x3, y3});
  }
} tft;
void drawThickLine(int x1, int y1, int x2, int y2, int, int) {
  lines.push_back({x1, y1, x2, y2});
}
${functions}
int main() {
  drawArrowBearLeft(120, 95, 1);
  assert(lines.size() == 1 && triangles.size() == 1);
  const auto left = lines[0];
  const auto headLeft = triangles[0];
  assert(left.x2 < left.x1 && left.y2 < left.y1);
  assert(left.x2 - left.x1 == left.y2 - left.y1);
  assert(headLeft.x2 - headLeft.x1 == headLeft.y3 - headLeft.y1);
  assert(headLeft.y2 - headLeft.y1 == headLeft.x3 - headLeft.x1);
  lines.clear(); triangles.clear();
  drawArrowBearRight(120, 95, 1);
  assert(lines.size() == 1 && triangles.size() == 1);
  const auto right = lines[0];
  const auto headRight = triangles[0];
  assert(left.x1 + right.x1 == 240 && left.x2 + right.x2 == 240);
  assert(left.y1 == right.y1 && left.y2 == right.y2);
  assert(headLeft.x1 + headRight.x1 == 240);
  assert(headLeft.x2 + headRight.x2 == 240);
  assert(headLeft.x3 + headRight.x3 == 240);
  assert(headLeft.y1 == headRight.y1 && headLeft.y2 == headRight.y2 && headLeft.y3 == headRight.y3);
}
`);
  for (const [command, args] of [['c++', ['-std=c++11', source, '-o', executable]], [executable, []]]) {
    const result = spawnSync(command, args, { encoding: 'utf8' });
    assert.ifError(result.error);
    assert.equal(result.status, 0, `${command}: ${result.stderr || result.stdout || result.signal}`);
  }
  console.log('Passed: BLE keep/bear/slight/merge mapping, diagonal shafts, symmetric heads, and mirrored left/right icons');
} finally {
  fs.rmSync(directory, { recursive: true, force: true });
}