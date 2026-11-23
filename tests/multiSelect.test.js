import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toggleId, selectAllIds, groupBounds, moveGroup, rotateGroup, describeMulti } from '../src/domain/multiSelect.js';
import { rotateAboutCenter } from '../src/domain/movement.js';
import { sampleProject } from '../src/domain/project.js';
import { MODULE_TYPES } from '../src/domain/modules.js';

const mod = (id, x, z = 0, extra = {}) => ({ id, type: 'bajo', params: { ...MODULE_TYPES.bajo.defaults, width: 600, depth: 560 }, x, z, y: 0, rot: 0, mats: {}, ...extra });
const room = sampleProject().room;
const proj = (mods) => ({ room, modules: mods });

test('Ctrl+clic suma o quita; Ctrl+T selecciona los visibles', () => {
  assert.deepEqual(toggleId(['a'], 'b'), ['a', 'b']);
  assert.deepEqual(toggleId(['a', 'b'], 'a'), ['b']);
  assert.deepEqual(selectAllIds(proj([mod('a', 0), mod('b', 600, 0, { hidden: true }), mod('c', 1200)])), ['a', 'c']);
});

test('el conjunto se mueve rígido: todos se corren lo mismo y el resto queda quieto', () => {
  const p = proj([mod('a', 0, 500), mod('b', 600, 500), mod('c', 2000, 500)]);
  const q = moveGroup(p, ['a', 'b'], 100, 50);
  assert.deepEqual(q.modules.map((m) => [m.x, m.z]), [[100, 550], [700, 550], [2000, 500]]);
  // desde las posiciones del inicio del arrastre, sin acumular
  const r = moveGroup(q, ['a', 'b'], 10, 0, { base: p.modules });
  assert.deepEqual(r.modules.slice(0, 2).map((m) => m.x), [10, 610]);
});

test('con Colisión el conjunto frena en el primer obstáculo (el módulo de afuera)', () => {
  const p = proj([mod('a', 0, 500), mod('b', 600, 500), mod('c', 1500, 500)]);
  const q = moveGroup(p, ['a', 'b'], 500, 0, { collision: true });
  assert.deepEqual(q.modules.map((m) => m.x), [300, 900, 1500], 'b queda pegado a c');
});

test('girar el conjunto: alrededor del centro de la selección; con un solo módulo es como girarlo solo', () => {
  const one = mod('a', 1000, 500);
  const g = rotateGroup(proj([one]), ['a'], 90).modules[0];
  const r = rotateAboutCenter(one, 90);
  assert.deepEqual([g.x, g.z, g.rot], [r.x, r.z, r.rot]);
  const p = proj([mod('a', 0, 0), mod('b', 600, 0)]);
  const b0 = groupBounds(p.modules);
  const q = rotateGroup(p, ['a', 'b'], 90);
  const b1 = groupBounds(q.modules);
  assert.deepEqual([Math.round(b1.cx), Math.round(b1.cz)], [Math.round(b0.cx), Math.round(b0.cz)], 'el centro no se mueve');
  assert.equal(Math.round(b1.w), Math.round(b0.d));
  assert.equal(Math.round(b1.d), Math.round(b0.w));
  assert.ok(q.modules.every((m) => m.rot === 90));
});

test('barra de estado: cantidad y medida total de la selección', () => {
  const p = proj([mod('a', 0), mod('b', 600)]);
  assert.match(describeMulti(p, ['a', 'b']), /^2 módulos seleccionados · 1200 × \d+ × 560$/);
  assert.equal(describeMulti(p, ['a']), '');
});
