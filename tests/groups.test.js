import { test } from 'node:test';
import assert from 'node:assert/strict';
import { expandToGroups, groupModules, ungroupModules, selectionGroup, pruneGroups } from '../src/domain/groups.js';

const m = (id, groupId) => ({ id, type: 'bajo', params: { width: 600, height: 870, depth: 560 }, x: 0, z: 0, ...(groupId ? { groupId } : {}) });
const proj = (...mods) => ({ modules: mods });

test('agrupar: los seleccionados quedan en un grupo; con uno solo no hay grupo', () => {
  const p = groupModules(proj(m('a'), m('b'), m('c')), ['a', 'b'], 'g1');
  assert.deepEqual(p.modules.map((x) => x.groupId), ['g1', 'g1', undefined]);
  assert.equal(groupModules(proj(m('a')), ['a'], 'g1').modules[0].groupId, undefined);
});

test('clic en un integrante selecciona todo el grupo', () => {
  const p = proj(m('a', 'g1'), m('b', 'g1'), m('c'));
  assert.deepEqual(expandToGroups(p, ['a']), ['a', 'b']);
  assert.deepEqual(expandToGroups(p, ['c']), ['c']);
  assert.equal(selectionGroup(p, ['a', 'b']), 'g1');
  assert.equal(selectionGroup(p, ['a']), null);
});

test('agrupar un grupo con otro módulo los une en uno nuevo', () => {
  const p = groupModules(proj(m('a', 'g1'), m('b', 'g1'), m('c')), ['a', 'c'], 'g2');
  assert.deepEqual(p.modules.map((x) => x.groupId), ['g2', 'g2', 'g2']);
});

test('desagrupar: los integrantes vuelven a ser sueltos', () => {
  const p = ungroupModules(proj(m('a', 'g1'), m('b', 'g1'), m('c', 'g2'), m('d', 'g2')), ['a']);
  assert.deepEqual(p.modules.map((x) => x.groupId), [undefined, undefined, 'g2', 'g2']);
  assert.ok(!('groupId' in p.modules[0]));
});

test('un grupo que queda con un solo módulo deja de ser grupo', () => {
  const p = pruneGroups(proj(m('a', 'g1'), m('c', 'g2'), m('d', 'g2')));
  assert.deepEqual(p.modules.map((x) => x.groupId), [undefined, 'g2', 'g2']);
});
