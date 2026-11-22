import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRoom } from '../src/domain/room.js';
import { MODULE_TYPES } from '../src/domain/modules.js';
import { overlaps, modulePoly, collideMove, hits, obstaclesFor } from '../src/domain/collision.js';

const room = () => normalizeRoom({ w: 3600, d: 3000, openings: [] });
const mod = (id, x, z, extra = {}) => ({ id, type: 'bajo', params: { ...MODULE_TYPES.bajo.defaults }, x, z, y: 0, rot: 0, ...extra }); // 600 × 560

test('polígonos que se tocan no chocan; superpuestos sí', () => {
  const a = [[0, 0], [100, 0], [100, 100], [0, 100]];
  assert.equal(overlaps(a, [[100, 0], [200, 0], [200, 100], [100, 100]]), false);
  assert.equal(overlaps(a, [[90, 0], [200, 0], [200, 100], [90, 100]]), true);
  assert.equal(overlaps(a, [[150, 150], [250, 150], [250, 250], [150, 250]]), false);
});

test('el rectángulo del módulo sigue a la rotación', () => {
  const p = modulePoly(mod('a', 0, 0, { rot: 90 })); // girado: ocupa 560 × 600
  const xs = p.map((v) => v[0]), zs = p.map((v) => v[1]);
  assert.deepEqual([Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)].map(Math.round), [0, 560, 0, 600]);
});

test('arrastrar contra la pared derecha frena en la cara interior', () => {
  const r = room();
  const a = mod('a', 2000, 0);
  assert.deepEqual(collideMove(a, 5000, 0, r, [a]), { x: 3000, z: 0 });
});

test('no atraviesa la pared aunque el salto sea grande', () => {
  const r = room();
  const a = mod('a', 1000, 1000);
  assert.deepEqual(collideMove(a, 1000, -60000, r, [a]), { x: 1000, z: 0 });
});

test('se desliza a lo largo de la pared: frena en z y sigue en x', () => {
  const r = room();
  const a = mod('a', 1000, 200);
  assert.deepEqual(collideMove(a, 1500, -300, r, [a]), { x: 1500, z: 0 });
});

test('frena contra otro módulo a la misma altura', () => {
  const r = room();
  const a = mod('a', 0, 0), b = mod('b', 1500, 0);
  assert.deepEqual(collideMove(a, 1400, 0, r, [a, b]), { x: 900, z: 0 });
});

test('un módulo a otra altura no estorba (alacena sobre bajo)', () => {
  const r = room();
  const a = mod('a', 0, 0), alto = { ...mod('b', 1500, 0), y: 1450 };
  assert.deepEqual(collideMove(a, 1400, 0, r, [a, alto]), { x: 1400, z: 0 });
});

test('frena contra una columna', () => {
  const r = { ...room(), columns: [{ id: 'c', x: 2000, z: 0, w: 300, d: 300 }] };
  const a = mod('a', 0, 0);
  assert.deepEqual(collideMove(a, 1800, 0, r, [a]), { x: 1400, z: 0 });
});

test('lo que ya estaba encimado al empezar no lo traba', () => {
  const r = room();
  const a = mod('a', 0, 0), b = mod('b', 300, 0); // encimados
  assert.equal(hits(a, obstaclesFor(a, r, [a, b]).filter((o) => o.id === 'b')), true);
  assert.deepEqual(collideMove(a, 0, 1000, r, [a, b]), { x: 0, z: 1000 });
});
