import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MODULE_TYPES, buildModule, DEFAULT_RULES, RULE_DEFS } from '../src/domain/modules.js';
import { flatItems } from '../src/domain/library.js';
import { frontsOf } from '../src/domain/fronts.js';

const ctx = { t: 18, tf: 18, tb: 3 };
const mod = (type, params = {}) => ({ id: 'm', type, params: { ...MODULE_TYPES[type].defaults, ...params } });
const topOfFronts = (b) => Math.max(...b.parts.filter((p) => p.front != null && (p.name === 'Puerta' || p.name === 'Frente cajón')).map((p) => p.y + p.sy));

test('gola arriba: los frentes bajan el alto del perfil y no hay tiradores', () => {
  const sin = buildModule(mod('bajo', { gola: 'no' }), ctx);
  const con = buildModule(mod('bajo', { gola: 'superior' }), ctx);
  assert.equal(Math.round(topOfFronts(sin) - topOfFronts(con)), DEFAULT_RULES.golaH);
  assert.equal(con.decors.filter((d) => d.decor === 'manija').length, 0);
  assert.ok(con.decors.some((d) => d.decor === 'aparato' && d.finish === 'inox'), 'perfil de aluminio');
  assert.ok(con.parts.some((p) => p.name === 'Lateral (rebaje gola)'));
  assert.ok(con.hardware.perfil_gola > 0);
});

test('gola entre cajones: un perfil por cada separación, alto del perfil configurable', () => {
  const b = buildModule(mod('bajo_cajones', { gola: 'superior_medio' }), { ...ctx, rules: { golaH: 50 } });
  const ds = b.parts.filter((p) => p.name === 'Frente cajón').sort((a, c) => c.y - a.y);
  assert.equal(Math.round(ds[0].y - (ds[1].y + ds[1].sy)), 50);
  assert.equal(b.decors.filter((d) => d.decor === 'aparato').length, 2 * 3, '3 perfiles (arriba + 2 separaciones), 2 piezas cada uno');
  assert.ok(RULE_DEFS.golaH && RULE_DEFS.golaD);
});

test('alacena con gola abajo; los frentes siguen abriendo', () => {
  const b = buildModule(mod('alacena', { gola: 'inferior' }), ctx);
  const minY = Math.min(...b.parts.filter((p) => p.name === 'Puerta').map((p) => p.y));
  assert.ok(minY >= DEFAULT_RULES.golaH);
  assert.ok(frontsOf(b).length > 0);
});

test('biblioteca Cocina Gola con inferiores y altos', () => {
  const gola = flatItems().filter((x) => x.path[0] === 'cocina-gola');
  assert.ok(gola.length >= 6);
  assert.ok(gola.every((x) => x.item.params.gola && x.item.params.gola !== 'no'));
});
