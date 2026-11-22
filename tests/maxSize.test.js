import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRoom } from '../src/domain/room.js';
import { MODULE_TYPES, PARAM_DEFS } from '../src/domain/modules.js';
import { maxSize } from '../src/domain/maxSize.js';

const room = () => normalizeRoom({ w: 3600, d: 3000, openings: [] });
const mod = (id, x, z, extra = {}) => ({ id, type: 'bajo', params: { ...MODULE_TYPES.bajo.defaults }, x, z, y: 0, rot: 0, ...extra }); // 600 × 870 × 560

test('ancho máximo: llena el hueco entre dos módulos', () => {
  const a = mod('a', 0, 0), b = mod('b', 1000, 0), c = mod('c', 2400, 0);
  const r = maxSize(b, 'width', room(), [a, b, c]);
  assert.deepEqual([r.x, r.params.width], [600, 1800]);
});

test('ancho máximo respeta el máximo de la medida', () => {
  const b = mod('b', 1000, 0);
  const r = maxSize(b, 'width', normalizeRoom({ w: 9000, d: 3000, openings: [] }), [b]);
  assert.equal(r.params.width, PARAM_DEFS.width.max);
});

test('profundidad máxima: crece hacia adelante hasta la pared de enfrente', () => {
  const b = mod('b', 1000, 0);
  const r = maxSize(b, 'depth', room(), [b]);
  assert.equal(r.z, 0);
  assert.equal(r.params.depth, Math.min(3000, PARAM_DEFS.depth.max));
});

test('alto máximo: hasta la alacena de arriba o el techo', () => {
  const b = mod('b', 0, 0);
  const al = { ...mod('al', 0, 0), type: 'alacena', params: { ...MODULE_TYPES.alacena.defaults }, y: 1450 };
  assert.equal(maxSize(b, 'height', room(), [b, al]).params.height, 1450);
  assert.equal(maxSize(b, 'height', room(), [b]).params.height, Math.min(2600, PARAM_DEFS.height.max));
});

test('girado 90°: el ancho crece sobre el eje z del ambiente', () => {
  const b = mod('b', 0, 1000, { rot: 90 }); // ocupa x 0–560, z 1000–1600
  const r = maxSize(b, 'width', room(), [b]);
  assert.equal(r.params.width, 3000);
  assert.equal(r.z, 0);
});
