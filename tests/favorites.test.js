import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeFavorite, placeFavorite, favoriteItem, favoriteGroups, exportFavorites, importFavorites, removeFavorite, updateFavorite } from '../src/domain/favorites.js';
import { rotateGroup } from '../src/domain/multiSelect.js';
import { MODULE_TYPES } from '../src/domain/modules.js';

const mod = (id, type, x, extra = {}) => ({ id, type, params: { ...MODULE_TYPES[type].defaults }, x, z: 0, y: MODULE_TYPES[type].y, rot: 0, mats: { frente: 'blanco' }, ...extra });
let n = 0;
const nid = () => `n${n++}`;

test('guardar: relativo al primero, sin ids ni grupo; nombre y textos recortados', () => {
  const f = makeFavorite([mod('a', 'bajo', 1000, { groupId: 'g1' }), mod('b', 'alacena', 1000)], { name: '  Cocina chica ', group: 'Cocinas' }, 'f1');
  assert.deepEqual([f.name, f.group, f.modules.length], ['Cocina chica', 'Cocinas', 2]);
  assert.equal(f.modules[0].x, 0);
  assert.equal(f.modules[1].y, MODULE_TYPES.alacena.y - MODULE_TYPES.bajo.y);
  assert.ok(!('id' in f.modules[0]) && !('groupId' in f.modules[0]));
  assert.equal(f.modules[0].mats.frente, 'blanco');
  assert.equal(makeFavorite([]), null);
});

test('insertar: el primero va a la pose; el conjunto queda agrupado y gira como rotateGroup', () => {
  const mods = [mod('a', 'bajo', 0), mod('b', 'bajo', 600)];
  const f = makeFavorite(mods, { name: 'Dos' }, 'f2');
  const out = placeFavorite(f, { x: 2000, z: 500, y: 0, rot: 0 }, nid);
  assert.deepEqual(out.map((m) => [m.x, m.z]), [[2000, 500], [2600, 500]]);
  assert.ok(out[0].groupId && out[0].groupId === out[1].groupId);
  assert.notEqual(out[0].id, out[1].id);
  const rot = placeFavorite(f, { x: 0, z: 0, y: 0, rot: 90 }, nid);
  const ref = rotateGroup({ modules: mods }, ['a', 'b'], 90).modules;
  // misma posición relativa que girar el conjunto alrededor de su centro
  assert.deepEqual([rot[1].x - rot[0].x, rot[1].z - rot[0].z], [ref[1].x - ref[0].x, ref[1].z - ref[0].z]);
  assert.equal(rot[1].rot, 90);
  assert.equal(placeFavorite(makeFavorite([mods[0]], {}, 'f3'), { x: 0, z: 0 }, nid)[0].groupId, undefined);
});

test('ítem de la barra, grupos, editar y quitar', () => {
  const f = makeFavorite([mod('a', 'bajo', 0)], { name: 'Bajo', group: '' }, 'f4');
  const it = favoriteItem(f);
  assert.deepEqual([it.id, it.type, it.favorite.id], ['fav:f4', 'bajo', 'f4']);
  assert.deepEqual(favoriteGroups([f, { ...f, id: 'x', group: 'Baños' }]), ['General', 'Baños']);
  assert.equal(updateFavorite([f], 'f4', { name: 'Otro' })[0].name, 'Otro');
  assert.equal(removeFavorite([f], 'f4').length, 0);
});

test('exportar e importar: valida tipos y descarta imágenes que no sean data URL', () => {
  const f = makeFavorite([mod('a', 'bajo', 0)], { name: 'Bajo', image: 'data:image/png;base64,AAAA' }, 'f5');
  assert.equal(f.image, 'data:image/png;base64,AAAA');
  const r = importFavorites(exportFavorites([f]), [{ ...f, name: 'viejo' }]);
  assert.deepEqual([r.added, r.list.length, r.list[0].name], [1, 1, 'Bajo']);
  const evil = JSON.parse(exportFavorites([f]));
  evil.favorites[0].image = 'https://evil.example/x.png';
  evil.favorites.push({ id: 'bad', modules: [{ type: 'nope', params: {}, x: 0, z: 0 }] });
  const r2 = importFavorites(JSON.stringify(evil));
  assert.deepEqual([r2.list.length, r2.list[0].image], [1, null]);
  assert.ok(importFavorites('nope').error);
  assert.ok(importFavorites('{"format":"otro"}').error);
  assert.equal(makeFavorite([mod('a', 'bajo', 0)], { image: 'javascript:alert(1)' }).image, null);
});
