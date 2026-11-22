import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MODULE_TYPES, buildModule } from '../src/domain/modules.js';
import { frontsOf, frontTransforms, invertHinge, DOOR_ANGLE } from '../src/domain/fronts.js';

const ctx = { t: 18, tf: 18, tb: 3 };
const mod = (type, params = {}) => ({ id: 'm', type, params: { ...MODULE_TYPES[type].defaults, ...params } });
const build = (m) => buildModule(m, ctx);

test('frentes del módulo: dos puertas con bisagras hacia afuera; cajones aparte', () => {
  const f = frontsOf(build(mod('bajo_mixto')));
  assert.deepEqual(f.map((x) => [x.kind, x.hinge]), [['drawer', undefined], ['door', 'izq'], ['door', 'der']]);
});

test('todas las piezas del cajón (y su tirador) se mueven juntas', () => {
  const b = build(mod('bajo_cajones'));
  const k0 = b.parts.filter((p) => p.front === 0).map((p) => p.name);
  assert.ok(['Frente cajón', 'Lateral cajón', 'Contrafrente cajón', 'Trasero cajón', 'Fondo cajón'].every((n) => k0.includes(n)), k0.join(','));
  assert.ok(b.decors.some((d) => d.decor === 'manija' && d.front === 0));
});

test('abrir una puerta: gira sobre el canto de la bisagra; el cajón sale hacia adelante', () => {
  const b = build(mod('bajo_mixto'));
  const t = frontTransforms(b, { open: { 0: true, 1: true, 2: true } }, 560);
  const left = t.get(1), right = t.get(2), drawer = t.get(0);
  const fr = frontsOf(b);
  assert.equal(left.px, fr[1].x);
  assert.equal(right.px, fr[2].x + fr[2].w);
  assert.ok(Math.abs(left.angle + (DOOR_ANGLE * Math.PI) / 180) < 1e-9 && right.angle > 0);
  assert.ok(drawer.dz > 200 && drawer.dz < 560);
  assert.equal(frontTransforms(b, { open: {} }).size, 0);
});

test('abrir en cascada: solo cajones, escalonados (los de abajo salen más)', () => {
  const b = build(mod('bajo_cajones'));
  const t = frontTransforms(b, { cascade: true }, 560);
  const byY = frontsOf(b).sort((a, c) => c.y - a.y).map((f) => t.get(f.k).dz);
  assert.equal(byY.length, 3);
  assert.ok(byY[0] < byY[1] && byY[1] < byY[2], byY.join(','));
});

test('invertir la bisagra de una puerta y el tirador cambia de lado', () => {
  const m = mod('alacena_1p');
  const b = build(m);
  const m2 = invertHinge(m, b, 0);
  assert.deepEqual(m2.params.hinges, { 0: 'der' });
  const b2 = build(m2);
  assert.equal(frontsOf(b2)[0].hinge, 'der');
  const hx = (bb) => bb.decors.find((d) => d.decor === 'manija').x;
  assert.ok(hx(b2) < hx(b), 'el tirador pasa al lado opuesto de la bisagra');
});
