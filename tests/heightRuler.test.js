import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRoom } from '../src/domain/room.js';
import { heightRuler, parseHeights } from '../src/domain/dimensions.js';
import { sampleProject } from '../src/domain/project.js';

test('regla sin módulos: las alturas de referencia, ordenadas', () => {
  const r = normalizeRoom({ w: 3600, d: 3000 });
  assert.deepEqual(heightRuler(r, []).map((m) => [m.h, m.kind]), [[100, 'ref'], [820, 'ref'], [1470, 'ref'], [2010, 'ref'], [2280, 'ref']]);
});

test('regla con módulos: suma bases y topes (sin el piso), sin repetir', () => {
  const p = sampleProject();
  const marks = heightRuler(p.room, p.modules);
  const hs = marks.map((m) => m.h);
  assert.deepEqual(hs, [...hs].sort((a, b) => a - b), 'ordenada');
  assert.equal(new Set(hs).size, hs.length, 'sin repetidos');
  for (const h of [870, 1450, 2150]) assert.ok(hs.includes(h), `incluye ${h}`);
  assert.ok(!hs.includes(0));
  assert.equal(marks.find((m) => m.h === 1450).kind, 'mod');
});

test('si una altura de módulo coincide con una de referencia, queda como referencia', () => {
  const r = normalizeRoom({ w: 3600, d: 3000, refHeights: [870] });
  const m = { id: 'a', type: 'bajo', params: { width: 600, height: 870, depth: 560 }, x: 0, z: 0, y: 0, rot: 0 };
  assert.deepEqual(heightRuler(r, [m]), [{ h: 870, kind: 'ref' }]);
});

test('las alturas de referencia se sanean: números positivos, ordenados y únicos', () => {
  assert.deepEqual(normalizeRoom({ w: 3000, d: 3000, refHeights: ['900', -5, 100, 100, 'x'] }).refHeights, [100, 900]);
  assert.deepEqual(parseHeights('100; 820 1470,abc 820'), [100, 820, 1470]);
});
