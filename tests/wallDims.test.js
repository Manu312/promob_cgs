import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRoom } from '../src/domain/room.js';
import { wallDims } from '../src/domain/dimensions.js';

const r1 = (v) => Math.round(v * 10) / 10 + 0;

test('rectángulo: cota lineal por pared (largo interior) y 90° en las 4 esquinas', () => {
  const d = wallDims(normalizeRoom({ w: 3600, d: 3000, t: 150 }));
  assert.deepEqual(d.linear.map((l) => l.len), [3600, 3000, 3600, 3000]);
  assert.deepEqual(d.angular.map((a) => a.deg), [90, 90, 90, 90]);
});

test('en L aparece 270° en la esquina entrante, con la etiqueta del lado interior', () => {
  const d = wallDims(normalizeRoom({ shape: 'L', w: 4000, d: 3000, cutW: 1200, cutD: 1000 }));
  const reflex = d.angular.find((a) => a.deg === 270);
  assert.ok(reflex);
  assert.deepEqual(reflex.at, [2800, 2000]);
  assert.ok(reflex.label[0] < 2800 && reflex.label[1] < 2000, 'hacia adentro del ambiente, no hacia el recorte');
  assert.equal(d.angular.filter((a) => a.deg === 90).length, 5);
});

test('ambiente abierto de 2 paredes: 2 lineales y 1 angular', () => {
  const d = wallDims(normalizeRoom({
    version: 2,
    nodes: [{ id: 'A', x: 0, z: 3000 }, { id: 'B', x: 0, z: 0 }, { id: 'C', x: 3600, z: 0 }],
    walls: [{ id: 'w1', n0: 'A', n1: 'B', t: 150, h0: 2600, h1: 2600 }, { id: 'w2', n0: 'B', n1: 'C', t: 150, h0: 2600, h1: 2600 }],
  }));
  assert.equal(d.linear.length, 2);
  assert.equal(d.angular.length, 1);
  assert.equal(d.angular[0].wallId, 'w2', 'editar el ángulo gira la pared que sale de la esquina');
});

test('ángulo de 135° y tramos alineados (180°) sin cota', () => {
  const d = wallDims(normalizeRoom({
    version: 2,
    nodes: [{ id: 'A', x: 0, z: 0 }, { id: 'B', x: 1000, z: 0 }, { id: 'C', x: 2000, z: 0 }, { id: 'D', x: 2000 + 707.107, z: 707.107 }],
    walls: ['AB', 'BC', 'CD'].map(([a, b]) => ({ id: a + b, n0: a, n1: b, t: 150, h0: 2600, h1: 2600 })),
  }));
  assert.deepEqual(d.angular.map((a) => a.deg), [135]);
});

test('el arco va del lado interior: empieza en la pared que llega y termina en la que sale', () => {
  const d = wallDims(normalizeRoom({ w: 3600, d: 3000 }));
  const c = d.angular.find((a) => a.at[0] === 0 && a.at[1] === 0); // esquina (0,0): llega la pared izquierda, sale la del fondo
  const first = c.arc[0], last = c.arc.at(-1);
  assert.deepEqual([r1(first[0]), r1(first[1])], [0, 250]);
  assert.deepEqual([r1(last[0]), r1(last[1])], [250, 0]);
});
