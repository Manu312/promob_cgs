import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_MATERIALS, migrateMaterials, libraryTree, pathLabel, matById, mergeSettings } from '../src/domain/catalog.js';

test('biblioteca: placas y piedras con ruta, ids únicos', () => {
  assert.equal(new Set(DEFAULT_MATERIALS.map((m) => m.id)).size, DEFAULT_MATERIALS.length);
  for (const m of DEFAULT_MATERIALS) {
    assert.ok(['placa', 'piedra'].includes(m.kind), m.id);
    assert.ok(m.path.length >= 2, m.id);
    if (m.kind === 'piedra') assert.ok(m.priceM2 > 0 && m.grain && m.pattern, m.id);
    else assert.ok(m.price > 0 && m.t > 0, m.id);
  }
});

test('árbol: Granitos › Gris › Gris Mara y las placas aparte', () => {
  const t = libraryTree(DEFAULT_MATERIALS, 'piedra');
  assert.deepEqual(t.folders.map((f) => f.name), ['Granitos', 'Mármoles', 'Cuarzo']);
  const gris = t.folders[0].folders.find((f) => f.name === 'Gris');
  assert.ok(gris.items.some((m) => m.id === 'gra_gris_mara'));
  const p = libraryTree(DEFAULT_MATERIALS, 'placa');
  assert.deepEqual(p.folders.map((f) => f.name), ['Colores', 'Maderas', 'Fondos']);
  assert.equal(pathLabel(DEFAULT_MATERIALS.find((m) => m.id === 'gra_gris_mara')), 'Granitos > Gris > Gris Mara');
});

test('migración: materiales viejos reciben tipo y ruta, y se suman las piedras', () => {
  const viejos = [
    { id: 'mel18_blanco', name: 'Melamina 18mm Blanco', t: 18, L: 2600, W: 1830, color: '#fff', wood: false, edge: true, price: 1 },
    { id: 'mat_x', name: 'Mi roble', t: 18, color: '#a80', wood: true, price: 2 },
    { id: 'mat_y', name: 'Fibro 5', t: 5, color: '#eee', wood: false, price: 3 },
  ];
  const m = migrateMaterials(viejos);
  assert.deepEqual(m.slice(0, 3).map((x) => [x.kind, pathLabel(x), x.price]), [
    ['placa', 'Colores > Blanco', 1], ['placa', 'Maderas > Mi roble', 2], ['placa', 'Fondos > Fibro 5', 3],
  ]);
  assert.ok(m.some((x) => x.id === 'gra_negro_brasil'));
  assert.equal(migrateMaterials(m).length, m.length, 'idempotente');
});

test('matById nunca devuelve una piedra (las piedras no se cortan)', () => {
  const s = mergeSettings({});
  assert.equal(matById(s, 'gra_gris_mara').kind, 'placa');
  assert.equal(matById(s, 'mel18_roble').id, 'mel18_roble');
});
