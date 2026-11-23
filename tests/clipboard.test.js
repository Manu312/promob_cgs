import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cloneModules, sideOffset, pasteModules } from '../src/domain/clipboard.js';

let n = 0;
const nid = () => `n${++n}`;
const m = (id, x, extra = {}) => ({ id, type: 'bajo', params: { width: 600, height: 870, depth: 560 }, x, z: 0, y: 0, rot: 0, mats: { puertas: 'roble' }, aggs: { base: { on: true } }, ...extra });

test('las copias son independientes: ids nuevos y sin compartir objetos', () => {
  const src = [m('a', 0)];
  const [c] = cloneModules(src, { dx: 600 }, nid);
  assert.notEqual(c.id, 'a');
  assert.equal(c.x, 600);
  c.params.width = 900; c.mats.puertas = 'x'; c.aggs.base.on = false;
  assert.deepEqual([src[0].params.width, src[0].mats.puertas, src[0].aggs.base.on], [600, 'roble', true]);
});

test('copiar un grupo da otro grupo (no se suma al original)', () => {
  const cs = cloneModules([m('a', 0, { groupId: 'g1' }), m('b', 600, { groupId: 'g1' }), m('c', 1200)], {}, nid);
  assert.equal(cs[0].groupId, cs[1].groupId);
  assert.notEqual(cs[0].groupId, 'g1');
  assert.equal(cs[2].groupId, undefined);
});

test('duplicar sin indicar desplazamiento: al lado, a la derecha del conjunto', () => {
  assert.deepEqual(sideOffset([m('a', 0), m('b', 600)]), { dx: 1200, dz: 0, dy: 0 });
});

test('pegar agrega las copias y devuelve sus ids; con altura no baja del piso', () => {
  const p = { modules: [m('a', 0)] };
  const r = pasteModules(p, p.modules, { dx: 0, dz: 700, dy: -50 }, nid);
  assert.equal(r.project.modules.length, 2);
  assert.deepEqual(r.ids, [r.project.modules[1].id]);
  assert.deepEqual([r.project.modules[1].z, r.project.modules[1].y], [700, 0]);
});
