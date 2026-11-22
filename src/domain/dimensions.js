// Cotas de referencia de un módulo: distancia libre desde cada cara (±x, ±z) hasta lo
// más cercano (pared, columna u otro módulo que se cruce en altura). Todo en mm, en planta.

import { roomWalls } from './room.js';
import { footprint } from './modules.js';

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
    if (o.id === mod.id) continue;
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

// Nueva posición del módulo para que la cota `dim` valga `value`.
export function applyDimEdit(mod, dim, value) {
  const d = DIRS.find(([k]) => k === dim.dir)[1];
  const delta = value - dim.dist;
  return { x: Math.round(mod.x - d[0] * delta), z: Math.round(mod.z - d[1] * delta) };
}
