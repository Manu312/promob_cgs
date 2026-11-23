import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lineIntersection, joinWalls, angleFrom304050, pointOnWall, projectOnAngle } from '../src/domain/wallJoin.js';
import { normalizeRoom } from '../src/domain/room.js';
import { wallGeometry } from '../src/domain/walls.js';

// dos paredes sueltas que no se tocan: una horizontal (y=0) y una vertical (x=3000) que no llega
const room = normalizeRoom({
  version: 2, h: 2600, t: 150,
  nodes: [{ id: 'a', x: 0, z: 0 }, { id: 'b', x: 2500, z: 0 }, { id: 'c', x: 3000, z: 300 }, { id: 'd', x: 3000, z: 2000 }],
  walls: [{ id: 'w1', n0: 'a', n1: 'b' }, { id: 'w2', n0: 'c', n1: 'd' }],
});

test('intersección de rectas', () => {
  assert.deepEqual(lineIntersection([0, 0], [1, 0], [3000, 300], [0, 1]), [3000, 0]);
  assert.equal(lineIntersection([0, 0], [1, 0], [0, 5], [1, 0]), null);
});

test('encuentro en canto: las dos llegan a la esquina y comparten el vértice', () => {
  const r = joinWalls(room, 'w1', 'w2', 'canto');
  const g = wallGeometry(r);
  assert.deepEqual(g.find((w) => w.id === 'w1').b, [3000, 0]);
  assert.deepEqual(g.find((w) => w.id === 'w2').a, [3000, 0]);
  assert.equal(r.nodes.length, 3);
  assert.equal(r.walls.find((w) => w.id === 'w2').n0, 'b');
});

test('encuentro en T: solo se mueve la primera', () => {
  const r = joinWalls(room, 'w2', 'w1', 't');
  const g = wallGeometry(r);
  assert.deepEqual(g.find((w) => w.id === 'w2').a, [3000, 0]);
  assert.deepEqual(g.find((w) => w.id === 'w1').b, [2500, 0]);
  assert.equal(r.nodes.length, 4);
});

test('30-40-50: ángulo de la esquina por la ley del coseno', () => {
  assert.equal(angleFrom304050(300, 400, 500), 90);
  assert.ok(angleFrom304050(300, 400, 520) > 90);
  assert.equal(angleFrom304050(300, 400, 900), null, 'medidas imposibles');
});

test('construir con referencia y bloquear ángulo', () => {
  assert.deepEqual(pointOnWall(room, 'w1', 1000), [1000, 0]);
  const p = projectOnAngle([0, 0], [1000, 200], 0);
  assert.equal(p.len, 1000);
  assert.deepEqual(p.point.map(Math.round), [1000, 0]);
});
