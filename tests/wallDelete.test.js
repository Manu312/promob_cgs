import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRoom, roomWalls } from '../src/domain/room.js';
import { MODULE_TYPES } from '../src/domain/modules.js';
import { deleteWalls, splitWall, modulesOnWall, updateWall } from '../src/domain/wallEdit.js';

const rect = () => normalizeRoom({
  w: 3600, d: 3000,
  openings: [
    { id: 'o1', type: 'ventana', wall: 0, offset: 500, width: 800, height: 1100, sill: 1000 },
    { id: 'o2', type: 'puerta', wall: 0, offset: 2500, width: 600, height: 2000, sill: 0 },
    { id: 'o3', type: 'puerta', wall: 3, offset: 500, width: 800, height: 2000, sill: 0 },
  ],
});
const mod = (id, x, z, rot = 0) => ({ id, type: 'bajo', params: { ...MODULE_TYPES.bajo.defaults }, x, z, y: 0, rot }); // 600 × 560

test('eliminar solo este tramo: quedan 3 paredes, el ambiente se abre y se van sus aberturas', () => {
  const r0 = rect();
  const { room } = deleteWalls(r0, r0.walls[0].id, 'tramo', []);
  assert.equal(room.walls.length, 3);
  assert.equal(room.nodes.length, 4);
  assert.equal(room.points, null);
  assert.deepEqual(room.openings.map((o) => o.id), ['o3']);
});

test('eliminar todas las paredes', () => {
  const r0 = rect();
  const { room } = deleteWalls(r0, r0.walls[0].id, 'todas', []);
  assert.equal(room.walls.length, 0);
  assert.equal(room.nodes.length, 0);
  assert.equal(room.openings.length, 0);
});

test('conservar solo la seleccionada', () => {
  const r0 = rect();
  const { room } = deleteWalls(r0, r0.walls[2].id, 'conservar', []);
  assert.deepEqual(room.walls.map((w) => w.id), [r0.walls[2].id]);
  assert.equal(room.nodes.length, 2);
});

test('módulos apoyados en una pared: cara trasera contra la cara interior, paralela y superpuesta', () => {
  const r0 = rect();
  const [fondo, , , izq] = r0.walls;
  const a = mod('a', 1000, 0); // contra el fondo
  const b = mod('b', 3000, 1000); // tocando la pared derecha con el costado: no está "apoyado"
  const c = mod('c', 0, 1200, 90); // girado 90°: el frente mira a +x, la espalda contra la pared izquierda
  const d = mod('d', 1500, 1500); // en el medio
  const mods = [a, b, c, d];
  assert.deepEqual(modulesOnWall(r0, fondo.id, mods), ['a']);
  assert.deepEqual(modulesOnWall(r0, izq.id, mods), ['c']);
  assert.deepEqual(modulesOnWall(r0, r0.walls[1].id, mods), []);
});

test('eliminar con la casilla de módulos borra solo los apoyados en esa pared', () => {
  const r0 = rect();
  const mods = [mod('a', 1000, 0), mod('d', 1500, 1500)];
  assert.deepEqual(deleteWalls(r0, r0.walls[0].id, 'tramo', mods, { withModules: true }).removedModuleIds, ['a']);
  assert.deepEqual(deleteWalls(r0, r0.walls[0].id, 'tramo', mods).removedModuleIds, []);
});

test('dividir una pared: nuevo vértice y cada abertura en su tramo', () => {
  const r0 = rect();
  const id = r0.walls[0].id;
  const { room, newWallId } = splitWall(r0, id, 2000);
  assert.equal(room.walls.length, 5);
  assert.equal(room.nodes.length, 5);
  assert.equal(room.points.length, 5, 'sigue cerrado');
  const g = Object.fromEntries(roomWalls(room).map((w) => [w.id, w]));
  assert.equal(g[id].len, 2000);
  assert.equal(g[newWallId].len, 1600);
  const o = Object.fromEntries(room.openings.map((x) => [x.id, x]));
  assert.deepEqual([o.o1.wallId, o.o1.offset], [id, 500]);
  assert.deepEqual([o.o2.wallId, o.o2.offset], [newWallId, 500]);
});

test('dividir una pared inclinada reparte el alto en el punto de corte', () => {
  const r0 = updateWall(rect(), rect().walls[0].id, {});
  const id = r0.walls[0].id;
  const sloped = updateWall(r0, id, { h0: 2600, h1: 2000 });
  const { room, newWallId } = splitWall(sloped, id, 1800);
  const w1 = room.walls.find((w) => w.id === id), w2 = room.walls.find((w) => w.id === newWallId);
  assert.deepEqual([w1.h0, w1.h1, w2.h0, w2.h1], [2600, 2300, 2300, 2000]);
});

test('dividir fuera de la pared no hace nada', () => {
  const r0 = rect();
  assert.equal(splitWall(r0, r0.walls[0].id, 0).room, r0);
  assert.equal(splitWall(r0, r0.walls[0].id, 3600).room, r0);
});
