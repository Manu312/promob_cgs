import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRoom } from '../src/domain/room.js';
import { MODULE_TYPES } from '../src/domain/modules.js';
import { insertPose } from '../src/domain/insert.js';
import { modulesOnWall } from '../src/domain/wallEdit.js';

const room = () => normalizeRoom({ w: 3600, d: 3000, openings: [] }); // 0..3600 × 0..3000
const P = { ...MODULE_TYPES.bajo.defaults }; // 600 × 870 × 560

test('cerca de la pared del fondo: de espaldas a ella, centrado en el puntero', () => {
  const r = room();
  const p = insertPose('bajo', P, r, [1500, 300]);
  assert.deepEqual([p.x, p.z, p.rot, p.y], [1200, 0, 0, 0]);
  assert.equal(p.wallId, r.walls[0].id);
  assert.deepEqual(modulesOnWall(r, p.wallId, [{ id: 'm', type: 'bajo', params: P, ...p }]), ['m']);
});

test('cerca de la pared izquierda: girado, con la espalda contra ella', () => {
  const r = room();
  const p = insertPose('bajo', P, r, [200, 1500]);
  assert.equal(p.x, 0);
  assert.equal(p.z, 1200);
  assert.ok([90, 270].includes(p.rot), String(p.rot));
  const m = { id: 'm', type: 'bajo', params: P, ...p };
  assert.deepEqual(modulesOnWall(r, p.wallId, [m]), ['m']);
});

test('lejos de las paredes: sobre el piso, centrado y sin girar', () => {
  const p = insertPose('bajo', P, room(), [1800, 1500]);
  assert.deepEqual([p.x, p.z, p.rot, p.wallId], [1500, 1220, 0, null]);
});

test('una alacena entra a su altura', () => {
  const p = insertPose('alacena', { ...MODULE_TYPES.alacena.defaults }, room(), [1500, 100]);
  assert.equal(p.y, MODULE_TYPES.alacena.y);
});
