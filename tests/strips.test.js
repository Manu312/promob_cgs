import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stripsOf, setStrips, stripCells, cellAt, applyStripMaterial, saveStripPreset, rectPts, circlePts, polyArea, offsetPolygon, chamferPolygon, filletPolygon, cutPolygon, addRegion, updateRegion, removeRegion, duplicateRegion, regionsOn } from '../src/domain/strips.js';

const room = { walls: [{ id: 'w1' }], strips: {} };

test('franjas: alturas y posiciones limpias (dentro de la cara, sin repetir, ordenadas)', () => {
  const r = setStrips(room, 'w1', { h: [1200, 900, 900, 5000, -1], v: [1000] });
  assert.deepEqual(stripsOf(r, 'w1', 3000, 2600), { h: [900, 1200], v: [1000] });
});

test('las franjas parten la cara en celdas; se ubica la celda de un punto', () => {
  const cells = stripCells({ h: [900], v: [1000] }, 3000, 2600);
  assert.equal(cells.length, 4);
  assert.deepEqual(cellAt({ h: [900], v: [1000] }, 3000, 2600, 1500, 1500), { id: '1,1', row: 1, col: 1, u0: 1000, u1: 3000, v0: 900, v1: 2600 });
});

test('material en franjas: la celda, la fila (perfil horizontal) o la columna (perfil vertical)', () => {
  const r0 = setStrips(room, 'w1', { h: [900, 1500], v: [1000] });
  let r = applyStripMaterial(r0, 'w1', 3000, 2600, '1,0', 'rev-subway', 'region');
  assert.deepEqual(Object.keys(r.stripFinishes.w1), ['1,0']);
  r = applyStripMaterial(r0, 'w1', 3000, 2600, '1,0', 'rev-subway', 'perfil-h');
  assert.deepEqual(Object.keys(r.stripFinishes.w1).sort(), ['1,0', '1,1']);
  r = applyStripMaterial(r0, 'w1', 3000, 2600, '1,0', 'rev-subway', 'perfil-v');
  assert.deepEqual(Object.keys(r.stripFinishes.w1).sort(), ['0,0', '1,0', '2,0']);
});

test('configuraciones de franjas guardadas con nombre (reemplaza la del mismo nombre)', () => {
  let ps = saveStripPreset([], 'Guarda cocina', { h: [900, 1500], v: [] });
  ps = saveStripPreset(ps, 'Guarda cocina', { h: [850], v: [] });
  assert.deepEqual(ps, [{ name: 'Guarda cocina', h: [850], v: [] }]);
});

test('regiones: rectángulo, círculo, área', () => {
  assert.equal(Math.abs(polyArea(rectPts(0, 0, 100, 50))), 5000);
  const c = circlePts(0, 0, 100, 96);
  assert.ok(Math.abs(Math.abs(polyArea(c)) - Math.PI * 1e4) < 100);
});

test('offset de la forma: crece o se achica parejo', () => {
  const g = offsetPolygon(rectPts(0, 0, 100, 100), 10);
  assert.ok(Math.abs(Math.abs(polyArea(g)) - 120 * 120) < 1);
  const s = offsetPolygon(rectPts(0, 0, 100, 100), -10);
  assert.ok(Math.abs(Math.abs(polyArea(s)) - 80 * 80) < 1);
});

test('chanfle y filete en las esquinas', () => {
  const ch = chamferPolygon(rectPts(0, 0, 100, 100), 10);
  assert.equal(ch.length, 8);
  assert.ok(Math.abs(Math.abs(polyArea(ch)) - (10000 - 4 * 50)) < 1e-6);
  const f = filletPolygon(rectPts(0, 0, 100, 100), 10, null, 12);
  const a = Math.abs(polyArea(f));
  assert.ok(a < 10000 && a > 10000 - 4 * 50, 'el filete saca menos que el chanfle');
});

test('cortar una región con una recta vertical u horizontal', () => {
  const [a, b] = cutPolygon(rectPts(0, 0, 100, 50), 'v', 30);
  assert.deepEqual([Math.abs(polyArea(a)), Math.abs(polyArea(b))].sort((x, y) => x - y), [1500, 3500]);
  assert.equal(cutPolygon(rectPts(0, 0, 100, 50), 'h', 80).length, 1, 'la recta no la cruza');
});

test('regiones en el ambiente: agregar, mover, duplicar, quitar; por superficie', () => {
  let { room: r, id } = addRegion(room, { kind: 'wall', wallId: 'w1' }, rectPts(0, 0, 600, 400), { mat: 'rev-subway' });
  r = updateRegion(r, id, { pts: rectPts(100, 0, 700, 400) });
  const d = duplicateRegion(r, id);
  assert.equal(regionsOn(d.room, { kind: 'wall', wallId: 'w1' }).length, 2);
  assert.equal(d.room.regions[1].pts[0][0], 700);
  assert.equal(d.room.regions[1].finish.mat, 'rev-subway');
  assert.equal(regionsOn(removeRegion(d.room, id), { kind: 'wall', wallId: 'w1' }).length, 1);
  assert.equal(regionsOn(d.room, { kind: 'floor' }).length, 0);
});

import { rectMinusRects } from '../src/domain/strips.js';
test('la celda descuenta los vanos (puertas y ventanas)', () => {
  const parts = rectMinusRects({ u0: 0, u1: 3000, v0: 0, v1: 2600 }, [{ u0: 1000, u1: 2000, v0: 900, v1: 2100 }]);
  const area = parts.reduce((a, c) => a + (c.u1 - c.u0) * (c.v1 - c.v0), 0);
  assert.equal(area, 3000 * 2600 - 1000 * 1200);
  assert.deepEqual(rectMinusRects({ u0: 0, u1: 10, v0: 0, v1: 10 }, [{ u0: 20, u1: 30, v0: 0, v1: 5 }]), [{ u0: 0, u1: 10, v0: 0, v1: 10 }]);
});
