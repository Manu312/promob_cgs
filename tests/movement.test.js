import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRoom } from '../src/domain/room.js';
import { MODULE_TYPES } from '../src/domain/modules.js';
import { nudgeTarget, rotateAboutCenter, lockAxis } from '../src/domain/movement.js';
import { collideLift } from '../src/domain/collision.js';

const mod = (id, x, z, extra = {}) => ({ id, type: 'bajo', params: { ...MODULE_TYPES.bajo.defaults }, x, z, y: 0, rot: 0, ...extra }); // 600 × 870 × 560

test('paso en ejes del ambiente', () => {
  const m = mod('a', 1000, 500, { rot: 90 });
  assert.deepEqual(nudgeTarget(m, 'w', 1, 10, false), { x: 1010, z: 500 });
  assert.deepEqual(nudgeTarget(m, 'd', -1, 10, false), { x: 1000, z: 490 });
});

test('Posición relativa: el paso sigue la rotación del módulo', () => {
  const m = mod('a', 1000, 500, { rot: 90 });
  assert.deepEqual(nudgeTarget(m, 'w', 1, 10, true), { x: 1000, z: 490 });
  assert.deepEqual(nudgeTarget(m, 'd', 1, 10, true), { x: 1010, z: 500 });
  assert.deepEqual(nudgeTarget(mod('b', 0, 0), 'w', 1, 10, true), { x: 10, z: 0 });
});

test('mover en altura nunca baja del piso', () => {
  assert.deepEqual(nudgeTarget(mod('a', 0, 0, { y: 5 }), 'h', -1, 10), { y: 0 });
  assert.deepEqual(nudgeTarget(mod('a', 0, 0), 'h', 1, 100), { y: 100 });
});

test('girar sobre el centro mantiene el centro', () => {
  const m = mod('a', 1000, 0); // centro (1300, 280)
  const r = rotateAboutCenter(m, 90);
  assert.equal(r.rot, 90);
  assert.deepEqual([r.x + 560 / 2, r.z + 600 / 2], [1300, 280]);
  assert.equal(rotateAboutCenter({ ...m, rot: 270 }, 90).rot, 0);
  assert.equal(rotateAboutCenter(m, -90).rot, 270);
});

test('trabar eje (teclas X / Y)', () => {
  const m = mod('a', 100, 200);
  assert.deepEqual(lockAxis(m, 500, 900, 'x'), { x: 500, z: 200 });
  assert.deepEqual(lockAxis(m, 500, 900, 'z'), { x: 100, z: 900 });
  assert.deepEqual(lockAxis(m, 500, 900, null), { x: 500, z: 900 });
});

test('subir con colisión frena debajo de la alacena; bajar frena en la mesada', () => {
  const r = normalizeRoom({ w: 3600, d: 3000, openings: [] });
  const bajo = mod('b', 0, 0);
  const alacena = { ...mod('a', 0, 0), type: 'alacena', params: { ...MODULE_TYPES.alacena.defaults }, y: 1450 };
  assert.equal(collideLift(bajo, 2000, r, [bajo, alacena]), 1450 - 870);
  assert.equal(collideLift(alacena, 0, r, [bajo, alacena]), 870);
  assert.equal(collideLift(alacena, 1600, r, [bajo, alacena]), 1600);
  assert.equal(collideLift(bajo, -50, r, [bajo]), 0);
});
