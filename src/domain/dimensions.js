// Cotas de referencia de un módulo: distancia libre desde cada cara (±x, ±z) hasta lo
// más cercano (pared, columna u otro módulo que se cruce en altura). Todo en mm, en planta.

import { roomWalls } from './room.js';
import { footprint, localAxes } from './modules.js';
import { modulePoly, overlaps } from './collision.js';
import { wallAngles, wallCorners } from './walls.js';

const DIRS = [['-x', [-1, 0]], ['+x', [1, 0]], ['-z', [0, -1]], ['+z', [0, 1]]];

// Rayo p + t·d contra el segmento a–b: devuelve t ≥ 0 o null.
function raySeg(p, d, a, b) {
  const ex = b[0] - a[0], ez = b[1] - a[1];
  const den = d[0] * ez - d[1] * ex;
  if (Math.abs(den) < 1e-9) return null;
  const qx = a[0] - p[0], qz = a[1] - p[1];
  const t = (qx * ez - qz * ex) / den;
  const s = (qx * d[1] - qz * d[0]) / den;
  if (s < -1e-9 || s > 1 + 1e-9 || t < -1e-6) return null;
  return Math.max(0, t);
}

const rectSegs = (x0, z0, x1, z1) => [[[x0, z0], [x1, z0]], [[x1, z0], [x1, z1]], [[x1, z1], [x0, z1]], [[x0, z1], [x0, z0]]];

export function nearestDistances(mod, room, modules, maxDist = 20000) {
  const { fw, fd } = footprint(mod);
  const x0 = mod.x, z0 = mod.z, x1 = x0 + fw, z1 = z0 + fd;
  const y0 = mod.y || 0, y1 = y0 + mod.params.height;

  const obstacles = roomWalls(room).map((g) => ({ target: { kind: 'wall', id: g.id }, segs: [[g.a, g.b]] }));
  for (const c of room.columns || []) obstacles.push({ target: { kind: 'column', id: c.id }, segs: rectSegs(c.x, c.z, c.x + c.w, c.z + c.d) });
  for (const o of modules) {
    if (o.id === mod.id || o.hidden) continue;
    const oy0 = o.y || 0, oy1 = oy0 + o.params.height;
    if (oy0 >= y1 || oy1 <= y0) continue; // a otra altura: no estorba
    const f = footprint(o);
    obstacles.push({ target: { kind: 'module', id: o.id }, segs: rectSegs(o.x, o.z, o.x + f.fw, o.z + f.fd) });
  }

  const out = [];
  for (const [dir, d] of DIRS) {
    // Rayos desde la cara: el del centro primero (gana en empates, se dibuja centrado).
    const origins = d[0] !== 0
      ? [(z0 + z1) / 2, z0 + 1, z1 - 1].map((z) => [d[0] < 0 ? x0 : x1, z])
      : [(x0 + x1) / 2, x0 + 1, x1 - 1].map((x) => [x, d[1] < 0 ? z0 : z1]);
    let best = null;
    for (const o of origins) {
      for (const ob of obstacles) {
        for (const [a, b] of ob.segs) {
          const t = raySeg(o, d, a, b);
          if (t != null && t < maxDist && (!best || t < best.t)) best = { t, o, target: ob.target };
        }
      }
    }
    if (best && best.t >= 1) {
      out.push({ dir, dist: Math.round(best.t), from: best.o, to: [best.o[0] + d[0] * best.t, best.o[1] + d[1] * best.t], target: best.target });
    }
  }
  return out;
}

