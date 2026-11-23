import { test } from 'node:test';
import assert from 'node:assert/strict';
import { floorGridOf, fitFloor, standardFloor, setFloorShape, setFloorGrid, snapToFloorGrid, addFloorVertex, removeFloorVertex } from '../src/domain/floor.js';
import { floorPolygon } from '../src/domain/walls.js';
import { emptyProject } from '../src/domain/project.js';

const room = emptyProject().room;

test('piso padrón 5000 × 5000 y volver a ajustar los límites a las paredes', () => {
  const auto = floorPolygon(room);
  const std = standardFloor(room);
  assert.deepEqual(floorPolygon(std), [[0, 0], [5000, 0], [5000, 5000], [0, 5000]]);
  assert.deepEqual(floorPolygon(fitFloor(std)), auto);
});

test('forma propia del piso: vértices (agregar en un lado, quitar con mínimo 3)', () => {
  const pts = [[0, 0], [1000, 0], [1000, 1000], [0, 1000]];
  const r = setFloorShape(room, addFloorVertex(pts, 0));
  assert.deepEqual(floorPolygon(r)[1], [500, 0]);
  assert.equal(removeFloorVertex(pts, 0).length, 3);
  assert.equal(removeFloorVertex(pts.slice(0, 3), 0).length, 3);
  assert.equal(setFloorShape(room, [[0, 0]]), room);
});

test('grilla del piso: valores por defecto y cambios', () => {
  assert.deepEqual(floorGridOf(room), { show: false, attract: false, gap: 50, ix: 600, iz: 600 });
  assert.equal(floorGridOf(setFloorGrid(room, { attract: true, ix: 400 })).ix, 400);
});

test('atraer: un borde a menos del gap se pega a la línea; lejos, no', () => {
  const g = { attract: true, gap: 50, ix: 600, iz: 600 };
  assert.deepEqual(snapToFloorGrid(620, 1180, 600, 560, g), { x: 600, z: 1200 });
  assert.deepEqual(snapToFloorGrid(700, 900, 600, 560, g), { x: 700, z: 900 });
  assert.deepEqual(snapToFloorGrid(620, 1180, 600, 560, { ...g, attract: false }), { x: 620, z: 1180 });
});
