import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MODULE_TYPES, buildModule, fieldsFor } from '../src/domain/modules.js';
import { itemParams, findItem } from '../src/domain/library.js';

const ctx = { t: 18, tf: 18, tb: 3 };
const build = (type, params = {}) => buildModule({ type, params: { ...MODULE_TYPES[type].defaults, ...params } }, ctx);
const fronts = (b) => b.parts.filter((p) => p.role === 'frente');
const overlapsY = (p, y0, y1) => p.y < y1 - 1 && p.y + p.sy > y0 + 1;

test('bajo p/ horno: hueco libre arriba y un cajón abajo', () => {
  const p = MODULE_TYPES.bajo_horno.defaults;
  const b = build('bajo_horno');
  const nb = p.plinth + 18 + p.nicheY, nt = nb + p.nicheH;
  assert.equal(b.parts.filter((x) => x.name === 'Frente cajón').length, 1);
  assert.equal(b.parts.filter((x) => x.name === 'Puerta').length, 0);
  assert.ok(fronts(b).every((f) => !overlapsY(f, nb, nt)), 'ningún frente tapa el hueco');
});

test('torre p/ horno: cajones abajo, hueco al medio y puerta arriba', () => {
  const p = MODULE_TYPES.torre_horno.defaults;
  const b = build('torre_horno');
  const nb = p.plinth + 18 + p.nicheY, nt = nb + p.nicheH;
  const drawers = b.parts.filter((x) => x.name === 'Frente cajón');
  const doors = b.parts.filter((x) => x.name === 'Puerta');
  assert.equal(drawers.length, 2);
  assert.equal(doors.length, 1);
  assert.ok(drawers.every((d) => d.y + d.sy <= nb));
  assert.ok(doors.every((d) => d.y >= nt));
  assert.equal(b.parts.filter((x) => x.name === 'Divisor horizontal').length, 2);
});

test('torre p/ heladera: hueco desde el piso y puertas arriba', () => {
  const b = build('torre_heladera');
  const doors = b.parts.filter((x) => x.name === 'Puerta');
  assert.equal(doors.length, 2);
  assert.ok(doors.every((d) => d.y >= MODULE_TYPES.torre_heladera.defaults.nicheH));
});

test('tapa p/ 2 bachas: va por m² al presupuesto, sin piezas de corte', () => {
  const b = build('tapa', { width: 1800, bachas: 2 });
  assert.equal(b.parts.length, 0);
  assert.equal(b.decors.filter((d) => d.decor === 'bacha').length, 2);
  assert.equal(b.hardware.mesada, Math.round((1800 * 600) / 1e4) / 100);
  assert.equal(b.hardware.bacha, 2);
});

test('vista y estante: una placa cada uno', () => {
  const v = build('vista');
  assert.deepEqual([v.parts.length, v.parts[0].role, v.parts[0].sx], [1, 'frente', 18]);
  const e = build('estante');
  assert.deepEqual([e.parts.length, e.parts[0].sx, e.parts[0].sz], [1, 800, 250]);
  assert.deepEqual(fieldsFor('estante'), ['width', 'depth']);
});

test('ítems del catálogo: cajonero 4C, 2C+1P e isla', () => {
  const c4 = build('bajo_cajones', itemParams(findItem('coc-inf-caj4').item));
  assert.equal(c4.parts.filter((x) => x.name === 'Frente cajón').length, 4);
  const b21 = build('bajo_mixto', itemParams(findItem('coc-inf-2c1p').item));
  assert.deepEqual([b21.parts.filter((x) => x.name === 'Frente cajón').length, b21.parts.filter((x) => x.name === 'Puerta').length], [2, 1]);
  assert.equal(itemParams(findItem('coc-isla').item).depth, 900);
  assert.equal(findItem('coc-sb-2p').item.y, 1800);
});

// Nombre del ítem y tapa apoyada al insertar
import { withItem } from '../src/domain/library.js';
import { moduleName, newModule } from '../src/domain/modules.js';
import { normalizeRoom } from '../src/domain/room.js';

test('insertar desde un ítem: guarda su nombre y la tapa se apoya sobre el bajo', () => {
  const room = normalizeRoom({ w: 3600, d: 3000, openings: [] });
  const bajo = { id: 'b', type: 'bajo', params: { ...MODULE_TYPES.bajo.defaults, height: 850 }, x: 0, z: 0, y: 0, rot: 0 };
  const item = findItem('coc-tapa-2bachas').item;
  const m = withItem({ ...newModule('tapa', { room, modules: [] }, itemParams(item)), x: 0, z: 0 }, item, [bajo]);
  assert.equal(moduleName(m), 'Tapa p/ 2 bachas');
  assert.equal(m.rest, true);
  assert.equal(m.y, 850);
  const sinNombre = withItem(newModule('bajo', { room, modules: [] }), findItem('coc-inf-2p').item, []);
  assert.equal(sinNombre.name, undefined);
  assert.equal(moduleName(sinNombre), MODULE_TYPES.bajo.label);
});
