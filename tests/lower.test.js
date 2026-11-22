import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRoom, roomWalls } from '../src/domain/room.js';
import { wallFacesCamera } from '../src/domain/walls.js';

const room = normalizeRoom({ w: 3600, d: 3000 });
const faces = (cam) => roomWalls(room).map((g) => wallFacesCamera(g, cam));

test('Auto Rebajar: con la cámara adelante y afuera, se rebaja solo la pared de adelante', () => {
  assert.deepEqual(faces([1800, 6000]), [false, false, true, false]);
});

test('con la cámara a la izquierda, se rebaja la pared izquierda', () => {
  assert.deepEqual(faces([-3000, 1500]), [false, false, false, true]);
});

test('con la cámara adentro del ambiente (o en Planta, sobre el centro) no se rebaja ninguna', () => {
  assert.deepEqual(faces([1800, 1500]), [false, false, false, false]);
});

test('alto de pared rebajada configurable, 100 mm por defecto', () => {
  assert.equal(room.lowerH, 100);
  assert.equal(normalizeRoom({ ...room, lowerH: 250 }).lowerH, 250);
});
