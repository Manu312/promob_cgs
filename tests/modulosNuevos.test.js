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

// Esquineros (#62)
test('esquinero L 2P izq: dos puertas en el ángulo interior, fondos contra las dos paredes', () => {
  const b = build('esq_l');
  assert.equal(b.parts.filter((x) => x.name === 'Puerta').length, 2);
  assert.equal(b.parts.filter((x) => x.name === 'Fondo').length, 2);
  for (const x of b.parts) assert.ok(x.sx > 0 && x.sy > 0 && x.sz > 0 && x.x >= -0.01 && x.x + x.sx <= 950.01 && x.z + x.sz <= 950.01, x.name);
  assert.ok(b.hardware.mesada > 0);
});

test('esquinero L 1P: una puerta y un frente fijo; Der es el espejo de Izq', () => {
  const izq = build('esq_l', { doors: 1 });
  assert.deepEqual([izq.parts.filter((x) => x.name === 'Puerta').length, izq.parts.filter((x) => x.name === 'Frente fijo').length], [1, 1]);
  const der = build('esq_l', { doors: 1, side: 'der' });
  const fi = izq.parts.find((x) => x.name === 'Frente fijo'), fd = der.parts.find((x) => x.name === 'Frente fijo');
  assert.equal(Math.round(fd.x + fd.sx), Math.round(950 - fi.x));
  assert.equal(fd.z, fi.z);
});

test('esquinero oblicuo: puertas a 45° sobre el frente diagonal', () => {
  const b1 = build('esq_oblicuo');
  const b2 = build('esq_oblicuo', { doors: 2 });
  const d1 = b1.parts.filter((x) => x.name === 'Puerta'), d2 = b2.parts.filter((x) => x.name === 'Puerta');
  assert.equal(d1.length, 1);
  assert.equal(d2.length, 2);
  assert.ok(d1.every((d) => Math.abs(Math.abs(d.ry) - (3 * Math.PI) / 4) < 1e-6));
  const L = Math.hypot(340, 340);
  assert.ok(d1[0].sx > L - 10 && d1[0].sx < L);
  const c = [d1[0].x + d1[0].sx / 2, d1[0].z + d1[0].sz / 2];
  assert.ok(Math.abs(c[0] + c[1] - (900 + 560)) < 30, 'centro sobre la diagonal');
});

test('esquineros en el catálogo', () => {
  assert.equal(findItem('coc-esq-l2p-der').item.params.side, 'der');
  assert.equal(findItem('coc-esq-obl2p').path[2], 'diagonales');
});
