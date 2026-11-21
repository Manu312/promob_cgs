import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildModule, MODULE_TYPES, snapPosition, footprint } from '../src/domain/modules.js';
import { buildAll, computeCutList, partDims } from '../src/domain/cutlist.js';
import { packGuillotine, nestAll } from '../src/domain/nesting.js';
import { computeBudget } from '../src/domain/budget.js';
import { DEFAULT_SETTINGS } from '../src/domain/catalog.js';
import { sampleProject } from '../src/domain/project.js';
import { normalizeRoom, roomWalls, wallPieces, pointInPolygon } from '../src/domain/room.js';

const ctx = { t: 18, tf: 18 };

test('bajo mesada 600: laterales, piso, travesaños, fondo, zócalo, 2 puertas', () => {
  const b = buildModule({ type: 'bajo', params: MODULE_TYPES.bajo.defaults }, ctx);
  const names = b.parts.map((p) => p.name);
  assert.equal(names.filter((n) => n === 'Lateral').length, 2);
  assert.equal(names.filter((n) => n === 'Puerta').length, 2);
  assert.ok(names.includes('Fondo') && names.includes('Zócalo') && names.includes('Piso'));
  const lat = partDims(b.parts.find((p) => p.name === 'Lateral'));
  assert.deepEqual([lat.length, lat.width, lat.thick], [720, 557, 18]); // 870-150 alto, 560-3 prof.
  const piso = partDims(b.parts.find((p) => p.name === 'Piso'));
  assert.equal(piso.length, 564); // 600 - 2*18
  assert.equal(b.hardware.bisagra, 4);
  assert.equal(b.hardware.pata, 4);
});

test('cajonero: 3 cajones con correderas y sin estantes', () => {
  const b = buildModule({ type: 'bajo_cajones', params: MODULE_TYPES.bajo_cajones.defaults }, ctx);
  assert.equal(b.parts.filter((p) => p.name === 'Frente cajón').length, 3);
  assert.equal(b.hardware.corredera, 3);
  assert.equal(b.parts.filter((p) => p.name === 'Estante').length, 0);
});

test('placard corredizo: hojas y barral', () => {
  const b = buildModule({ type: 'placard_corr', params: MODULE_TYPES.placard_corr.defaults }, ctx);
  assert.equal(b.parts.filter((p) => p.name === 'Puerta corrediza').length, 2);
  assert.equal(b.hardware.kit_corrediza, 2);
  assert.ok(b.hardware.barral > 0);
});

test('todos los tipos generan piezas válidas (dimensiones > 0)', () => {
  for (const [type, def] of Object.entries(MODULE_TYPES)) {
    const b = buildModule({ type, params: def.defaults }, ctx);
    assert.ok(b.parts.length > 0, type);
    for (const p of b.parts) assert.ok(p.sx > 0 && p.sy > 0 && p.sz > 0, `${type}:${p.name}`);
  }
});

test('nesting guillotina: sin superposición, dentro de la placa', () => {
  const items = [];
  for (let i = 0; i < 30; i++) items.push({ ref: 'P' + i, l: 300 + (i * 37) % 900, w: 200 + (i * 53) % 500 });
  const { sheets, unplaced } = packGuillotine(items, 2600, 1830, { kerf: 4, trim: 10 });
  assert.equal(unplaced.length, 0);
  assert.equal(sheets.reduce((a, s) => a + s.placed.length, 0), 30);
  for (const s of sheets) {
    for (const p of s.placed) {
      assert.ok(p.x >= 10 && p.y >= 10 && p.x + p.pl <= 2590 && p.y + p.pw <= 1820, 'dentro de refilado');
    }
    for (let i = 0; i < s.placed.length; i++)
      for (let j = i + 1; j < s.placed.length; j++) {
        const a = s.placed[i], b = s.placed[j];
        const sep = a.x + a.pl + 4 <= b.x || b.x + b.pl + 4 <= a.x || a.y + a.pw + 4 <= b.y || b.y + b.pw + 4 <= a.y;
        assert.ok(sep, 'piezas separadas al menos por el kerf');
      }
  }
});

