// Editor de paredes (Promob): Encuentro de paredes (canto o T), herramienta 30-40-50 y
// construir con referencia (empezar a una distancia medida sobre una pared existente).

import { wallGeometry } from './walls.js';
import { moveNode } from './wallEdit.js';

// Intersección de dos rectas (punto + dirección); null si son paralelas.
export function lineIntersection(p, u, q, v) {
  const den = u[0] * v[1] - u[1] * v[0];
  if (Math.abs(den) < 1e-9) return null;
  const t = ((q[0] - p[0]) * v[1] - (q[1] - p[1]) * v[0]) / den;
  return [p[0] + u[0] * t, p[1] + u[1] * t];
}

// Encuentro: la pared `movingId` (la que se mueve) llega a `targetId`.
// - 'canto': las dos terminan en la intersección y comparten el vértice (esquina).
// - 't': la que se mueve termina sobre la cara de la otra (la otra no cambia).
export function joinWalls(room, movingId, targetId, mode = 'canto') {
  if (movingId === targetId) return room;
  const geo = wallGeometry(room);
  const m = geo.find((g) => g.id === movingId), t = geo.find((g) => g.id === targetId);
  if (!m || !t) return room;
  const P = lineIntersection(m.a, m.u, t.a, t.u);
  if (!P) return room;
  const d = (p) => Math.hypot(p[0] - P[0], p[1] - P[1]);
  const mEnd = d(m.a) <= d(m.b) ? m.n0 : m.n1;
  const R = (v) => Math.round(v);
  let r = moveNode(room, mEnd, R(P[0]), R(P[1]));
  if (mode !== 'canto') return r;
  const tEnd = d(t.a) <= d(t.b) ? t.n0 : t.n1;
  if (tEnd === mEnd) return r;
  r = moveNode(r, tEnd, R(P[0]), R(P[1]));
  // un solo vértice para la esquina: la pared destino usa el de la que se movió
  return {
    ...r,
    nodes: r.nodes.filter((n) => n.id !== tEnd),
    walls: r.walls.map((w) => ({ ...w, n0: w.n0 === tEnd ? mEnd : w.n0, n1: w.n1 === tEnd ? mEnd : w.n1 })),
  };
}

// 30-40-50: con A medido sobre una pared desde la esquina, B sobre la otra y C entre esas dos
// marcas, el ángulo de la esquina (ley del coseno). 300, 400, 500 → 90°.
export function angleFrom304050(A, B, C) {
  const c = (A * A + B * B - C * C) / (2 * A * B);
  if (!Number.isFinite(c) || c < -1 || c > 1) return null;
  return Math.round(((Math.acos(c) * 180) / Math.PI) * 100) / 100;
}

// Construir con referencia: punto sobre la cara interior de una pared, a `dist` mm de su inicio.
export function pointOnWall(room, wallId, dist) {
  const g = wallGeometry(room).find((w) => w.id === wallId);
  if (!g) return null;
  const s = Math.max(0, Math.min(g.len, dist));
  return [Math.round(g.a[0] + g.u[0] * s), Math.round(g.a[1] + g.u[1] * s)];
}

// Bloquear ángulo: el punto del mouse se proyecta sobre la dirección trabada (grados en planta).
export function projectOnAngle(from, to, absDeg) {
  const a = (absDeg * Math.PI) / 180;
  const d = [Math.cos(a), -Math.sin(a)];
  const l = Math.max(0, (to[0] - from[0]) * d[0] + (to[1] - from[1]) * d[1]);
  return { len: Math.round(l), point: [from[0] + d[0] * l, from[1] + d[1] * l] };
}
