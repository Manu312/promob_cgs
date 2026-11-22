import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MODULE_TYPES, PARAM_DEFS, resizeModule, footprint } from '../src/domain/modules.js';

const bajo = (x, z, rot = 0) => ({ id: 'a', type: 'bajo', params: { ...MODULE_TYPES.bajo.defaults }, x, z, y: 0, rot }); // 600 × 870 × 560
const pick = (m) => ({ w: m.params.width, d: m.params.depth, h: m.params.height, x: m.x, z: m.z });

test('flecha derecha: más ancho, el lado izquierdo queda fijo', () => {
  assert.deepEqual(pick(resizeModule(bajo(0, 0), 'right', 200)), { w: 800, d: 560, h: 870, x: 0, z: 0 });
});

test('flecha izquierda: más ancho, el lado derecho queda fijo', () => {
  assert.deepEqual(pick(resizeModule(bajo(0, 0), 'left', 100)), { w: 700, d: 560, h: 870, x: -100, z: 0 });
  assert.deepEqual(pick(resizeModule(bajo(500, 0), 'left', -100)), { w: 500, d: 560, h: 870, x: 600, z: 0 });
});

test('flecha del frente: más profundo, el fondo (contra la pared) queda fijo', () => {
  assert.deepEqual(pick(resizeModule(bajo(0, 0), 'front', 40)), { w: 600, d: 600, h: 870, x: 0, z: 0 });
});

test('flecha de arriba: más alto, sin moverse', () => {
  assert.deepEqual(pick(resizeModule(bajo(300, 200), 'top', 100)), { w: 600, d: 560, h: 970, x: 300, z: 200 });
});

test('módulo rotado 90°: la flecha derecha estira hacia −z y queda fijo el lado de +z', () => {
  const m0 = bajo(0, 1000, 90); // huella 560 × 600, de z 1000 a 1600
  const m = resizeModule(m0, 'right', 200);
  assert.deepEqual(pick(m), { w: 800, d: 560, h: 870, x: 0, z: 800 });
  assert.equal(m.z + footprint(m).fd, 1600);
});

test('módulo rotado 180°: el frente mira a −z y el fondo (+z) queda fijo', () => {
  const m = resizeModule(bajo(0, 1000, 180), 'front', 100);
  assert.deepEqual(pick(m), { w: 600, d: 660, h: 870, x: 0, z: 900 });
});

test('respeta mínimos y máximos de cada medida', () => {
  const small = resizeModule(bajo(0, 0), 'left', -1000);
  assert.equal(small.params.width, PARAM_DEFS.width.min);
  assert.equal(small.x + small.params.width, 600, 'el lado derecho sigue fijo al topar el mínimo');
  assert.equal(resizeModule(bajo(0, 0), 'top', 99999).params.height, PARAM_DEFS.height.max);
});

test('delta 0 devuelve el mismo módulo', () => {
  const m = bajo(0, 0);
  assert.equal(resizeModule(m, 'right', 0), m);
});