test('pieza más grande que la placa queda sin ubicar', () => {
  const { unplaced } = packGuillotine([{ ref: 'X', l: 3000, w: 500 }], 2600, 1830, {});
  assert.equal(unplaced.length, 1);
});

test('proyecto de ejemplo: despiece, corte y presupuesto completos', () => {
  const proj = sampleProject();
  const built = buildAll(proj, DEFAULT_SETTINGS);
  const cut = computeCutList(built);
  const nest = nestAll(cut.rows, DEFAULT_SETTINGS);
  const totalParts = cut.rows.reduce((a, r) => a + r.qty, 0);
  const placed = nest.reduce((a, n) => a + n.sheets.reduce((b, s) => b + s.placed.length, 0) + n.unplaced.length, 0);
  assert.equal(placed, totalParts);
  const bud = computeBudget(cut, nest, DEFAULT_SETTINGS);
  assert.ok(bud.total > bud.materiales && bud.materiales > 0);
});

const lat = (b) => partDims(b.parts.find((p) => p.name === 'Lateral'));

test('regla fondo en ranura: laterales a profundidad total y fondo dentro', () => {
  const b = buildModule({ type: 'bajo', params: MODULE_TYPES.bajo.defaults }, { ...ctx, tb: 5.5, rules: { backType: 'ranurado' } });
  assert.equal(lat(b).width, 560);
  const f = partDims(b.parts.find((p) => p.name === 'Fondo'));
  assert.deepEqual([f.length, f.width], [700, 580]); // (720-36+16) × (564+16)
});

test('regla sin fondo: no hay pieza Fondo', () => {
  const b = buildModule({ type: 'alacena', params: MODULE_TYPES.alacena.defaults }, { ...ctx, rules: { backType: 'sin' } });
  assert.ok(!b.parts.some((p) => p.name === 'Fondo'));
});

test('regla frentes embutidos: puerta entra entre laterales con luz', () => {
  const b = buildModule({ type: 'alacena', params: { ...MODULE_TYPES.alacena.defaults, doors: 1 } }, { ...ctx, rules: { frontType: 'embutido', gap: 2 } });
  const d = partDims(b.parts.find((p) => p.name === 'Puerta'));
  assert.deepEqual([d.length, d.width], [660, 560]); // 700-36-4 × 600-36-4
});

test('regla base zócalo fijo: sin patas y con zócalo trasero', () => {
  const b = buildModule({ type: 'bajo', params: MODULE_TYPES.bajo.defaults }, { ...ctx, rules: { base: 'zocalo' } });
  assert.equal(b.hardware.pata, undefined);
  assert.ok(b.parts.some((p) => p.name === 'Zócalo trasero'));
  const sinBase = buildModule({ type: 'bajo', params: MODULE_TYPES.bajo.defaults }, { ...ctx, rules: { base: 'ninguna' } });
  assert.equal(lat(sinBase).length, 870);
});

test('cajones usan material y espesor de caja propio', () => {
  const b = buildModule({ type: 'bajo_cajones', params: MODULE_TYPES.bajo_cajones.defaults }, { ...ctx, tc: 15, rules: { slideGap: 12.5 } });
  const side = b.parts.find((p) => p.name === 'Lateral cajón');
  assert.equal(side.role, 'cajon');
  assert.equal(side.sx, 15);
  const back = partDims(b.parts.find((p) => p.name === 'Trasero cajón'));
  assert.equal(back.length, 600 - 36 - 25 - 30); // iw - 2 holgura - 2 espesor
});

test('mesada: va al presupuesto por m², no al despiece', () => {
  const b = buildModule({ type: 'bajo', params: MODULE_TYPES.bajo.defaults }, ctx);
  assert.equal(b.hardware.mesada, 0.36); // 600 × (560+18+20)
  assert.ok(!b.parts.some((p) => /mesada/i.test(p.name)));
  assert.ok(b.decors.some((d) => d.decor === 'mesada'));
});

