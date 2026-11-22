import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRoom, roomWalls } from '../src/domain/room.js';
import { wallAngles } from '../src/domain/walls.js';
import { moveWall, moveNode, setWallLength } from '../src/domain/wallEdit.js';
import { snapPosition, newModule } from '../src/domain/modules.js';

const rnd = (pts) => pts.map(([x, z]) => [Math.round(x) + 0, Math.round(z) + 0]);
const rect = () => normalizeRoom({ w: 3600, d: 3000 });
const chain = (pts) => normalizeRoom({
  version: 2,
  nodes: pts.map(([x, z], i) => ({ id: `n${i}`, x, z })),
  walls: pts.slice(1).map((_, i) => ({ id: `w${i + 1}`, n0: `n${i}`, n1: `n${i + 1}`, t: 150, h0: 2600, h1: 2600 })),
});
const at = (r, id) => { const n = r.nodes.find((x) => x.id === id); return [Math.round(n.x) + 0, Math.round(n.z) + 0]; };

test('arrastrar la pared del fondo de un rectángulo estira las laterales', () => {
  const r0 = rect();
  const r = moveWall(r0, r0.walls[0].id, 0, -300);
  assert.deepEqual(rnd(r.points), [[0, -300], [3600, -300], [3600, 3000], [0, 3000]]);
  assert.deepEqual(roomWalls(r).map((w) => w.len), [3600, 3300, 3600, 3300]);
  assert.equal(r.shape, 'libre', 'tras editar a mano, el editor numérico pasa a puntos libres');
});

test('el componente a lo largo de la pared no la deforma si las dos vecinas existen', () => {
  const r0 = rect();
  assert.deepEqual(rnd(moveWall(r0, r0.walls[0].id, 500, -300).points), [[0, -300], [3600, -300], [3600, 3000], [0, 3000]]);
});

test('arrastrar la pared interna de una L mantiene los ángulos', () => {
  const r0 = normalizeRoom({ shape: 'L', w: 4000, d: 3000, cutW: 1200, cutD: 1000 });
  const before = wallAngles(r0).map((a) => a.rel);
  const r = moveWall(r0, r0.walls[2].id, 0, 200);
  assert.deepEqual(rnd(r.points), [[0, 0], [4000, 0], [4000, 2200], [2800, 2200], [2800, 3000], [0, 3000]]);
  assert.deepEqual(wallAngles(r).map((a) => a.rel), before);
});

test('cadena abierta: el extremo con vecina se desliza, el libre se traslada', () => {
  const r0 = chain([[0, 0], [3000, 0], [3000, 2000]]);
  const r = moveWall(r0, 'w2', 500, 0);
  assert.deepEqual(at(r, 'n1'), [3500, 0]);
  assert.deepEqual(at(r, 'n2'), [3500, 2000]);
  const r2 = moveWall(r0, 'w1', 0, 300);
  assert.deepEqual(at(r2, 'n0'), [0, 300]);
  assert.deepEqual(at(r2, 'n1'), [3000, 300]);
});

test('vecina paralela (tramos alineados): el extremo compartido se traslada', () => {
  const r = moveWall(chain([[0, 0], [2000, 0], [4000, 0]]), 'w2', 0, 200);
  assert.deepEqual(at(r, 'n0'), [0, 0]);
  assert.deepEqual(at(r, 'n1'), [2000, 200]);
  assert.deepEqual(at(r, 'n2'), [4000, 200]);
});

test('arrastrar un vértice mueve las dos paredes que lo comparten', () => {
  const r0 = rect();
  const r = moveNode(r0, r0.nodes[1].id, 3800, -200);
  assert.deepEqual(rnd(r.points)[1], [3800, -200]);
  const g = roomWalls(r);
  assert.equal(g[0].len, Math.round(Math.hypot(3800, 200)));
  assert.equal(g[1].len, Math.round(Math.hypot(200, 3200)));
  assert.equal(r.shape, 'libre');
});

test('arrastrar el extremo libre de una cadena abierta mueve solo esa pared', () => {
  const r = moveNode(chain([[0, 0], [3000, 0], [3000, 2000]]), 'n2', 3000, 2600);
  assert.deepEqual(at(r, 'n1'), [3000, 0]);
  assert.deepEqual(roomWalls(r).map((w) => w.len), [3000, 2600]);
});

test('editar el largo también pasa el ambiente a puntos libres', () => {
  const r0 = rect();
  assert.equal(setWallLength(r0, r0.walls[0].id, 4000).shape, 'libre');
});

test('los módulos ya no quedan encerrados en el rectángulo del ambiente', () => {
  const m = { params: { width: 600, depth: 560 }, x: -503, z: 1497, rot: 0 };
  assert.deepEqual(snapPosition(m, [], rect()), { x: -500, z: 1500 });
});

test('un módulo nuevo se apoya en la pared del fondo aunque esté en z negativo', () => {
  const r0 = rect();
  const room = moveWall(r0, r0.walls[0].id, 0, -300);
  const m = newModule('bajo', { room, modules: [] });
  assert.equal(m.z, -300);
  assert.equal(m.x, 0);
});
