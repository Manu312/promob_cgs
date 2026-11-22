import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRoom, roomWalls } from '../src/domain/room.js';
import { wallAngles } from '../src/domain/walls.js';
import { setWallLength, setWallAngle, updateWall } from '../src/domain/wallEdit.js';
import { describeSelection } from '../src/domain/selection.js';
import { MODULE_TYPES } from '../src/domain/modules.js';

const rnd = (pts) => pts.map(([x, z]) => [Math.round(x) + 0, Math.round(z) + 0]);
const rect = () => normalizeRoom({ w: 3600, d: 3000 });
const openL = () => normalizeRoom({
  version: 2,
  nodes: [{ id: 'A', x: 0, z: 0 }, { id: 'B', x: 3000, z: 0 }, { id: 'C', x: 3000, z: 2000 }],
  walls: [{ id: 'w1', n0: 'A', n1: 'B', t: 150, h0: 2600, h1: 2600 }, { id: 'w2', n0: 'B', n1: 'C', t: 150, h0: 2600, h1: 2600 }],
});
const nodeXZ = (r, id) => { const n = r.nodes.find((x) => x.id === id); return [Math.round(n.x) + 0, Math.round(n.z) + 0]; };

test('largo de pared en un rectángulo: la pared siguiente se corre en paralelo y sigue cerrado', () => {
  const r0 = rect();
  const r = setWallLength(r0, r0.walls[0].id, 4000);
  assert.deepEqual(rnd(r.points), [[0, 0], [4000, 0], [4000, 3000], [0, 3000]]);
  assert.deepEqual(roomWalls(r).map((w) => w.len), [4000, 3000, 4000, 3000]);
  assert.deepEqual(r.walls.map((w) => w.id), r0.walls.map((w) => w.id));
  const shorter = setWallLength(r0, r0.walls[0].id, 3000);
  assert.deepEqual(rnd(shorter.points), [[0, 0], [3000, 0], [3000, 3000], [0, 3000]]);
});

test('largo de pared en L: el extremo de la pared siguiente se desliza sobre la otra', () => {
  const r0 = normalizeRoom({ shape: 'L', w: 4000, d: 3000, cutW: 1200, cutD: 1000 });
  const r = setWallLength(r0, r0.walls[0].id, 4500);
  assert.deepEqual(rnd(r.points), [[0, 0], [4500, 0], [4500, 2000], [2800, 2000], [2800, 3000], [0, 3000]]);
});

test('largo de pared en cadena abierta: la siguiente se traslada entera', () => {
  const r = setWallLength(openL(), 'w1', 3500);
  assert.deepEqual(nodeXZ(r, 'B'), [3500, 0]);
  assert.deepEqual(nodeXZ(r, 'C'), [3500, 2000]);
});

test('largo del último tramo de una cadena abierta: solo se mueve su extremo', () => {
  const r = setWallLength(openL(), 'w2', 2500);
  assert.deepEqual(nodeXZ(r, 'B'), [3000, 0]);
  assert.deepEqual(nodeXZ(r, 'C'), [3000, 2500]);
});

test('ángulos absoluto y relativo', () => {
  const ang = wallAngles(rect());
  assert.deepEqual(ang.map((a) => a.abs), [0, 270, 180, 90]);
  assert.deepEqual(ang.map((a) => a.rel), [90, 90, 90, 90]);
  const L = wallAngles(normalizeRoom({ shape: 'L', w: 4000, d: 3000 }));
  assert.equal(L[3].rel, 270, 'esquina entrante');
  const open = wallAngles(openL());
  assert.equal(open[0].rel, null, 'la primera pared de una cadena abierta no tiene anterior');
  assert.equal(open[1].rel, 90);
});

test('ángulo absoluto y relativo giran la pared sobre su inicio', () => {
  const byAbs = setWallAngle(openL(), 'w2', 300, 'abs');
  assert.deepEqual(nodeXZ(byAbs, 'C'), [4000, 1732]);
  const byRel = setWallAngle(openL(), 'w2', 120, 'rel');
  assert.deepEqual(nodeXZ(byRel, 'C'), [4000, 1732]);
  assert.equal(wallAngles(byRel)[1].rel, 120);
});

test('cambiar el ángulo en un rectángulo mantiene el ambiente cerrado', () => {
  const r0 = rect();
  const r = setWallAngle(r0, r0.walls[1].id, 280, 'abs');
  assert.notEqual(r.points, null);
  assert.equal(wallAngles(r)[2].abs, 180, 'la pared siguiente conserva su ángulo');
});

test('updateWall cambia solo las propiedades pedidas', () => {
  const r0 = rect();
  const id = r0.walls[1].id;
  const r = updateWall(r0, id, { h1: 2400, movable: true });
  const w = r.walls.find((x) => x.id === id);
  assert.equal(w.h0, 2600);
  assert.equal(w.h1, 2400);
  assert.equal(w.movable, true);
  assert.equal(r.walls[0].movable, false);
});

test('barra de estado: pared y módulo', () => {
  const r = rect();
  const p = { room: r, modules: [{ id: 'm', type: 'bajo', params: { ...MODULE_TYPES.bajo.defaults } }] };
  assert.equal(describeSelection(p, { kind: 'wall', id: r.walls[0].id }), 'Pared 1 · 3600 × 150 × 2600 · 9,36 m²');
  const sloped = { ...p, room: updateWall(r, r.walls[0].id, { h1: 2400 }) };
  assert.equal(describeSelection(sloped, { kind: 'wall', id: r.walls[0].id }), 'Pared 1 · 3600 × 150 × 2600–2400 · 9,00 m²');
  assert.equal(describeSelection(p, { kind: 'module', id: 'm' }), 'Bajo mesada puertas · 600 × 870 × 560');
  assert.equal(describeSelection(p, null), '');
  assert.equal(describeSelection(p, { kind: 'wall', id: 'no-existe' }), '');
});
