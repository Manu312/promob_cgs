import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRoom, migrateRoom, roomWalls, rebuildFromShape, setWallDefaults } from '../src/domain/room.js';
import { wallCorners, floorPolygon, outline } from '../src/domain/walls.js';
import { snapPosition } from '../src/domain/modules.js';
import { sampleProject } from '../src/domain/project.js';

const r0 = (v) => Math.round(v) + 0; // evita -0
const pointAlong = (g, off) => [g.a[0] + g.u[0] * off, g.a[1] + g.u[1] * off].map(r0);

// Ambiente abierto de 2 paredes en L (como el arranque de Promob): A(0,0) → B(3000,0) → C(3000,2000)
const openL = () => normalizeRoom({
  version: 2,
  nodes: [{ id: 'A', x: 0, z: 0 }, { id: 'B', x: 3000, z: 0 }, { id: 'C', x: 3000, z: 2000 }],
  walls: [{ id: 'w1', n0: 'A', n1: 'B', t: 150, h0: 2600, h1: 2600 }, { id: 'w2', n0: 'B', n1: 'C', t: 150, h0: 2600, h1: 2600 }],
});

test('migración v1 rectangular → v2: vértices compartidos y paredes encadenadas', () => {
  const r = normalizeRoom({ w: 3000, d: 2000, h: 2500, t: 120 });
  assert.equal(r.version, 2);
  assert.equal(r.nodes.length, 4);
  assert.equal(r.walls.length, 4);
  assert.equal(new Set(r.walls.map((w) => w.id)).size, 4, 'ids de pared únicos');
  r.walls.forEach((w, i) => assert.equal(w.n1, r.walls[(i + 1) % 4].n0, `pared ${i} se une a la siguiente`));
  for (const w of r.walls) {
    assert.equal(w.t, 120);
    assert.equal(w.h0, 2500);
    assert.equal(w.h1, 2500);
    assert.equal(w.movable, false);
    assert.equal(w.lowered, false);
    assert.equal(w.visible, true);
  }
  assert.deepEqual(r.refHeights, [100, 820, 1470, 2010, 2280]);
  assert.equal(r.w, 3000);
  assert.equal(r.d, 2000);
});

test('migración: la abertura pasa de índice de pared a wallId', () => {
  const r = normalizeRoom({ w: 3600, d: 3000, openings: [{ id: 'v', type: 'ventana', wall: 1, offset: 900, width: 1200, height: 1100, sill: 1000 }] });
  assert.equal(r.openings.length, 1);
  assert.equal(r.openings[0].wallId, r.walls[1].id);
  assert.equal(r.openings[0].wall, undefined);
});

test('migración de puntos en sentido inverso: normales hacia afuera y abertura en el mismo lugar físico', () => {
  const r = normalizeRoom({
    shape: 'libre',
    points: [[0, 0], [0, 3000], [5000, 3000], [5000, 0]],
    openings: [{ id: 'p', type: 'puerta', wall: 0, offset: 500, width: 800, height: 2000, sill: 0 }],
  });
  const ws = roomWalls(r);
  const fondo = ws.find((g) => g.a[1] === 0 && g.b[1] === 0);
  assert.deepEqual(fondo.n.map(r0), [0, -1], 'la pared en z=0 mira hacia z negativo');
  const o = r.openings[0];
  const g = ws.find((x) => x.id === o.wallId);
  const ends = [pointAlong(g, o.offset), pointAlong(g, o.offset + o.width)].sort((a, b) => a[1] - b[1]);
  assert.deepEqual(ends, [[0, 500], [0, 1300]]);
  // contorno, vértices y paredes en el mismo orden (pared i = punto i → i+1)
  r.walls.forEach((w, i) => {
    const n = r.nodes.find((x) => x.id === w.n0);
    assert.deepEqual([n.x, n.z], r.points[i]);
  });
});

