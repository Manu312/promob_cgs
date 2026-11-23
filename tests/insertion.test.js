import { test } from 'node:test';
import assert from 'node:assert/strict';
import { placeRelative, orientItem, changePlane, detachModule } from '../src/domain/insertion.js';
import { followWall } from '../src/domain/wallEdit.js';
import { MODULE_TYPES } from '../src/domain/modules.js';
import { emptyProject } from '../src/domain/project.js';
import { wallGeometry } from '../src/domain/walls.js';

const mod = (id, type, x, extra = {}, params = {}) => ({ id, type, params: { ...MODULE_TYPES[type].defaults, ...params }, x, z: 0, y: MODULE_TYPES[type].y, rot: 0, mats: {}, ...extra });

test('dirección de inserción: a la derecha, a la izquierda, arriba y abajo del seleccionado', () => {
  const base = mod('b', 'bajo', 1000, {}, { width: 600, depth: 560 });
  const n = mod('n', 'bajo', 0, {}, { width: 400, depth: 560 });
  assert.deepEqual([placeRelative(base, n, 'derecha').x, placeRelative(base, n, 'derecha').z], [1600, 0]);
  assert.equal(placeRelative(base, n, 'izquierda').x, 600);
  const al = mod('a', 'alacena', 0, {}, { width: 600, depth: 330, height: 700 });
  const up = placeRelative(base, al, 'arriba');
  assert.deepEqual([up.y, up.z], [base.params.height, 0], 'arriba y alineada atrás');
  assert.equal(placeRelative({ ...base, y: 1450 }, al, 'abajo').y, 750);
  const r = placeRelative({ ...base, rot: 90, x: 0, z: 1000 }, n, 'derecha');
  assert.equal(r.rot, 90);
});

test('orientación: horizontal (estante), vertical (lateral), de frente al plano (panel)', () => {
  const p = MODULE_TYPES.estante.defaults; // 800 × 18 × 250
  assert.deepEqual(orientItem('estante', p, 'horizontal').params.height, 18);
  const v = orientItem('estante', p, 'vertical');
  assert.deepEqual([v.type, v.params.width, v.params.height, v.params.depth], ['vista', 18, 800, 250]);
  const f = orientItem('estante', p, 'vertical-plano');
  assert.deepEqual([f.type, f.params.width, f.params.height], ['panel', 250, 800]);
  assert.equal(orientItem('bajo', MODULE_TYPES.bajo.defaults, 'vertical').type, 'bajo', 'un módulo no cambia');
});

test('cambiar de plano: al piso, arriba de otro módulo o contra una pared', () => {
  const project = { ...emptyProject(), modules: [mod('b', 'bajo', 0)] };
  const m = mod('m', 'microondas', 2000);
  assert.equal(changePlane(m, { kind: 'floor' }, project).y, 0);
  const top = changePlane(m, { kind: 'module', id: 'b' }, project);
  assert.ok(top.y >= MODULE_TYPES.bajo.defaults.height && top.rest);
  const w = changePlane(mod('a', 'alacena', 1000, { z: 1500 }), { kind: 'wall', point: [1000, 10] }, project);
  assert.equal(w.z, 0);
});

test('desasociar: deja de acompañar a la pared', () => {
  const room = emptyProject().room;
  const back = wallGeometry(room).find((g) => g.a[1] === 0 && g.b[1] === 0);
  const on = mod('a', 'bajo', 500);
  const det = detachModule(mod('d', 'bajo', 1200));
  const moved = followWall(room, back.id, [on, det], 0, -100);
  assert.equal(moved[0].z, -100);
  assert.equal(moved[1].z, 0);
  assert.equal(det.rest, false);
});
