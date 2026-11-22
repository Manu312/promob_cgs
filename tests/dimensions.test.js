import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRoom } from '../src/domain/room.js';
import { MODULE_TYPES } from '../src/domain/modules.js';
import { nearestDistances, applyDimEdit } from '../src/domain/dimensions.js';

const room = normalizeRoom({ w: 3600, d: 3000 });
const mod = (id, type, x, z, extra = {}) => ({ id, type, params: { ...MODULE_TYPES[type].defaults, ...(extra.params || {}) }, x, z, y: extra.y ?? MODULE_TYPES[type].y ?? 0, rot: extra.rot || 0 });
const byDir = (ds) => Object.fromEntries(ds.map((d) => [d.dir, d]));

test('distancias a las paredes en las cuatro direcciones (las caras pegadas no tienen cota)', () => {
  const m = mod('a', 'bajo', 500, 0); // 600 × 560
  const d = byDir(nearestDistances(m, room, [m]));
  assert.equal(d['-x'].dist, 500);
  assert.equal(d['-x'].target.kind, 'wall');
  assert.equal(d['+x'].dist, 2500);
  assert.equal(d['+z'].dist, 2440);
  assert.equal(d['-z'], undefined, 'pegado a la pared del fondo');
});

test('distancia entre módulos vecinos', () => {
  const a = mod('a', 'bajo', 500, 0);
  const b = mod('b', 'bajo', 1500, 0);
  const d = byDir(nearestDistances(a, room, [a, b]));
  assert.equal(d['+x'].dist, 400);
  assert.deepEqual(d['+x'].target, { kind: 'module', id: 'b' });
});

test('un módulo a otra altura (alacena) no corta la cota de un bajo mesada', () => {
  const a = mod('a', 'bajo', 500, 0);
  const up = mod('up', 'alacena', 1500, 0);
  assert.equal(byDir(nearestDistances(a, room, [a, up]))['+x'].dist, 2500);
});

test('distancia a una columna', () => {
  const r = normalizeRoom({ w: 3600, d: 3000, columns: [{ id: 'c', x: 3000, z: 0, w: 300, d: 300 }] });
  const m = mod('a', 'bajo', 2000, 0);
  const d = byDir(nearestDistances(m, r, [m]));
  assert.equal(d['+x'].dist, 400);
  assert.deepEqual(d['+x'].target, { kind: 'column', id: 'c' });
});

test('módulo rotado usa su huella real', () => {
  const m = mod('a', 'bajo', 0, 1000, { rot: 90 }); // huella 560 × 600
  const d = byDir(nearestDistances(m, room, [m]));
  assert.equal(d['+x'].dist, 3600 - 560);
  assert.equal(d['-z'].dist, 1000);
  assert.equal(d['+z'].dist, 3000 - 1600);
});

test('ambiente abierto: sin pared en una dirección no hay cota', () => {
  const open = normalizeRoom({
    version: 2,
    nodes: [{ id: 'A', x: 0, z: 0 }, { id: 'B', x: 3000, z: 0 }, { id: 'C', x: 3000, z: 2000 }],
    walls: [{ id: 'w1', n0: 'A', n1: 'B', t: 150, h0: 2600, h1: 2600 }, { id: 'w2', n0: 'B', n1: 'C', t: 150, h0: 2600, h1: 2600 }],
  });
  const m = mod('a', 'bajo', 1000, 500);
  const d = byDir(nearestDistances(m, open, [m]));
  assert.equal(d['-x'], undefined);
  assert.equal(d['+z'], undefined);
  assert.equal(d['+x'].dist, 1400);
  assert.equal(d['-z'].dist, 500);
});

test('la cota incluye los extremos para dibujarla', () => {
  const m = mod('a', 'bajo', 500, 0);
  const d = byDir(nearestDistances(m, room, [m]));
  assert.equal(d['-x'].from[0], 500);
  assert.equal(d['-x'].to[0], 0);
  assert.equal(d['-x'].from[1], d['-x'].to[1]);
});

test('editar una cota mueve el módulo para que valga el valor escrito', () => {
  const m = mod('a', 'bajo', 500, 0);
  const d = byDir(nearestDistances(m, room, [m]));
  assert.deepEqual(applyDimEdit(m, d['-x'], 700), { x: 700, z: 0 });
  assert.deepEqual(applyDimEdit(m, d['+x'], 2000), { x: 1000, z: 0 });
  assert.deepEqual(applyDimEdit(m, d['+z'], 2000), { x: 500, z: 440 });
});
