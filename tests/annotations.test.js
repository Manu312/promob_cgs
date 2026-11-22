import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRoom } from '../src/domain/room.js';
import { MODULE_TYPES } from '../src/domain/modules.js';
import { normalizeProject } from '../src/domain/project.js';
import { snapPoint, annotationValue, addAnnotation, removeAnnotation } from '../src/domain/annotations.js';

const room = normalizeRoom({ w: 3600, d: 3000, columns: [{ id: 'c', x: 3000, z: 2000, w: 300, d: 300 }] });
const bajo = { id: 'a', type: 'bajo', params: { ...MODULE_TYPES.bajo.defaults }, x: 1000, z: 0, y: 0, rot: 0 }; // 600 × 560

test('imán a vértices: esquina de pared, de módulo y de columna', () => {
  assert.deepEqual(snapPoint(room, [bajo], [3560, 40]), { point: [3600, 0], kind: 'vertex' });
  assert.deepEqual(snapPoint(room, [bajo], [1620, 530]), { point: [1600, 560], kind: 'vertex' });
  assert.deepEqual(snapPoint(room, [bajo], [2990, 2010]), { point: [3000, 2000], kind: 'vertex' });
});

test('imán a aristas cuando no hay vértice cerca', () => {
  assert.deepEqual(snapPoint(room, [bajo], [2400, 30]), { point: [2400, 0], kind: 'edge' });
  assert.deepEqual(snapPoint(room, [bajo], [1300, 590]), { point: [1300, 560], kind: 'edge' });
});

test('sin imán: punto libre redondeado a la grilla', () => {
  assert.deepEqual(snapPoint(room, [bajo], [1813, 1488], { grid: 50 }), { point: [1800, 1500], kind: 'free' });
});

test('valor de las cotas: distancia en mm y ángulo en grados', () => {
  assert.equal(annotationValue({ kind: 'lin', points: [[1000, 560], [3600, 560]] }), 2600);
  assert.equal(annotationValue({ kind: 'lin', points: [[0, 0], [300, 400]] }), 500);
  assert.equal(annotationValue({ kind: 'ang', points: [[0, 3000], [0, 0], [3600, 0]] }), 90);
  assert.equal(annotationValue({ kind: 'ang', points: [[1000, 0], [0, 0], [1000, 1000]] }), 45);
});

test('las cotas manuales se guardan en el proyecto y se pueden quitar', () => {
  const p0 = normalizeProject({ name: 'x', room, modules: [], defaults: {} });
  assert.deepEqual(p0.annotations, []);
  const p1 = addAnnotation(p0, 'lin', [[0, 0], [3600, 0]]);
  assert.equal(p1.annotations.length, 1);
  assert.equal(p1.annotations[0].kind, 'lin');
  assert.equal(removeAnnotation(p1, p1.annotations[0].id).annotations.length, 0);
  assert.equal(normalizeProject(p1).annotations.length, 1, 'normalizar no las pierde');
});
