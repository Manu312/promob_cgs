import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toExtreme, centerX, invertModule, shiftRotation } from '../src/domain/moveExtras.js';
import { emptyProject } from '../src/domain/project.js';
import { MODULE_TYPES, buildModule } from '../src/domain/modules.js';
import { frontsOf } from '../src/domain/fronts.js';

const room = emptyProject().room;
const mod = (id, x, z, extra = {}) => ({ id, type: 'bajo', params: { ...MODULE_TYPES.bajo.defaults, width: 600, depth: 560 }, x, z, y: 0, rot: 0, mats: {}, ...extra });

test('Ctrl+flecha derecha: hasta el módulo vecino; izquierda: hasta la pared', () => {
  const a = mod('a', 1000, 0), b = mod('b', 2500, 0);
  const r = toExtreme(a, room, [a, b], '+x');
  assert.deepEqual(r, { x: 1900, z: 0 });
  const l = toExtreme(a, room, [a, b], '-x');
  assert.ok(l.x < a.x && l.z === 0);
});

test('Ctrl+Inicio centra a lo ancho entre lo que tiene a los costados', () => {
  const a = mod('a', 0, 0), m = mod('m', 700, 0), b = mod('b', 2000, 0);
  const { x } = centerX(m, room, [a, m, b]);
  assert.equal(x - 600, 2000 - (x + 600), 'misma distancia a cada lado');
});

test('I invierte: esquinero cambia de lado y las puertas abren al revés', () => {
  const e = { id: 'e', type: 'esq_l', params: { ...MODULE_TYPES.esq_l.defaults }, x: 0, z: 0 };
  assert.equal(invertModule(e).params.side, 'der');
  const b = mod('b', 0, 0);
  const fr = frontsOf(buildModule(b, { t: 18, tf: 18, tb: 3 }));
  const inv = invertModule(b, fr);
  const doors = fr.filter((f) => f.kind === 'door');
  assert.ok(doors.length > 0);
  for (const f of doors) assert.notEqual(inv.params.hinges[f.k], f.hinge);
});

test('Shift + mouse: gira de a 1° según el corrimiento horizontal', () => {
  assert.equal(shiftRotation(0, 90), 45);
  assert.equal(shiftRotation(10, -40), 350);
});
