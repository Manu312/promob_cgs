import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lightOf, lightsOf, spotCone } from '../src/domain/lights.js';
import { MODULE_TYPES } from '../src/domain/modules.js';

const mod = (type, extra = {}, params = {}) => ({ id: type, type, params: { ...MODULE_TYPES[type].defaults, ...params }, x: 1000, z: 0, y: MODULE_TYPES[type].y, rot: 0, ...extra });

test('luminarias: cada una da su luz en el lugar correcto', () => {
  const s = lightOf(mod('spot_embutido'));
  assert.equal(s.kind, 'spot');
  assert.deepEqual(s.dir.map((v) => Math.round(v * 1000) / 1000), [0, -1, 0], 'apunta para abajo');
  const c = lightOf(mod('lampara_colgante'));
  assert.equal(c.kind, 'ambiente');
  assert.ok(c.pos[1] < mod('lampara_colgante').y + MODULE_TYPES.lampara_colgante.defaults.height);
  const l = lightOf(mod('tira_led', {}, { width: 1200 }));
  assert.deepEqual([l.kind, l.length], ['lineal', 1200]);
  assert.equal(lightOf({ type: 'bajo', params: {} }), null);
});

test('inclinación: el spot apunta hacia el frente del módulo', () => {
  const s = lightOf(mod('spot_embutido', {}, { tilt: 90 }));
  assert.ok(Math.abs(s.dir[2] - 1) < 1e-9 && Math.abs(s.dir[1]) < 1e-9);
  const r = lightOf(mod('spot_embutido', { rot: 90 }, { tilt: 90 }));
  assert.ok(Math.abs(r.dir[0] - 1) < 1e-9, 'girado, el frente es +x');
});

test('intensidad entre 0 y 2; el falloff nunca es menor que la apertura', () => {
  const s = lightOf(mod('spot_embutido', {}, { lightI: 5, beam: 60, falloff: 30 }));
  assert.equal(s.intensity, 2);
  assert.equal(s.falloff, 60);
  const c = spotCone(40, 80);
  assert.ok(Math.abs(c.angle - (40 * Math.PI) / 180) < 1e-9 && Math.abs(c.penumbra - 0.5) < 1e-9);
});

test('las ocultas no iluminan', () => {
  assert.equal(lightsOf({ modules: [mod('spot_embutido', { hidden: true }), mod('lampara_colgante')] }).length, 1);
});
