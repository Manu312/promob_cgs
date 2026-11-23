import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guestKind, canHost, snapGuest, findHost, syncGuests, nicheOf, toWorld, toLocal, insideHost, detach, linkedIds } from '../src/domain/encastre.js';
import { MODULE_TYPES, buildModule, DEFAULT_RULES, footprint } from '../src/domain/modules.js';

const mod = (id, type, extra = {}, params = {}) => ({ id, type, params: { ...MODULE_TYPES[type].defaults, ...params }, x: 0, z: 0, y: MODULE_TYPES[type].y ?? 0, rot: 0, mats: {}, ...extra });
const ctx = { t: 18, tf: 18, rules: DEFAULT_RULES };
const built = (m) => buildModule(m, ctx);
const centerOf = (m) => { const { fw, fd } = footprint(m); return [m.x + fw / 2, m.z + fd / 2]; };

test('qué artefacto va dónde', () => {
  assert.equal(guestKind(mod('b', 'bacha')), 'top');
  assert.equal(guestKind(mod('h', 'horno')), 'niche');
  assert.equal(guestKind(mod('x', 'bajo')), null);
  const bb = mod('bb', 'bajo_bacha');
  assert.equal(canHost(bb, mod('b', 'bacha'), built(bb)), true, 'bajo con mesada recibe la bacha');
  const torre = mod('t', 'torre_horno');
  assert.equal(canHost(torre, mod('h', 'horno'), built(torre)), true, 'torre con hueco recibe el horno');
  assert.equal(canHost(torre, mod('b', 'bacha'), built(torre)), false);
  assert.equal(canHost(bb, mod('h', 'horno'), built(bb)), false, 'un bajo sin hueco no recibe el horno');
});

test('coordenadas del mueble ida y vuelta, también girado', () => {
  for (const rot of [0, 90, 180, 270]) {
    const h = mod('h', 'bajo', { x: 1000, z: 500, rot });
    const [wx, wz] = toWorld(h, 100, 200);
    const [lx, lz] = toLocal(h, wx, wz);
    assert.deepEqual([Math.round(lx), Math.round(lz)], [100, 200], `rot ${rot}`);
  }
  const h = mod('h', 'bajo', { x: 1000, z: 0 });
  assert.equal(insideHost(h, 1300, 200), true);
  assert.equal(insideHost(h, 900, 200), false);
});

test('bacha: centrada sobre la mesada (la cala) y enganchada', () => {
  const bb = mod('bb', 'bajo_bacha', { x: 1200 });
  const g = snapGuest(mod('b', 'bacha', { x: 3000 }), bb, built(bb));
  assert.equal(g.hostId, 'bb');
  assert.deepEqual(centerOf(g).map(Math.round), centerOf(bb).map(Math.round));
  assert.equal(g.y, bb.params.height + bb.params.mesadaT);
});

test('horno: en el hueco de la torre, frente al ras', () => {
  const t = mod('t', 'torre_horno', { x: 0 });
  const bt = built(t);
  const n = nicheOf(t, bt);
  assert.ok(n && n.h >= 595);
  const g = snapGuest(mod('h', 'horno'), t, bt);
  assert.equal(g.y, n.y0);
  assert.ok(Math.abs(centerOf(g)[0] - centerOf(t)[0]) <= 1, 'centrado (al mm)');
  assert.equal(g.z, t.z, 'más profundo que la torre: al ras del fondo, no se mete en la pared');
  const chico = snapGuest(mod('m', 'microondas'), t, bt);
  if (chico.params.depth <= t.params.depth) assert.equal(chico.z + chico.params.depth, t.z + t.params.depth, 'si entra, frente al ras');
});

test('horno y microondas en la misma torre: se apilan', () => {
  const t = mod('t', 'torre_horno');
  const h = snapGuest(mod('h', 'horno'), t, built(t));
  const mw = snapGuest(mod('m', 'microondas'), t, built(t), [t, h]);
  assert.equal(mw.y, h.y + h.params.height);
});

test('el artefacto acompaña al mueble: mover, girar, borrar', () => {
  const t = mod('t', 'torre_horno', { x: 0 });
  const h = snapGuest(mod('h', 'horno'), t, built(t));
  let p = { modules: [t, h] };
  const moved = { modules: [{ ...t, x: 800, z: 100 }, h] };
  p = syncGuests(p, moved);
  const h2 = p.modules.find((m) => m.id === 'h');
  assert.deepEqual([h2.x - h.x, h2.z - h.z], [800, 100]);
  const rotated = syncGuests(p, { modules: [{ ...p.modules[0], rot: 90 }, h2] });
  assert.equal(rotated.modules.find((m) => m.id === 'h').rot, 90);
  assert.ok(insideHost(rotated.modules[0], ...centerOf(rotated.modules.find((m) => m.id === 'h'))), 'sigue adentro del mueble girado');
  const gone = syncGuests(p, { modules: [h2] });
  assert.equal(gone.modules.length, 0, 'si se borra el mueble, el horno se va con él');
});

test('mover el artefacto solo: adentro ajusta su lugar; afuera se desengancha', () => {
  const bb = mod('bb', 'bajo_bacha', { x: 1200 });
  const b = snapGuest(mod('b', 'bacha'), bb, built(bb));
  const p = { modules: [bb, b] };
  const inside = syncGuests(p, { modules: [bb, { ...b, x: b.x + 30 }] }).modules[1];
  assert.equal(inside.hostId, 'bb');
  assert.equal(Math.round(inside.hostLocal.lx), Math.round(b.hostLocal.lx + 30));
  const out = syncGuests(p, { modules: [bb, { ...b, x: b.x + 3000 }] }).modules[1];
  assert.equal(out.hostId, undefined);
  assert.equal(detach(b).hostLocal, undefined);
});

test('buscar el mueble debajo y los módulos enganchados', () => {
  const bb = mod('bb', 'bajo_bacha', { x: 1200 });
  const t = mod('t', 'torre_horno', { x: 0 });
  const byId = new Map([[bb.id, built(bb)], [t.id, built(t)]]);
  assert.equal(findHost(mod('b', 'bacha', { x: 1250, z: 40 }), [t, bb], byId)?.id, 'bb');
  assert.equal(findHost(mod('h', 'horno', { x: 0, z: 0 }), [t, bb], byId)?.id, 't');
  assert.equal(findHost(mod('b', 'bacha', { x: 5000 }), [t, bb], byId), null);
  const g = snapGuest(mod('h', 'horno'), t, built(t));
  assert.deepEqual(linkedIds([t, bb, g], 't').sort(), ['h']);
  assert.deepEqual(linkedIds([t, bb, g], 'h').sort(), ['t']);
});
