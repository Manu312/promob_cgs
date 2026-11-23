import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VIEWS, viewPose, wallViewPose, orthoZoom, pushView, backView, fwdView, VIEW_HISTORY_MAX } from '../src/domain/views.js';

const box = { w: 3600, d: 3000, h: 2600 };

test('menú Vistas: isométricas, frente, fondo, laterales y planta; por defecto la isométrica derecha', () => {
  assert.equal(VIEWS[0].label, 'Isométrica derecha');
  assert.equal(VIEWS.length, 9);
});

test('cada vista mira el ambiente desde su lado', () => {
  const izq = viewPose('iso-izq', box), tras = viewPose('iso-tras-der', box), lat = viewPose('lat-der', box), fondo = viewPose('fondo', box);
  assert.ok(izq.pos[0] < 0 && izq.pos[2] > 0 && izq.pos[1] > 1);
  assert.ok(tras.pos[0] > 0 && tras.pos[2] < 0);
  assert.ok(lat.pos[0] > 0 && Math.abs(lat.pos[2]) < 1e-9);
  assert.ok(fondo.pos[2] < 0);
  assert.equal(viewPose('planta', box).top, true);
  const grande = viewPose('iso-izq', { w: 8000, d: 6000, h: 2600 });
  assert.ok(Math.hypot(...grande.pos) > Math.hypot(...izq.pos), 'un ambiente más grande se mira de más lejos');
});

test('vista frontal de una pared: del lado de adentro, centrada y de frente', () => {
  const g = { a: [0, 0], b: [3600, 0], n: [0, -1], len: 3600 }; // pared del fondo, normal hacia afuera (−z)
  const p = wallViewPose(g, 2600, { x: 1800, z: 1500 });
  assert.deepEqual(p.target.map((v) => Math.round(v * 100) / 100), [0, 1.3, -1.5]);
  assert.ok(p.pos[2] > p.target[2], 'la cámara queda adentro del ambiente');
  assert.equal(p.pos[0], p.target[0]);
});

test('zoom ortogonal: entra lo más restrictivo', () => {
  assert.equal(Math.round(orthoZoom(4, 2, 1000, 800, 1)), 250);
});

test('Volver / Avanzar vista: guarda hasta 20 y avanzar se borra al ir a otra', () => {
  let h = { back: [], fwd: [] };
  const v = (name) => ({ name });
  h = pushView(h, v('perspectiva'), v('frente'));
  const b = backView(h, v('frente'));
  assert.equal(b.view.name, 'perspectiva');
  const f = fwdView(b.hist, v('perspectiva'));
  assert.equal(f.view.name, 'frente');
  assert.equal(pushView(f.hist, v('frente'), v('planta')).fwd.length, 0);
  for (let i = 0; i < 30; i++) h = pushView(h, v('a' + i), v('b' + i));
  assert.equal(h.back.length, VIEW_HISTORY_MAX);
  assert.equal(pushView(h, v('x'), v('x')), h, 'ir a la misma vista no se guarda');
});
