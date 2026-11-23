import { test } from 'node:test';
import assert from 'node:assert/strict';
import { linearSpan, linearItemFor, segmentsFromClicks, autoTamponamento, DEFAULT_TOP_ITEMS } from '../src/domain/tamponamento.js';
import { MODULE_TYPES, footprint } from '../src/domain/modules.js';

const bajo = (id, x, extra = {}) => ({ id, type: 'bajo', params: { ...MODULE_TYPES.bajo.defaults, width: 600, depth: 560, height: 870 }, x, z: 0, y: 0, rot: 0, ...extra });
const [mesada, , estante, lateral] = DEFAULT_TOP_ITEMS;

test('extensión de varios módulos alineados', () => {
  const sp = linearSpan([bajo('a', 0), bajo('b', 600), bajo('c', 1200)]);
  assert.deepEqual([sp.s0, sp.s1, sp.b0, sp.depth, sp.top], [0, 1800, 0, 560, 870]);
});

test('tapa lineal sobre tres bajos: los cubre a todos, arriba, con el vuelo al frente', () => {
  const t = linearItemFor([bajo('a', 0), bajo('b', 600), bajo('c', 1200)], mesada);
  assert.deepEqual([t.type, t.x, t.z, t.y, t.params.width, t.params.depth, t.params.height], ['tapa', 0, 0, 870, 1800, 580, 20]);
});

test('también con los módulos girados (sobre la pared de la izquierda)', () => {
  const mods = [bajo('a', 0, { rot: 90, z: 0 }), bajo('b', 0, { rot: 90, z: 600 })];
  const sp = linearSpan(mods);
  const t = linearItemFor(mods, estante);
  const f = footprint(t);
  assert.equal(t.rot, 90);
  assert.equal(t.params.width, 1200);
  // la huella de la tapa coincide con la de los dos módulos juntos
  assert.deepEqual([t.x, t.z, f.fw, f.fd], [0, 0, 560, 1200]);
  assert.equal(sp.s1 - sp.s0, 1200);
});

test('los clics en la vista frontal definen las uniones de la tapa', () => {
  assert.deepEqual(segmentsFromClicks(0, 3000, [1800, 900, 900, 5000]), [[0, 900], [900, 1800], [1800, 3000]]);
});

test('automático: tapas primero, los laterales suben hasta cubrir la tapa', () => {
  const out = autoTamponamento([bajo('a', 0), bajo('b', 600)], { top: mesada, side: lateral, mode: 'ambos', priority: 'tapas' });
  const [tapa, l1, l2] = out;
  assert.equal(tapa.params.width, 1200);
  assert.equal(l1.params.height, 890);
  assert.deepEqual([l1.x, l2.x], [-18, 1200]);
});

test('automático: laterales primero, la tapa crece y los cubre', () => {
  const [tapa, l1] = autoTamponamento([bajo('a', 0), bajo('b', 600)], { top: mesada, side: lateral, mode: 'ambos', priority: 'laterales' });
  assert.deepEqual([tapa.x, tapa.params.width], [-18, 1236]);
  assert.equal(l1.params.height, 870);
  assert.equal(autoTamponamento([bajo('a', 0)], { mode: 'tapas' }).length, 1);
  assert.equal(autoTamponamento([bajo('a', 0)], { mode: 'laterales' }).length, 2);
});
