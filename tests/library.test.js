import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MODULE_TYPES } from '../src/domain/modules.js';
import { LIBRARY, flatItems, findItem, itemParams, resolvePath, mostUsed, paginate, itemSize } from '../src/domain/library.js';

test('la biblioteca tiene 3 niveles y cada ítem es un tipo de módulo existente', () => {
  const all = flatItems();
  assert.ok(all.length >= Object.keys(MODULE_TYPES).length);
  for (const { item, path } of all) {
    assert.ok(MODULE_TYPES[item.type], item.type);
    assert.equal(path.length, 3);
  }
  assert.equal(new Set(all.map((e) => e.item.id)).size, all.length, 'ids únicos');
});

test('todos los tipos de módulo están en el catálogo', () => {
  const types = new Set(flatItems().map((e) => e.item.type));
  for (const t of Object.keys(MODULE_TYPES)) assert.ok(types.has(t), t);
});

test('ruta parcial: completa con la primera familia y subfamilia', () => {
  assert.deepEqual(resolvePath(['dormitorios']).path, ['dormitorios', 'placares', 'batientes']);
  assert.deepEqual(resolvePath([]).path.slice(0, 1), [LIBRARY[0].id]);
  assert.deepEqual(resolvePath(['cocinas', 'nada']).path, ['cocinas', 'inferiores', 'puertas']);
});

test('medidas del ítem: tipo + propias + variante', () => {
  const item = { id: 'x', type: 'bajo', params: { width: 450 }, variants: { param: 'width', values: [300, 450, 600] } };
  assert.equal(itemParams(item).width, 450);
  assert.equal(itemParams(item, 300).width, 300);
  assert.equal(itemParams(item).height, MODULE_TYPES.bajo.defaults.height);
  assert.equal(itemSize(item, 600), `600×${MODULE_TYPES.bajo.defaults.height}×${MODULE_TYPES.bajo.defaults.depth}`);
  assert.equal(findItem('coc-inf-2p').path[0], 'cocinas');
});

test('Más usados: ordenados por uso, sin los no usados', () => {
  assert.deepEqual(mostUsed({ 'coc-alt-2p': 3, 'coc-inf-2p': 5, 'ofi-esc': 0 }).map((i) => i.id), ['coc-inf-2p', 'coc-alt-2p']);
  assert.deepEqual(mostUsed({}), []);
});

test('paginado', () => {
  const xs = [1, 2, 3, 4, 5, 6, 7];
  assert.deepEqual(paginate(xs, 1, 3), { page: 1, pages: 3, items: [4, 5, 6] });
  assert.deepEqual(paginate(xs, 9, 3).items, [7]);
  assert.deepEqual(paginate([], 0, 3), { page: 0, pages: 1, items: [] });
});

// Variantes de medida (#57)
import { PARAM_DEFS } from '../src/domain/modules.js';
import { variantValues } from '../src/domain/library.js';

test('variantes: dentro del rango de cada medida e incluyen la medida del ítem', () => {
  for (const { item } of flatItems()) {
    if (!item.variants) continue;
    const def = PARAM_DEFS[item.variants.param];
    const vs = variantValues(item);
    assert.ok(vs.includes(itemParams(item)[item.variants.param]), item.id);
    for (const v of vs) assert.ok(v >= def.min && v <= def.max, `${item.id} ${v}`);
    assert.deepEqual(vs, [...vs].sort((a, b) => a - b));
  }
  assert.deepEqual(variantValues({ id: 'x', type: 'bajo' }), []);
});

// Localizar Rápido (#59)
import { searchLibrary } from '../src/domain/library.js';

test('Localizar: sin acentos ni mayúsculas, agrupado por ruta', () => {
  const r = searchLibrary('BANO');
  assert.ok(r.length >= 1);
  assert.ok(r.every((g) => g.key.startsWith('Baños\\')));
  const caj = searchLibrary('cajon');
  assert.ok(caj.some((g) => g.items.some((i) => i.id === 'coc-inf-caj')));
  assert.ok(caj.some((g) => g.key === 'Dormitorios\\Componentes\\Cajoneras\\'));
});

test('Localizar: todas las palabras y también por medida', () => {
  assert.deepEqual(searchLibrary('alacena 1 puerta').flatMap((g) => g.items.map((i) => i.id)), ['coc-alt-1p']);
  assert.ok(searchLibrary('450').flatMap((g) => g.items).length > 0);
  assert.deepEqual(searchLibrary('   '), []);
  assert.deepEqual(searchLibrary('heladera xyz'), []);
});
