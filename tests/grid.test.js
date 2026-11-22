import { test } from 'node:test';
import assert from 'node:assert/strict';
import { snapPosition } from '../src/domain/modules.js';
import { normalizeRoom } from '../src/domain/room.js';
import { gridLines, planFitZoom } from '../src/domain/grid.js';

const room = normalizeRoom({ w: 4000, d: 3000 });
const mod = (x, z) => ({ params: { width: 600, depth: 560 }, x, z, rot: 0 });

test('sin imán cercano, el paso por defecto redondea a 10 mm', () => {
  assert.deepEqual(snapPosition(mod(1523, 1187), [], room), { x: 1520, z: 1190 });
});

test('con grilla magnética de 50 mm, la posición queda en múltiplos de 50', () => {
  assert.deepEqual(snapPosition(mod(1523, 1187), [], room, 40, 50), { x: 1500, z: 1200 });
  assert.deepEqual(snapPosition(mod(1576, 1226), [], room, 40, 50), { x: 1600, z: 1250 });
});

test('el imán a paredes gana sobre la grilla', () => {
  // pared del fondo en z = 0; 23 mm está dentro del umbral (40)
  assert.equal(snapPosition(mod(1523, 23), [], room, 40, 250).z, 0);
});

test('gridLines: líneas en múltiplos del paso, cubriendo el ambiente con margen', () => {
  const g = gridLines({ minX: 0, minZ: 0, maxX: 1000, maxZ: 500 }, 250, 500);
  assert.deepEqual(g.xs.map((l) => l.v), [-500, -250, 0, 250, 500, 750, 1000, 1250, 1500]);
  assert.deepEqual(g.zs.map((l) => l.v), [-500, -250, 0, 250, 500, 750, 1000]);
  assert.deepEqual(g.xs.filter((l) => l.major).map((l) => l.v), [0, 1000], 'línea mayor cada 1000 mm');
  assert.deepEqual(g.range, { x0: -500, x1: 1500, z0: -500, z1: 1000 });
});

test('gridLines alinea a múltiplos del paso aunque el ambiente no lo esté', () => {
  const g = gridLines({ minX: 30, minZ: 0, maxX: 1830, maxZ: 100 }, 50, 0);
  assert.equal(g.xs[0].v, 0);
  assert.equal(g.xs.at(-1).v, 1850);
  assert.ok(g.xs.every((l) => l.v % 50 === 0));
});

test('gridLines limita la cantidad de líneas agrandando el paso visible', () => {
  const g = gridLines({ minX: 0, minZ: 0, maxX: 20000, maxZ: 20000 }, 10, 0, 400);
  assert.ok(g.xs.length <= 401, `${g.xs.length} líneas`);
  assert.ok(g.xs.every((l) => l.v % 10 === 0));
});

test('planFitZoom: entra el ambiente completo con margen en el visor', () => {
  // 4000 × 3000 mm en un visor de 900 × 600 px con 1 m de margen total → limita el alto
  const z = planFitZoom({ minX: 0, minZ: 0, maxX: 4000, maxZ: 3000 }, 900, 600);
  assert.equal(z, 150); // 600 px / (3 m + 1 m)
});
