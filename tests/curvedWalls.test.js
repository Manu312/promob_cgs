import { test } from 'node:test';
import assert from 'node:assert/strict';
import { arcAngleFromSagitta, sagittaFromArcAngle, arcLength, arcPoints, sagittaFromPoint, arcMid, arcNormals } from '../src/domain/curvedWalls.js';

const a = [0, 0], b = [2000, 0], n = [0, -1]; // pared del fondo: afuera es −z

test('flecha ↔ ángulo del arco', () => {
  assert.equal(arcAngleFromSagitta(2000, 1000), 180);
  assert.equal(sagittaFromArcAngle(2000, 180), 1000);
  assert.equal(sagittaFromArcAngle(2000, arcAngleFromSagitta(2000, 300)), 300);
  assert.equal(arcAngleFromSagitta(2000, 0), 0);
});

test('largo del arco: semicírculo y casi recta', () => {
  assert.equal(arcLength(2000, 1000), Math.round(Math.PI * 1000));
  assert.ok(Math.abs(arcLength(2000, 1) - 2000) <= 1);
  assert.equal(arcLength(2000, 0), 2000);
});

test('el arco pasa por los extremos y por la panza (hacia afuera con flecha positiva)', () => {
  const pts = arcPoints(a, b, n, 400, 40);
  const near = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 1e-6;
  assert.ok(near(pts[0], a) && near(pts.at(-1), b));
  assert.ok(Math.abs(pts[20][1] + 400) < 1e-6, 'panza a 400 mm hacia afuera (−z)');
  const inward = arcPoints(a, b, n, -300, 40);
  assert.ok(Math.abs(inward[20][1] - 300) < 1e-6);
  assert.deepEqual(arcPoints(a, b, n, 0), [a, b]);
});

test('hotpoint: la flecha sale de dónde se suelta el punto medio', () => {
  assert.equal(sagittaFromPoint(a, b, n, [1000, -250]), 250);
  assert.deepEqual(arcMid(a, b, n, 250), [1000, -250]);
});

test('normales del arco hacia afuera', () => {
  const pts = arcPoints(a, b, n, 400, 10);
  assert.ok(arcNormals(pts, n).every((m) => m[0] * n[0] + m[1] * n[1] > 0));
});

import { obstaclesFor } from '../src/domain/collision.js';
import { emptyProject } from '../src/domain/project.js';
test('colisión: la pared curva choca a lo largo del arco (no de la cuerda)', () => {
  const room = emptyProject().room;
  const w = room.walls[0];
  const curved = { ...room, walls: room.walls.map((x) => (x.id === w.id ? { ...x, flecha: 500 } : x)) };
  const n = (r) => obstaclesFor({ id: 'm', params: { height: 100 } }, r, []).filter((o) => o.kind === 'wall' && o.id === w.id).length;
  assert.equal(n(room), 1);
  assert.equal(n(curved), 16);
});
