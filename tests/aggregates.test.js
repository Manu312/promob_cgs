import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MODULE_TYPES, buildModule, DEFAULT_RULES } from '../src/domain/modules.js';
import { aggState, setAgg, baseOf } from '../src/domain/aggregates.js';

const ctx = { t: 18, tf: 18, tb: 3 };
const mod = (type = 'bajo', extra = {}) => ({ id: 'm', type, params: { ...MODULE_TYPES[type].defaults }, ...extra });
const names = (m, rules = DEFAULT_RULES) => buildModule(m, { ...ctx, rules }).parts.map((p) => p.name);

test('sin tocar Agregados, la base sale de la regla del proyecto', () => {
  assert.deepEqual(baseOf(mod(), { base: 'patas_zocalo' }), { pies: true, zocalo: true, zocalo_tras: false, ruedas: false });
  assert.deepEqual(baseOf(mod(), { base: 'zocalo' }), { pies: false, zocalo: true, zocalo_tras: true, ruedas: false });
  const st = aggState(mod(), DEFAULT_RULES);
  assert.equal(st.pies.on, true);
  assert.equal(st.fondo.on, true);
});

test('agregados de base: ruedas y zócalo trasero en vez de pies', () => {
  let m = mod();
  m = setAgg(m, DEFAULT_RULES, 'pies', false);
  m = setAgg(m, DEFAULT_RULES, 'ruedas', true);
  m = setAgg(m, DEFAULT_RULES, 'zocalo_tras', true);
  assert.deepEqual(baseOf(m, DEFAULT_RULES), { pies: false, zocalo: true, zocalo_tras: true, ruedas: true });
  const b = buildModule(m, { ...ctx, rules: DEFAULT_RULES });
  assert.equal(b.hardware.pata, undefined);
  assert.equal(b.hardware.rueda, 4);
  assert.ok(b.parts.some((p) => p.name === 'Zócalo trasero'));
  assert.equal(b.decors.filter((d) => d.decor === 'rueda').length, 4);
});

test('sin ningún agregado de base el cuerpo llega al piso', () => {
  let m = mod();
  for (const id of ['pies', 'zocalo']) m = setAgg(m, DEFAULT_RULES, id, false);
  const b = buildModule(m, { ...ctx, rules: DEFAULT_RULES });
  assert.ok(!b.parts.some((p) => p.name.startsWith('Zócalo')));
  assert.equal(b.parts.find((p) => p.name === 'Lateral').y, 0);
});

test('fondo, estantes, divisiones y barral', () => {
  let m = setAgg(mod('placard_bat'), DEFAULT_RULES, 'fondo', false);
  assert.ok(!names(m).includes('Fondo'));
  assert.ok(names(setAgg(m, DEFAULT_RULES, 'fondo', true)).includes('Fondo'));
  m = setAgg(mod('bajo'), DEFAULT_RULES, 'estantes', true, 3);
  assert.equal(m.params.shelves, 3);
  assert.equal(aggState(m).estantes.qty, 3);
  assert.equal(setAgg(m, DEFAULT_RULES, 'estantes', false).params.shelves, 0);
  m = setAgg(mod('placard_bat'), DEFAULT_RULES, 'divisiones', true, 1);
  assert.equal(m.params.dividers, 2);
  assert.equal(setAgg(m, DEFAULT_RULES, 'barral', true).params.interior, 'mixto');
  assert.equal(setAgg(mod('columna'), DEFAULT_RULES, 'barral', true).params.interior, 'barral');
});

// Agregados de terminación (#82)
test('tapa, cierre, marco, cornisa y vistas suman piezas que van al despiece', () => {
  let m = mod('alacena');
  for (const id of ['tapa', 'marco', 'cornisa']) m = setAgg(m, DEFAULT_RULES, id, true);
  m = setAgg(m, DEFAULT_RULES, 'vistas', true, 'izq');
  const b = buildModule(m, { ...ctx, rules: DEFAULT_RULES });
  const n = (x) => b.parts.filter((p) => p.name === x);
  const H = MODULE_TYPES.alacena.defaults.height;
  assert.equal(n('Tapa').length, 1);
  assert.equal(n('Marco superior').length, 3);
  assert.equal(n('Cornisa')[0].y, H + 18 + 60, 'cornisa arriba del marco y la tapa');
  assert.deepEqual(n('Vista').map((v) => v.x), [-18]);
  assert.equal(aggState(m).vistas.side, 'izq');
  assert.equal(setAgg(m, DEFAULT_RULES, 'cornisa', false).aggs.cornisa, undefined);
});

test('cajones internos detrás de las puertas, con sus correderas', () => {
  const m = setAgg(mod('bajo'), DEFAULT_RULES, 'cajones_int', true, 2);
  const b = buildModule(m, { ...ctx, rules: DEFAULT_RULES });
  assert.equal(b.parts.filter((p) => p.name === 'Frente cajón interno').length, 2);
  assert.equal(b.hardware.corredera, 2);
  const zDoor = b.parts.find((p) => p.name === 'Puerta').z;
  assert.ok(b.parts.filter((p) => p.name === 'Frente cajón interno').every((p) => p.z + p.sz <= zDoor), 'quedan detrás de la puerta');
});
