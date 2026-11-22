import { test } from 'node:test';
import assert from 'node:assert/strict';
import { placePlanImage, scalePlanImage, planImageSize, dataUrlTooBig } from '../src/domain/planImage.js';
import { normalizeProject } from '../src/domain/project.js';
import { normalizeRoom } from '../src/domain/room.js';

const r3 = (v) => Math.round(v * 1000) / 1000;
const bounds = { minX: 0, minZ: 0, maxX: 3600, maxZ: 3000 };

test('al cargar, la imagen ocupa el ancho del ambiente y arranca en su esquina', () => {
  const img = placePlanImage('data:x', 1800, 1500, bounds);
  assert.deepEqual([img.x, img.z, img.mmPerPx, img.opacity, img.visible], [0, 0, 2, 0.5, true]);
  assert.deepEqual(planImageSize(img), { w: 3600, h: 3000 });
});

test('escalar con 2 puntos: el tramo marcado pasa a medir lo real y el primer punto queda fijo', () => {
  const img = placePlanImage('data:x', 1800, 1500, bounds); // 2 mm/px
  const s = scalePlanImage(img, [0, 0], [1800, 0], 3000);
  assert.equal(r3(s.mmPerPx), r3(2 * 3000 / 1800));
  assert.deepEqual([s.x, s.z], [0, 0]);
  // el píxel que estaba en x = 1800 mm (píxel 900) ahora queda en 3000 mm
  assert.equal(r3(s.x + 900 * s.mmPerPx), 3000);
});

test('escalar desde un punto que no es el origen de la imagen', () => {
  const img = { ...placePlanImage('data:x', 1000, 1000, bounds), x: 1000, z: 500, mmPerPx: 2 };
  const s = scalePlanImage(img, [2000, 1500], [2000, 2500], 500);
  assert.deepEqual([s.mmPerPx, s.x, s.z], [1, 1500, 1000]);
});

test('sin distancia medida no cambia', () => {
  const img = placePlanImage('data:x', 100, 100, bounds);
  assert.equal(scalePlanImage(img, [10, 10], [10, 10], 3000), img);
});

test('aviso de imagen pesada (> 2 MB)', () => {
  assert.equal(dataUrlTooBig('data:image/png;base64,' + 'A'.repeat(1000)), false);
  assert.equal(dataUrlTooBig('data:image/png;base64,' + 'A'.repeat(3 * 1024 * 1024)), true);
});

test('el plano de referencia se guarda en el proyecto', () => {
  const planImage = placePlanImage('data:x', 100, 100, bounds);
  const p = normalizeProject({ name: 'x', room: normalizeRoom({ w: 3600, d: 3000 }), modules: [], defaults: {}, planImage });
  assert.deepEqual(p.planImage, planImage);
  assert.equal(normalizeProject({ name: 'x', room: normalizeRoom({}), modules: [], defaults: {} }).planImage, null);
});