test('normalizeRoom es idempotente sobre v2', () => {
  const a = normalizeRoom({ shape: 'L', w: 4000, d: 3000 });
  const b = normalizeRoom(a);
  assert.deepEqual(b.nodes, a.nodes);
  assert.deepEqual(b.walls, a.walls);
  assert.deepEqual(b.openings, a.openings);
  assert.equal(migrateRoom(a), a);
});

test('ambiente abierto de 2 paredes: sin contorno, piso = rectángulo envolvente', () => {
  const r = openL();
  assert.equal(outline(r), null);
  assert.equal(r.points, null);
  assert.deepEqual(floorPolygon(r), [[0, 0], [3000, 0], [3000, 2000], [0, 2000]]);
  assert.equal(r.w, 3000);
  assert.equal(r.d, 2000);
});

test('esquinas: solo donde se unen dos paredes', () => {
  assert.equal(wallCorners(openL()).length, 1);
  assert.equal(wallCorners(normalizeRoom({ w: 3000, d: 2000 })).length, 4);
  assert.equal(wallCorners(normalizeRoom({ shape: 'L', w: 4000, d: 3000 })).length, 6);
});

test('imán funciona en un ambiente abierto', () => {
  const m = { params: { width: 600, depth: 560 }, x: 1000, z: 25, rot: 0 };
  assert.equal(snapPosition(m, [], openL()).z, 0);
  const m2 = { params: { width: 600, depth: 560 }, x: 2380, z: 800, rot: 0 };
  assert.equal(snapPosition(m2, [], openL()).x, 2400, 'se pega a la pared derecha (cara interior)');
});

test('rebuildFromShape conserva ids, propiedades de pared y aberturas', () => {
  let r = normalizeRoom({ w: 3600, d: 3000, openings: [{ id: 'v', type: 'ventana', wall: 1, offset: 900, width: 1200, height: 1100, sill: 1000 }] });
  r = { ...r, walls: r.walls.map((w, i) => (i === 1 ? { ...w, movable: true } : w)) };
  const ids = r.walls.map((w) => w.id);
  const r2 = rebuildFromShape(r, { w: 4000 });
  assert.deepEqual(r2.walls.map((w) => w.id), ids);
  assert.equal(r2.walls[1].movable, true);
  assert.equal(r2.w, 4000);
  assert.equal(r2.openings[0].wallId, ids[1]);
  const rL = rebuildFromShape(r2, { shape: 'L' });
  assert.equal(rL.walls.length, 6);
  assert.deepEqual(rL.walls.slice(0, 4).map((w) => w.id), ids);
});

test('rebuildFromShape en libre: editar puntos regenera las paredes', () => {
  const r = rebuildFromShape(normalizeRoom({ w: 3000, d: 3000 }), { shape: 'libre', points: [[0, 0], [4000, 0], [4000, 2000], [0, 2000], [0, 1000]] });
  assert.equal(r.walls.length, 5);
  assert.equal(r.points.length, 5);
  assert.equal(r.w, 4000);
});

test('setWallDefaults aplica alto y espesor a todas las paredes', () => {
  const r = setWallDefaults(normalizeRoom({ w: 3000, d: 2000 }), { h: 2800, t: 200 });
  assert.equal(r.h, 2800);
  assert.equal(r.t, 200);
  assert.ok(r.walls.every((w) => w.h0 === 2800 && w.h1 === 2800 && w.t === 200));
});

test('alto de abertura se ajusta al alto de su pared', () => {
  const r = normalizeRoom({ w: 3000, d: 2000, h: 2400, openings: [{ id: 'a', type: 'paso', wall: 0, offset: 0, width: 900, height: 3000, sill: 0 }] });
  assert.equal(r.openings[0].height, 2400);
});

test('proyecto de ejemplo: aberturas ligadas a paredes existentes', () => {
  const p = sampleProject();
  assert.equal(p.room.version, 2);
  assert.equal(p.room.openings.length, 2);
  const ids = new Set(p.room.walls.map((w) => w.id));
  assert.ok(p.room.openings.every((o) => ids.has(o.wallId)));
});