// Cotas verticales del módulo: hacia abajo, al piso o a la cara de arriba del módulo que
// tiene debajo (superpuesto en planta); hacia arriba, al techo o a la cara de abajo del
// módulo de arriba. `at` es la esquina delantera izquierda (donde se dibuja la cota).
export function verticalDistances(mod, room, modules) {
  const y0 = mod.y || 0, y1 = y0 + mod.params.height;
  const poly = modulePoly(mod);
  let below = { y: 0, target: { kind: 'floor' } }, above = { y: room.h, target: { kind: 'ceiling' } };
  for (const o of modules) {
    if (o.id === mod.id || o.hidden || !overlaps(poly, modulePoly(o))) continue;
    const oy0 = o.y || 0, oy1 = oy0 + o.params.height;
    if (oy1 <= y0 + 0.5 && oy1 > below.y) below = { y: oy1, target: { kind: 'module', id: o.id } };
    if (oy0 >= y1 - 0.5 && oy0 < above.y) above = { y: oy0, target: { kind: 'module', id: o.id } };
  }
  const { fw, fd } = footprint(mod);
  const { ex, ez } = localAxes(mod.rot || 0);
  const W = mod.params.width / 2, D = mod.params.depth / 2;
  const at = [mod.x + fw / 2 - ex[0] * W + ez[0] * D, mod.z + fd / 2 - ex[1] * W + ez[1] * D];
  const out = [];
  if (y0 - below.y >= 1) out.push({ dir: 'down', dist: Math.round(y0 - below.y), at, y0: below.y, y1: y0, target: below.target });
  if (above.y - y1 >= 1) out.push({ dir: 'up', dist: Math.round(above.y - y1), at, y0: y1, y1: above.y, target: above.target });
  return out;
}

// Nueva posición del módulo para que la cota `dim` valga `value`.
export function applyDimEdit(mod, dim, value) {
  if (dim.dir === 'down' || dim.dir === 'up') {
    const dy = (value - dim.dist) * (dim.dir === 'down' ? 1 : -1);
    return { y: Math.max(0, Math.round((mod.y || 0) + dy)) };
  }
  const d = DIRS.find(([k]) => k === dim.dir)[1];
  const delta = value - dim.dist;
  return { x: Math.round(mod.x - d[0] * delta), z: Math.round(mod.z - d[1] * delta) };
}

// Cotas automáticas de paredes: lineal por pared (largo interior) y angular en cada
// esquina donde se unen dos paredes (se omiten los 180°). El arco y la etiqueta van del
// lado interior; `wallId` es la pared que sale de la esquina (editar el ángulo la gira).
export function wallDims(room, { arcR = 250, labelR = 420, steps = 16 } = {}) {
  const geo = roomWalls(room);
  const linear = geo.map((g) => ({ wallId: g.id, len: g.len, a: g.a, b: g.b, n: g.n }));
  const ang = new Map(wallAngles(room).map((a) => [a.id, a]));
  const rot = (v, deg) => { const t = (deg * Math.PI) / 180, c = Math.cos(t), s = Math.sin(t); return [v[0] * c - v[1] * s, v[0] * s + v[1] * c]; };
  const angular = [];
  for (const { nodeId, incoming: inc, outgoing: out } of wallCorners(room)) {
    const a = ang.get(out.id);
    if (out.n0 !== nodeId || inc.n1 !== nodeId || a?.rel == null || Math.abs(a.rel - 180) < 0.01) continue;
    const va = [-inc.u[0], -inc.u[1]], deg = a.rel;
    const miss = (s) => { const r = rot(va, s * deg); return Math.hypot(r[0] - out.u[0], r[1] - out.u[1]); };
    const sgn = miss(1) <= miss(-1) ? 1 : -1;
    const at = out.a;
    const arc = Array.from({ length: steps + 1 }, (_, i) => { const r = rot(va, (sgn * deg * i) / steps); return [at[0] + r[0] * arcR, at[1] + r[1] * arcR]; });
    const mid = rot(va, (sgn * deg) / 2);
    angular.push({ nodeId, at, deg, wallId: out.id, arc, label: [at[0] + mid[0] * labelR, at[1] + mid[1] * labelR] });
  }
  return { linear, angular };
}

// Alturas: lista "100; 820 1470,…" → números positivos, ordenados y sin repetir.
export function parseHeights(input) {
  const list = Array.isArray(input) ? input : String(input).split(/[\s,;]+/);
  return [...new Set(list.map((v) => Math.round(Number(v))).filter((v) => Number.isFinite(v) && v > 0))].sort((a, b) => a - b);
}

// Regla de alturas de la vista Frente: alturas de referencia del ambiente + base y tope de
// cada módulo (sin el piso). Si coinciden, queda la de referencia.
export function heightRuler(room, modules) {
  const marks = new Map(parseHeights(room.refHeights || []).map((h) => [h, 'ref']));
  for (const m of modules) {
    const y = Math.round(m.y || 0);
    for (const h of [y, y + Math.round(m.params.height)]) if (h > 0 && !marks.has(h)) marks.set(h, 'mod');
  }
  return [...marks].sort((a, b) => a[0] - b[0]).map(([h, kind]) => ({ h, kind }));
}
