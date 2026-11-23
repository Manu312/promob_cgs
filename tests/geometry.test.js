import { test } from 'node:test';
import assert from 'node:assert/strict';
import { regularPolygon, polygonRadii, nextPoint, snapSegment, linealOutline, outlineOf, geometryDims, resizeGeometry, moveGeometry, newGeometry, addGeometry, updateGeometry, removeGeometry, convertGeometry, geometryBudgetLines, rectPts } from '../src/domain/geometry.js';
import { polyArea } from '../src/domain/strips.js';

const floor = { kind: 'floor' };

test('poligonal: por radio circunscrito, inscrito o tamaño del lado (son equivalentes)', () => {
  const r = polygonRadii(6, 300);
  assert.deepEqual(r, { circ: 300, insc: 259.8, side: 300 });
  const a = regularPolygon(0, 0, 6, { circ: 300 }), b = regularPolygon(0, 0, 6, { side: 300 });
  assert.ok(a.every((p, i) => Math.abs(p[0] - b[i][0]) < 1e-6 && Math.abs(p[1] - b[i][1]) < 1e-6));
});

test('construir con precisión: largo + ángulo y ajuste por incremento', () => {
  const p = nextPoint([0, 0], 1000, 90);
  assert.ok(Math.abs(p[0]) < 1e-9 && Math.abs(p[1] - 1000) < 1e-9);
  const s = snapSegment([0, 0], [1012, 31]);
  assert.deepEqual([s.length, s.angle], [1000, 0]);
});

test('lineal: el recorrido con su espesor hacia el frente', () => {
  const o = linealOutline([[0, 0], [1000, 0]], 18, 'frente');
  assert.equal(Math.round(Math.abs(polyArea(o))), 18000);
  const L = linealOutline([[0, 0], [1000, 0], [1000, 800]], 20, 'frente');
  assert.ok(Math.abs(polyArea(L)) > 20 * 1700);
});

test('medidas, área, escalar y mover', () => {
  const g = newGeometry('rect', floor, { pts: rectPts(0, 0, 600, 400) }, { height: 900 });
  assert.deepEqual(geometryDims(g), { width: 600, depth: 400, height: 900, area: 240000 });
  assert.deepEqual(geometryDims(resizeGeometry(g, 'width', 1200)), { width: 1200, depth: 400, height: 900, area: 480000 });
  assert.deepEqual(geometryDims(resizeGeometry(g, 'width', 1200, true)).depth, 800);
  const c = newGeometry('circ', floor, { cx: 0, cy: 0, radius: 500 });
  assert.equal(geometryDims(c).width, 1000);
  assert.equal(outlineOf({ ...c, arc: 90 }).length, 50, 'circular con ángulo de arco: sector');
  assert.deepEqual(moveGeometry(g, 10, 20).pts[0], [10, 20]);
});

test('alta, cambios y baja en el proyecto', () => {
  const g = newGeometry('rect', floor, { pts: rectPts(0, 0, 100, 100) });
  let p = addGeometry({ modules: [] }, g);
  p = updateGeometry(p, g.id, { height: 300 });
  assert.equal(p.geometries[0].height, 300);
  assert.equal(removeGeometry(p, g.id).geometries.length, 0);
});

test('convertir en panel, estante o tapa (solo rectangulares con medidas válidas)', () => {
  const g = newGeometry('rect', floor, { pts: rectPts(100, 0, 118, 560) }, { height: 870 });
  const r = convertGeometry(g, 'vista');
  assert.deepEqual([r.module.type, r.module.params.width, r.module.params.height, r.module.params.depth], ['vista', 18, 870, 560]);
  const t = convertGeometry(newGeometry('rect', floor, { pts: rectPts(0, 0, 1200, 600) }, { height: 20, offset: 870 }), 'tapa');
  assert.deepEqual([t.module.y, t.module.params.width, t.module.params.mesadaT], [870, 1200, 20]);
  assert.ok(convertGeometry(newGeometry('circ', floor, { cx: 0, cy: 0, radius: 300 }), 'vista').error);
});

test('presupuesto: solo las presupuestadas y visibles', () => {
  const a = { ...newGeometry('rect', floor, { pts: rectPts(0, 0, 1, 1) }), budget: { on: true, desc: 'Zócalo especial', price: 5000 } };
  const b = newGeometry('rect', floor, { pts: rectPts(0, 0, 1, 1) });
  assert.deepEqual(geometryBudgetLines({ geometries: [a, b] }), [{ label: 'Zócalo especial', ref: '', qty: 1, price: 5000 }]);
});
