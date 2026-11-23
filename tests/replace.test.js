import { test } from 'node:test';
import assert from 'node:assert/strict';
import { replaceModule, findItemForModule } from '../src/domain/replace.js';
import { withItem, flatItems } from '../src/domain/library.js';

test('sustituir: el nuevo queda en el lugar del viejo, con sus materiales y grupo', () => {
  const old = { id: 'a', type: 'bajo', params: { width: 600 }, x: 100, z: 50, y: 0, rot: 90, mats: { puertas: 'roble' }, groupId: 'g1' };
  const fresh = { id: 'tmp', type: 'bajo_cajones', params: { width: 450 }, x: 0, z: 0, y: 0, rot: 0, mats: {}, aggs: { base: { on: true } } };
  const r = replaceModule(old, fresh);
  assert.deepEqual([r.id, r.type, r.params.width, r.x, r.z, r.rot, r.mats.puertas, r.groupId], ['a', 'bajo_cajones', 450, 100, 50, 90, 'roble', 'g1']);
  assert.deepEqual(r.aggs, { base: { on: true } });
});

test('ubicar en el catálogo: por el ítem del que salió; si no se sabe, por tipo', () => {
  const it = flatItems().find((x) => x.item.type === 'alacena');
  const m = withItem({ id: 'm', type: 'alacena', params: { width: 9999 }, x: 0, z: 0 }, it.item, []);
  assert.equal(m.itemId, it.item.id);
  assert.equal(findItemForModule(m).item.id, it.item.id);
  const viejo = { id: 'v', type: 'alacena', params: { width: 12345 } };
  assert.equal(findItemForModule(viejo).item.type, 'alacena');
  assert.equal(findItemForModule({ type: 'no_existe', params: {} }), null);
});
