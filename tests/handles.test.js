import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MODULE_TYPES, buildModule } from '../src/domain/modules.js';

const ctx = { t: 18, tf: 18, tb: 3 };
const handles = (type, params = {}) => buildModule({ type, params: { ...MODULE_TYPES[type].defaults, ...params } }, ctx).decors.filter((d) => d.decor === 'manija');
const door = (type, params) => { const b = buildModule({ type, params: { ...MODULE_TYPES[type].defaults, ...params } }, ctx); return [b.parts.find((p) => p.name === 'Puerta'), b.decors.find((d) => d.decor === 'manija')]; };

test('arriba / medio / abajo en una puerta (tirador vertical de 128)', () => {
  for (const [pos, expect] of [['top', (p) => p.y + p.sy - 40 - 128], ['middle', (p) => p.y + p.sy / 2 - 64], ['bottom', (p) => p.y + 40]]) {
    const [p, h] = door('alacena_1p', { handlePos: pos });
    assert.equal(h.y, expect(p), pos);
    assert.equal(h.sy, 128);
  }
});

test('personalizada: a tantos mm del borde de arriba del frente', () => {
  const [p, h] = door('alacena_1p', { handlePos: 'custom', handleOffset: 100 });
  assert.equal(h.y + h.sy, p.y + p.sy - 100);
});

test('orientación horizontal en puertas y vertical en cajones altos', () => {
  const [, h] = door('alacena_1p', { handleOrient: 'horizontal' });
  assert.deepEqual([h.sx, h.sy], [128, 12]);
  const v = handles('bajo_cajones', { handleOrient: 'vertical', drawers: 2 });
  assert.ok(v.every((d) => d.sy === 128 && d.sx === 12));
  const auto = handles('bajo_cajones');
  assert.ok(auto.every((d) => d.sx === 128 && d.sy === 12), 'automática: horizontal en cajones');
});

test('sin tirador no dibuja ni cobra tiradores', () => {
  const b = buildModule({ type: 'bajo', params: { ...MODULE_TYPES.bajo.defaults, handlePos: 'none' } }, ctx);
  assert.equal(b.decors.filter((d) => d.decor === 'manija').length, 0);
  assert.equal(b.hardware.manija, undefined);
});
