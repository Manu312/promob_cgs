import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRoom } from '../src/domain/room.js';
import { setWallLength } from '../src/domain/wallEdit.js';
import { updateOpening, removeOpening, openingDims, setOpeningDim, moveColumn, updateColumn, removeColumn } from '../src/domain/openings.js';
import { describeSelection } from '../src/domain/selection.js';

const room = () => normalizeRoom({
  w: 3600, d: 3000,
  openings: [{ id: 'v', type: 'ventana', wall: 0, offset: 2500, width: 800, height: 1100, sill: 1000 }],
  columns: [{ id: 'c', x: 1500, z: 1200, w: 300, d: 300 }],
});

test('mover una abertura la mantiene dentro de su pared', () => {
  assert.equal(updateOpening(room(), 'v', { offset: 9999 }).openings[0].offset, 2800);
  assert.equal(updateOpening(room(), 'v', { offset: -50 }).openings[0].offset, 0);
  assert.equal(updateOpening(room(), 'v', { offset: 1200 }).openings[0].offset, 1200);
});

test('acortar la pared reacomoda la abertura para que entre', () => {
  const r = room();
  assert.equal(setWallLength(r, r.walls[0].id, 3000).openings[0].offset, 2200);
});

test('cotas de la abertura a los extremos de su pared, editables', () => {
  const r = room();
  assert.deepEqual(openingDims(r, 'v'), { start: 2500, end: 300, len: 3600 });
  assert.equal(setOpeningDim(r, 'v', 'start', 1000).openings[0].offset, 1000);
  assert.equal(setOpeningDim(r, 'v', 'end', 1000).openings[0].offset, 1800);
});

test('quitar una abertura y cambiarla de pared', () => {
  const r = room();
  assert.equal(removeOpening(r, 'v').openings.length, 0);
  assert.equal(updateOpening(r, 'v', { wallId: r.walls[1].id, offset: 100 }).openings[0].wallId, r.walls[1].id);
});

test('columna arrastrada: imán a la pared más cercana y grilla en lo demás', () => {
  const r = room();
  const c = moveColumn(r, 'c', 3275, 1218, 50).columns[0];
  assert.deepEqual([c.x, c.z], [3300, 1200], 'cara derecha contra la pared x = 3600');
  const c2 = moveColumn(r, 'c', 1213, 22, 50).columns[0];
  assert.deepEqual([c2.x, c2.z], [1200, 0], 'contra la pared del fondo');
});

test('editar y quitar columnas', () => {
  const r = room();
  assert.equal(updateColumn(r, 'c', { w: 400 }).columns[0].w, 400);
  assert.equal(removeColumn(r, 'c').columns.length, 0);
});

test('barra de estado para aberturas y columnas', () => {
  const r = room();
  const p = { room: r, modules: [] };
  assert.equal(describeSelection(p, { kind: 'opening', id: 'v' }), 'Ventana · 800 × 1100 · antepecho 1000 · Pared 1');
  assert.equal(describeSelection(p, { kind: 'column', id: 'c' }), 'Columna · 300 × 300');
});
