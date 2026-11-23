import { arcPoints, arcNormals } from './curvedWalls.js';
// Colisión entre módulos, paredes y columnas (como el interruptor "Colisión" de Promob).
// Cada objeto es un polígono convexo en planta (mm) más un rango de alto [y0, y1].
import { footprint, localAxes } from './modules.js';
import { roomWalls } from './room.js';

const TOL = 0.5; // tocarse no es chocar
const STEP = 40; // avance máximo por prueba: no atraviesa paredes ni módulos finos

// Rectángulo orientado del módulo (sigue a su rotación).
export function modulePoly(mod) {
  const { fw, fd } = footprint(mod);
  const c = [mod.x + fw / 2, mod.z + fd / 2];
  const { ex, ez } = localAxes(mod.rot || 0);
  const hw = mod.params.width / 2, hd = mod.params.depth / 2;
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz]) => [
    c[0] + ex[0] * hw * sx + ez[0] * hd * sz,
    c[1] + ex[1] * hw * sx + ez[1] * hd * sz,
  ]);
}

const rectPoly = (x0, z0, x1, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];

// Obstáculos para `mod`: paredes (con su espesor hacia afuera), columnas y los demás módulos.
export function obstaclesFor(mod, room, modules) {
  const out = [];
  for (const g of roomWalls(room)) {
    const t = g.t;
    if (g.wall.flecha) { // pared curva: un tramo de obstáculo por cada segmento del arco
      const pts = arcPoints(g.a, g.b, g.n, g.wall.flecha, 16);
      const ns = arcNormals(pts, g.n);
      for (let i = 0; i < pts.length - 1; i++) {
        const p = pts[i], q = pts[i + 1];
        out.push({ kind: 'wall', id: g.id, y0: 0, y1: Math.max(g.wall.h0 ?? room.h, g.wall.h1 ?? room.h), poly: [p, q, [q[0] + ns[i + 1][0] * t, q[1] + ns[i + 1][1] * t], [p[0] + ns[i][0] * t, p[1] + ns[i][1] * t]] });
      }
      continue;
    }
    out.push({
      kind: 'wall', id: g.id, y0: 0, y1: Math.max(g.wall.h0 ?? room.h, g.wall.h1 ?? room.h),
      poly: [g.a, g.b, [g.b[0] + g.n[0] * t, g.b[1] + g.n[1] * t], [g.a[0] + g.n[0] * t, g.a[1] + g.n[1] * t]],
    });
  }
  for (const c of room.columns || []) out.push({ kind: 'column', id: c.id, y0: 0, y1: room.h, poly: rectPoly(c.x, c.z, c.x + c.w, c.z + c.d) });
  for (const o of modules) {
    if (o.id === mod.id || o.hidden) continue; // oculto (Lista de módulos): no estorba
    const y0 = o.y || 0;
    out.push({ kind: 'module', id: o.id, y0, y1: y0 + o.params.height, poly: modulePoly(o) });
  }
  return out;
}

// Separación por ejes (SAT) entre dos polígonos convexos.
export function overlaps(A, B, tol = TOL) {
  for (const P of [A, B]) {
    for (let i = 0; i < P.length; i++) {
      const p = P[i], q = P[(i + 1) % P.length];
      const ax = [-(q[1] - p[1]), q[0] - p[0]];
      const len = Math.hypot(ax[0], ax[1]);
      if (len < 1e-9) continue;
      const proj = (Q) => {
        let lo = Infinity, hi = -Infinity;
        for (const v of Q) { const d = (v[0] * ax[0] + v[1] * ax[1]) / len; if (d < lo) lo = d; if (d > hi) hi = d; }
        return [lo, hi];
      };
      const [a0, a1] = proj(A), [b0, b1] = proj(B);
      if (Math.min(a1, b1) - Math.max(a0, b0) <= tol) return false;
    }
  }
  return true;
}

const yOverlap = (a0, a1, b0, b1) => Math.min(a1, b1) - Math.max(a0, b0) > TOL;

// ¿El módulo en esta posición choca con algún obstáculo?
export function hits(mod, obstacles) {
  const y0 = mod.y || 0, y1 = y0 + mod.params.height;
  const poly = modulePoly(mod);
  return obstacles.some((o) => yOverlap(y0, y1, o.y0, o.y1) && overlaps(poly, o.poly));
}

// Avanza en línea recta desde `cur` hacia `to` ([x, z]) y devuelve el último punto libre
// (en milímetros enteros), probando de a STEP mm y ajustando el contacto por bisección.
function sweep(cur, to, obs) {
  const dx = to[0] - cur.x, dz = to[1] - cur.z;
  const n = Math.ceil(Math.max(Math.abs(dx), Math.abs(dz)) / STEP);
  const at = (f) => ({ ...cur, x: Math.round(cur.x + dx * f) + 0, z: Math.round(cur.z + dz * f) + 0 }); // + 0: sin -0
  let lo = 0;
  for (let i = 1; i <= n; i++) {
    const f = i / n;
    if (!hits(at(f), obs)) { lo = f; continue; }
    let hi = f;
    while ((hi - lo) * Math.max(Math.abs(dx), Math.abs(dz)) > 1) {
      const mid = (lo + hi) / 2;
      if (hits(at(mid), obs)) hi = mid; else lo = mid;
    }
    break;
  }
  return at(lo);
}

// Lleva el módulo hacia (x, z) sin atravesar nada. Si el camino recto choca, se desliza:
// prueba x→z y z→x y se queda con el que llega más cerca (así corre a lo largo de una
// pared). Lo que ya estaba encimado al empezar no lo frena.
export function collideMove(mod, x, z, room, modules) {
  const obs = obstaclesFor(mod, room, modules).filter((o) => !hits(mod, [o]));
  const to = [Math.round(x), Math.round(z)];
  const direct = sweep(mod, to, obs);
  if (direct.x === to[0] && direct.z === to[1]) return { x: to[0], z: to[1] };
  const xz = sweep(sweep(mod, [to[0], mod.z], obs), to, obs);
  const zx = sweep(sweep(mod, [mod.x, to[1]], obs), to, obs);
  const dist = (p) => Math.hypot(p.x - to[0], p.z - to[1]);
  const best = [direct, xz, zx].reduce((a, b) => (dist(b) < dist(a) - 0.5 ? b : a));
  return { x: best.x, z: best.z };
}

// Subir o bajar el módulo hasta `y` sin meterse en el de arriba o el de abajo (ni bajo el piso).
export function collideLift(mod, y, room, modules) {
  const y0 = mod.y || 0, h = mod.params.height;
  let ny = Math.max(0, Math.round(y));
  const poly = modulePoly(mod);
  const obs = obstaclesFor(mod, room, modules).filter((o) => o.kind === 'module' && !hits(mod, [o]) && overlaps(poly, o.poly));
  for (const o of obs) {
    if (ny > y0 && o.y0 >= y0 + h - TOL) ny = Math.min(ny, o.y0 - h);
    if (ny < y0 && o.y1 <= y0 + TOL) ny = Math.max(ny, o.y1);
  }
  return Math.round(ny);
}
