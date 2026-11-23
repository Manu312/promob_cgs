import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MODULE_TYPES, buildModule } from '../src/domain/modules.js';
import { flatItems, LIBRARY } from '../src/domain/library.js';

const ctx = { t: 18, tf: 18, tb: 3 };
const mod = (type, params = {}) => ({ id: 'm', type, params: { ...MODULE_TYPES[type].defaults, ...params } });

test('biblioteca Salas: racks, bibliotecas, aparadores y paneles de TV', () => {
  const salas = LIBRARY.find((l) => l.id === 'salas');
  assert.deepEqual(salas.groups.map((g) => g.label), ['Racks', 'Bibliotecas', 'Aparadores', 'Paneles']);
  for (const t of ['rack_tv', 'aparador', 'vajillero', 'panel_tv']) assert.ok(buildModule(mod(t), ctx).parts.length > 0, t);
});

test('Cocinas suma Puertas/Frentes, Puertas Extras, Cajas y Composición', () => {
  const coc = LIBRARY.find((l) => l.id === 'cocinas');
  for (const g of ['Puertas/Frentes', 'Puertas Extras', 'Cajas', 'Composición']) assert.ok(coc.groups.some((x) => x.label === g), g);
});

test('frente suelto: una sola placa del tamaño pedido, del espesor del frente', () => {
  const b = buildModule(mod('panel', { width: 450, height: 720 }), ctx);
  assert.deepEqual(b.parts.map((p) => [p.name, p.sx, p.sy, p.sz]), [['Panel', 450, 720, 18]]);
});

test('caja sin frentes: sin puertas ni cajones', () => {
  const it = flatItems().find((x) => x.item.id === 'coc-caja-bajo').item;
  const b = buildModule(mod(it.type, it.params), ctx);
  assert.equal(b.parts.filter((p) => p.name === 'Puerta' || p.name === 'Frente cajón').length, 0);
});

test('composición: lista de módulos con su corrimiento', () => {
  const it = flatItems().find((x) => x.item.id === 'coc-comp-lineal').item;
  assert.equal(it.compose.length, 6);
  assert.ok(it.compose.every((c) => MODULE_TYPES[c.type]));
});
