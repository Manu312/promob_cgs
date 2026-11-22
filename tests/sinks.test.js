import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MODULE_TYPES, buildModule } from '../src/domain/modules.js';
import { splitAround, sinkBowls, cutoutOf } from '../src/domain/appliances.js';
import { cutoutsFor, buildAll, computeCutList } from '../src/domain/cutlist.js';
import { restingHeight } from '../src/domain/movement.js';
import { mergeSettings } from '../src/domain/catalog.js';
import { normalizeProject, sampleProject } from '../src/domain/project.js';

const mod = (id, type, x, z, y, params = {}) => ({ id, type, params: { ...MODULE_TYPES[type].defaults, ...params }, x, z, y, rot: 0, ...(MODULE_TYPES[type].rest ? { rest: true } : {}) });

test('partir la mesada alrededor de un hueco: 4 rectángulos que no lo tocan', () => {
  const rs = splitAround({ x0: 0, z0: 0, x1: 1000, z1: 600 }, [{ x0: 200, z0: 100, x1: 700, z1: 500 }]);
  assert.equal(rs.length, 4);
  const area = rs.reduce((a, r) => a + (r.x1 - r.x0) * (r.z1 - r.z0), 0);
  assert.equal(area, 1000 * 600 - 500 * 400);
  assert.deepEqual(splitAround({ x0: 0, z0: 0, x1: 10, z1: 10 }, [{ x0: 20, z0: 20, x1: 30, z1: 30 }]), [{ x0: 0, z0: 0, x1: 10, z1: 10 }]);
});

test('bacha simple con escurridor: una cubeta; doble: dos', () => {
  assert.equal(sinkBowls(MODULE_TYPES.bacha.defaults).length, 1);
  assert.equal(sinkBowls({ ...MODULE_TYPES.bacha.defaults, width: 780, depth: 435, bowls: 2 }).length, 2);
  const c = cutoutOf('bacha', { ...MODULE_TYPES.bacha.defaults }, MODULE_TYPES.bacha);
  assert.deepEqual([c.x1 - c.x0, c.z1 - c.z0], [670, 442]);
});

test('lo que se apoya sobre un bajo con mesada queda arriba de la mesada', () => {
  const bajo = mod('b', 'bajo', 0, 0, 0);
  const g = mod('g', 'griferia', 300, 50, 0);
  assert.equal(restingHeight(g, [bajo, g]), 870 + 20);
});

test('la bacha apoyada sobre un bajo cala su mesada (3D y presupuesto)', () => {
  const bajo = mod('b', 'bajo', 0, 0, 0, { width: 800 });
  const bacha = mod('s', 'bacha', 45, 40, 890);
  const holes = cutoutsFor([bajo, bacha]);
  assert.equal(holes.b.length, 1);
  const h = holes.b[0];
  assert.deepEqual([h.x0, h.z0, h.x1, h.z1], [65, 60, 735, 502]);
  const p = { ...normalizeProject(sampleProject()), modules: [bajo, bacha] };
  const [bb] = buildAll(p, mergeSettings({}));
  const mesadas = bb.decors.filter((d) => d.decor === 'mesada');
  assert.equal(mesadas.length, 4, 'la mesada queda partida alrededor del hueco');
  assert.equal(bb.hardware.calado, 1);
  const cut = computeCutList(buildAll(p, mergeSettings({})));
  assert.equal(cut.hardware.calado, 1);
});

test('el anafe también cala; si no está apoyado sobre una mesada, no', () => {
  const bajo = mod('b', 'bajo', 0, 0, 0);
  const anafe = mod('a', 'anafe', 7, 20, 890);
  assert.equal(cutoutsFor([bajo, anafe]).b.length, 1);
  assert.deepEqual(cutoutsFor([bajo, { ...anafe, y: 1500 }]), {});
});

test('tapa p/ bacha: la piedra queda calada donde va la bacha', () => {
  const b = buildModule({ type: 'tapa', params: { ...MODULE_TYPES.tapa.defaults, bachas: 1 } }, { t: 18, tf: 18 });
  assert.ok(b.decors.filter((d) => d.decor === 'mesada').length >= 4);
  assert.equal(b.hardware.calado, 1);
});
