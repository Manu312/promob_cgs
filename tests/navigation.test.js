import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fitBoxPose, zoomWindowPose, walkPose } from '../src/domain/navigation.js';

const near = (a, b, e = 1e-6) => a.every((v, i) => Math.abs(v - b[i]) < e);

test('Zoom total / entidad: encuadra la caja sin cambiar el ángulo desde donde se mira', () => {
  const p = fitBoxPose([0, 0, 0], [1, 1, 1], [5, 5, 5], [0, 0, 0]);
  assert.ok(near(p.target, [0.5, 0.5, 0.5]));
  const d0 = [5, 5, 5].map((v) => v / Math.hypot(5, 5, 5));
  const d1 = p.pos.map((v, i) => v - p.target[i]);
  const l1 = Math.hypot(...d1);
  assert.ok(near(d1.map((v) => v / l1), d0));
  const grande = fitBoxPose([0, 0, 0], [4, 4, 4], [5, 5, 5], [0, 0, 0]);
  assert.ok(Math.hypot(...grande.pos.map((v, i) => v - grande.target[i])) > l1, 'una caja más grande se mira de más lejos');
});

test('Zoom ventana: el centro del recuadro pasa a ser el centro y se acerca', () => {
  const cam = [0, 0, 10], tgt = [0, 0, 0];
  const p = zoomWindowPose(cam, tgt, { x0: 0.5, y0: 0.25, x1: 0.75, y1: 0.5 }, { aspect: 1 });
  assert.ok(p.target[0] > 0 && p.target[1] > 0, 'arriba a la derecha');
  assert.ok(Math.hypot(...p.pos.map((v, i) => v - p.target[i])) < 10);
  const o = zoomWindowPose(cam, tgt, { x0: 0.25, y0: 0.25, x1: 0.75, y1: 0.75 }, { ortho: true, zoom: 100, viewH: 600 });
  assert.equal(o.zoomFactor, 2);
  assert.ok(near(o.target, [0, 0, 0]));
});

test('Caminar: avanza en horizontal hacia donde mira y gira la mirada', () => {
  const p = walkPose([0, 1.6, 5], [0, 1.6, 0], 1, 0);
  assert.ok(near(p.pos, [0, 1.6, 4]));
  const g = walkPose([0, 1.6, 5], [0, 1.6, 0], 0, 90);
  const d = g.target.map((v, i) => v - g.pos[i]);
  assert.ok(d[0] > 4.9 && Math.abs(d[2]) < 1e-6, 'girar 90° a la derecha mira a +x');
});
