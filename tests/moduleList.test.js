import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRoom } from '../src/domain/room.js';
import { MODULE_TYPES } from '../src/domain/modules.js';
import { moduleTree, moduleRowLabel, toggleHidden, removeModules } from '../src/domain/moduleList.js';
import { collideMove } from '../src/domain/collision.js';

const room = normalizeRoom({ w: 3600, d: 3000, openings: [] });
const mod = (id, x, z, extra = {}) => ({ id, type: 'bajo', params: { ...MODULE_TYPES.bajo.defaults }, x, z, y: 0, rot: 0, ...extra });

test('lista por plano de inserción: pared del fondo, pared izquierda y piso', () => {
  const p = { room, modules: [mod('a', 600, 0), mod('b', 0, 1200, { rot: 90 }), mod('c', 1500, 1500)] };
  const t = moduleTree(p);
  assert.deepEqual(t.map((x) => [x.label, x.ids]), [['Pared 1', ['a']], ['Pared 4', ['b']], ['Piso', ['c']]]);
});

test('un módulo en la esquina va en una sola pared', () => {
  const p = { room, modules: [mod('a', 0, 0)] };
  assert.deepEqual(moduleTree(p).flatMap((x) => x.ids), ['a']);
});

test('etiqueta, ocultar y remover', () => {
  const p = { room, modules: [mod('a', 0, 0), mod('b', 600, 0)] };
  assert.equal(moduleRowLabel(p, 'b'), 'M2 · Bajo mesada puertas · 600×870×560');
  const h = toggleHidden(p, ['a']);
  assert.equal(h.modules[0].hidden, true);
  assert.equal(toggleHidden(h, ['a']).modules[0].hidden, false);
  assert.deepEqual(removeModules(p, ['a']).modules.map((m) => m.id), ['b']);
});

test('un módulo oculto no choca', () => {
  const a = mod('a', 0, 0), b = mod('b', 1500, 0, { hidden: true });
  assert.deepEqual(collideMove(a, 1400, 0, room, [a, b]), { x: 1400, z: 0 });
});
