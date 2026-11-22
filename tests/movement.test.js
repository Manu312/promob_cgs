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

// Rotación libre (#42)
import { footprint, snapPosition } from '../src/domain/modules.js';
import { collideMove, modulePoly } from '../src/domain/collision.js';

test('huella de un módulo girado 45°: caja envolvente', () => {
  const f = footprint(mod('a', 0, 0, { rot: 45 })); // 600 × 560
  const e = (600 + 560) * Math.SQRT1_2;
  assert.ok(Math.abs(f.fw - e) < 0.01 && Math.abs(f.fd - e) < 0.01);
  assert.deepEqual(footprint(mod('a', 0, 0, { rot: 90 })), { fw: 560, fd: 600 });
  assert.deepEqual(footprint(mod('a', 0, 0, { rot: 180 })), { fw: 600, fd: 560 });
});

test('girar 30° sobre el centro y volver deja el módulo igual', () => {
  const m = mod('a', 1000, 1000);
  const r = { ...m, ...rotateAboutCenter(m, 30) };
  assert.equal(r.rot, 30);
  const back = { ...r, ...rotateAboutCenter(r, -30) };
  assert.equal(back.rot, 0);
  assert.ok(Math.abs(back.x - 1000) <= 1 && Math.abs(back.z - 1000) <= 1);
});

test('el imán solo actúa a escuadra: girado, solo redondea a la grilla', () => {
  const r = normalizeRoom({ w: 3600, d: 3000, openings: [] });
  assert.deepEqual(snapPosition(mod('a', 23, 1007), [], r, 40, 10), { x: 0, z: 1007 > 0 ? 1010 : 0 });
  assert.deepEqual(snapPosition(mod('a', 23, 1007, { rot: 45 }), [], r, 40, 10), { x: 20, z: 1010 });
});

test('la colisión usa el rectángulo girado: la esquina frena contra la pared', () => {
  const r = normalizeRoom({ w: 3600, d: 3000, openings: [] });
  const m = mod('a', 1000, 1000, { rot: 45 });
  const to = collideMove(m, 1000, -2000, r, [m]);
  const zs = modulePoly({ ...m, ...to }).map((p) => p[1]);
  assert.ok(Math.min(...zs) >= -0.5 && Math.min(...zs) < 2, `z mínima ${Math.min(...zs)}`);
});

// Apoyar sobre otros (#46)
import { restingHeight } from '../src/domain/movement.js';

test('apoyado: toma la altura de la mesada que tiene debajo; sin nada, el piso', () => {
  const bajo = mod('b', 0, 0);
  const caja = { ...mod('c', 100, 50), rest: true };
  assert.equal(restingHeight(caja, [bajo, caja]), 870);
  assert.equal(restingHeight({ ...caja, x: 1500 }, [bajo, caja]), 0);
});

test('apoyado: una alacena colgada no es apoyo, pero un módulo apoyado sí', () => {
  const alacena = { ...mod('a', 0, 0), type: 'alacena', params: { ...MODULE_TYPES.alacena.defaults }, y: 1450 };
  const caja = { ...mod('c', 0, 0), rest: true };
  assert.equal(restingHeight(caja, [alacena, caja]), 0);
  const bajo = mod('b', 0, 0), tabla = { ...mod('s', 0, 0), params: { ...mod('s', 0, 0).params, height: 40 }, y: 870, rest: true };
  assert.equal(restingHeight(caja, [bajo, tabla, caja]), 910);
});

test('apoyado: un placard alto no es apoyo (ahí choca)', () => {
  const placard = { ...mod('p', 0, 0), params: { ...mod('p', 0, 0).params, height: 2400 } };
  const caja = { ...mod('c', 0, 0), rest: true };
  assert.equal(restingHeight(caja, [placard, caja]), 0);
});