test('ambiente rectangular: 4 paredes con normales hacia afuera', () => {
  const r = normalizeRoom({ w: 3000, d: 2000 });
  const ws = roomWalls(r);
  assert.equal(ws.length, 4);
  assert.deepEqual(ws.map((w) => w.len), [3000, 2000, 3000, 2000]);
  const r0 = (v) => Math.round(v) + 0; // evita -0
  assert.deepEqual(ws[0].n.map(r0), [0, -1]); // pared del fondo mira hacia z negativo
  assert.deepEqual(ws[1].n.map(r0), [1, 0]); // pared derecha mira hacia x positivo
});

test('ambiente en L: 6 paredes y la esquina entrante funciona', () => {
  const r = normalizeRoom({ shape: 'L', w: 4000, d: 3000, cutW: 1500, cutD: 1000 });
  assert.equal(r.points.length, 6);
  assert.ok(pointInPolygon([500, 2500], r.points));
  assert.ok(!pointInPolygon([3500, 2500], r.points)); // recorte
  const ws = roomWalls(r);
  assert.deepEqual(ws[2].n.map((v) => Math.round(v) + 0), [0, 1]); // pared del recorte mira hacia el recorte
});

test('ambiente libre: usa los puntos y calcula el ancho total', () => {
  const r = normalizeRoom({ shape: 'libre', points: [[0, 0], [5000, 0], [5000, 1000], [3000, 3000], [0, 3000]] });
  assert.equal(r.w, 5000);
  assert.equal(roomWalls(r).length, 5);
});

test('pared con ventana y puerta se parte en trozos macizos', () => {
  const pieces = wallPieces(3000, 2600, [
    { offset: 500, width: 1000, sill: 900, height: 1100 },
    { offset: 2000, width: 800, sill: 0, height: 2000 },
  ]);
  // izq, bajo ventana, sobre ventana, medio, dintel puerta, der
  assert.equal(pieces.length, 6);
  const area = pieces.reduce((a, p) => a + (p.u1 - p.u0) * (p.v1 - p.v0), 0);
  assert.equal(area, 3000 * 2600 - 1000 * 1100 - 800 * 2000);
});

test('aberturas se ajustan a su pared', () => {
  const r = normalizeRoom({ w: 2000, d: 2000, openings: [{ id: 'a', wall: 0, offset: 1800, width: 900, height: 3000, sill: 0 }, { id: 'b', wall: 9, offset: 0, width: 500, height: 500 }] });
  assert.equal(r.openings.length, 1); // la de pared inexistente se descarta
  assert.equal(r.openings[0].offset, 1100);
  assert.equal(r.openings[0].height, 2600);
});

test('snap a paredes de un ambiente en L y a columnas', () => {
  const room = normalizeRoom({ shape: 'L', w: 4000, d: 3000, cutW: 1500, cutD: 1000, columns: [{ id: 'c', x: 1000, z: 0, w: 300, d: 300 }] });
  const m = { params: { width: 600, depth: 560 }, x: 1880, z: 1420, rot: 0 };
  // borde derecho cerca de la pared del recorte (x=2500) y frente cerca de z=2000
  assert.deepEqual(snapPosition(m, [], room), { x: 1900, z: 1440 });
  const m2 = { params: { width: 600, depth: 560 }, x: 1320, z: 5, rot: 0 };
  assert.deepEqual(snapPosition(m2, [], room), { x: 1300, z: 0 }); // pegado a la columna
});

test('snap a pared y a vecino', () => {
  const room = { w: 3600, d: 3000, h: 2600 };
  const a = { params: { width: 600, depth: 560 }, x: 0, z: 0, rot: 0 };
  const b = { params: { width: 600, depth: 560 }, x: 625, z: 22, rot: 0 };
  assert.deepEqual(snapPosition(b, [a], room), { x: 600, z: 0 });
  assert.deepEqual(footprint({ ...b, rot: 90 }), { fw: 560, fd: 600 });
});
