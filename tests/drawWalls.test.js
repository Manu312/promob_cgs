import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRoom, roomWalls } from '../src/domain/room.js';
import { wallAngles } from '../src/domain/walls.js';
import { addWall, drawWalls, roomTemplate, applyTemplate, segmentEnd } from '../src/domain/drawWalls.js';
import { emptyProject, sampleProject } from '../src/domain/project.js';

const rnd = (pts) => pts.map(([x, z]) => [Math.round(x) + 0, Math.round(z) + 0]);
const empty = () => normalizeRoom({ version: 2, nodes: [], walls: [] });
const nodeXZ = (r) => rnd(r.nodes.map((n) => [n.x, n.z]));

test('dibujar una cadena abierta con largo y ángulo relativo (90 = dobla a la derecha)', () => {
  const { room, closed } = drawWalls(empty(), [0, 0], [{ len: 3000, angle: 0 }, { len: 2000, rel: 90 }]);
  assert.equal(closed, false);
  assert.deepEqual(nodeXZ(room), [[0, 0], [3000, 0], [3000, 2000]]);
  assert.equal(room.walls.length, 2);
  assert.equal(room.points, null);
  assert.deepEqual(roomWalls(room)[0].n.map((v) => Math.round(v) + 0), [0, -1], 'el espesor queda hacia afuera');
});

test('cierre automático: el último tramo termina en el inicio y se forma el contorno', () => {
  const segs = [{ len: 4000, angle: 0 }, { len: 3000, rel: 90 }, { len: 4000, rel: 90 }, { len: 3000, rel: 90 }];
  const { room, closed } = drawWalls(empty(), [0, 0], segs);
  assert.equal(closed, true);
  assert.equal(room.nodes.length, 4);
  assert.equal(room.walls.length, 4);
  assert.deepEqual(rnd(room.points), [[0, 0], [4000, 0], [4000, 3000], [0, 3000]]);
  assert.deepEqual(wallAngles(room).map((a) => a.rel), [90, 90, 90, 90]);
});

test('ángulos relativos que no son de 90°', () => {
  const { room } = drawWalls(empty(), [0, 0], [{ len: 1000, angle: 0 }, { len: 1000, rel: 135 }]);
  assert.deepEqual(nodeXZ(room)[2], [1707, 707]);
  assert.equal(wallAngles(room)[1].rel, 135);
});

test('cocina en U solo con medidas: 3200 × 2400 × 3000', () => {
  const { room } = drawWalls(empty(), [0, 2400], [{ len: 2400, angle: 90 }, { len: 3200, rel: 90 }, { len: 3000, rel: 90 }]);
  assert.deepEqual(roomWalls(room).map((w) => w.len), [2400, 3200, 3000]);
  assert.deepEqual(nodeXZ(room), [[0, 2400], [0, 0], [3200, 0], [3200, 3000]]);
});

test('segmentEnd: punto final según ángulo absoluto en planta', () => {
  assert.deepEqual(segmentEnd([0, 0], 1000, 0).map(Math.round), [1000, 0]);
  assert.deepEqual(segmentEnd([0, 0], 1000, 270).map((v) => Math.round(v) + 0), [0, 1000]);
});

test('un tramo puede empezar en una esquina libre existente (continuar una cadena)', () => {
  const r0 = roomTemplate('dos', { w: 3600, d: 3000 });
  const free = r0.nodes.find((n) => n.x === 3600 && n.z === 0);
  const { room, startNodeId } = addWall(r0, { nodeId: free.id }, { point: [3600, 3000] });
  assert.equal(startNodeId, free.id);
  assert.equal(room.nodes.length, 4);
  assert.equal(room.walls.length, 3);
});

test('un tramo que termina sobre una esquina existente se une a ella', () => {
  const r0 = drawWalls(empty(), [0, 0], [{ len: 3000, angle: 0 }, { len: 2000, rel: 90 }]).room;
  const res = addWall(r0, { nodeId: r0.nodes[2].id }, { point: [0.4, 0.3] });
  assert.equal(res.closed, true);
  assert.equal(res.room.nodes.length, 3);
  assert.notEqual(res.room.points, null);
});

test('plantillas: 2 paredes, rectangular, en L y en U', () => {
  const dos = roomTemplate('dos', { w: 3600, d: 3000 });
  assert.equal(dos.walls.length, 2);
  assert.equal(dos.points, null);
  assert.deepEqual(roomWalls(dos).map((w) => w.n.map((v) => Math.round(v) + 0)), [[-1, 0], [0, -1]], 'espesor hacia afuera');
  assert.equal(roomTemplate('rect', { w: 3600, d: 3000 }).points.length, 4);
  assert.equal(roomTemplate('L', { w: 4000, d: 3000, cutW: 1200, cutD: 1000 }).points.length, 6);
  const U = roomTemplate('U', { w: 3200, d: 2400 });
  assert.deepEqual(roomWalls(U).map((w) => w.len), [2400, 3200, 2400]);
  assert.equal(U.points, null);
});

test('aplicar una plantilla conserva grilla y alturas de referencia y quita aberturas', () => {
  const r0 = { ...normalizeRoom({ w: 3600, d: 3000, openings: [{ id: 'v', type: 'ventana', wall: 1, offset: 900, width: 1200, height: 1100, sill: 1000 }] }), grid: { size: 25, magnetic: false }, refHeights: [100, 900] };
  const r = applyTemplate(r0, 'U', { w: 3000, d: 2000 });
  assert.equal(r.walls.length, 3);
  assert.deepEqual(r.grid, { size: 25, magnetic: false });
  assert.deepEqual(r.refHeights, [100, 900]);
  assert.equal(r.openings.length, 0);
});

test('proyecto nuevo arranca con 2 paredes y piso; el de ejemplo sigue siendo rectangular', () => {
  const p = emptyProject();
  assert.equal(p.room.walls.length, 2);
  assert.equal(p.room.points, null);
  assert.equal(sampleProject().room.points.length, 4);
});
