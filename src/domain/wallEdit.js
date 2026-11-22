// Ediciones de paredes desde el panel de propiedades. Devuelven el ambiente normalizado.

import { normalizeRoom } from './room.js';
import { wallGeometry, wallAngles } from './walls.js';

const r3 = (v) => Math.round(v * 1000) / 1000;

// Intersección de las rectas p + t·d y q + s·e (null si son paralelas).
function intersect(p, d, q, e) {
  const den = d[0] * e[1] - d[1] * e[0];
  if (Math.abs(den) < 1e-9) return null;
  const t = ((q[0] - p[0]) * e[1] - (q[1] - p[1]) * e[0]) / den;
  return [p[0] + t * d[0], p[1] + t * d[1]];
}

// La única otra pared que toca el vértice (null si no hay o hay más de una).
function otherAt(geo, nodeId, exceptId) {
  const gs = geo.filter((g) => g.id !== exceptId && (g.n0 === nodeId || g.n1 === nodeId));
  return gs.length === 1 ? gs[0] : null;
}

// Posición nueva del extremo `nodeId` de la pared `g` cuando la pared se traslada `d`:
// se desliza sobre la recta de la otra pared de ese vértice (si no hay, o es paralela, se traslada).
function slidEnd(geo, g, nodeId, d, pos) {
  const p = pos(nodeId);
  const moved = [p[0] + d[0], p[1] + d[1]];
  const o = otherAt(geo, nodeId, g.id);
  return (o && intersect(moved, g.u, p, o.u)) || moved;
}

// Lleva el final (n1) de la pared a `newEnd`. La pared siguiente se traslada con el
// mismo vector (conserva su ángulo) y su otro extremo se desliza sobre la pared que sigue.
function moveEnd(room, g, newEnd) {
  const geo = wallGeometry(room);
  const nodes = new Map(room.nodes.map((n) => [n.id, [n.x, n.z]]));
  const pos = (id) => nodes.get(id);
  const end = pos(g.n1);
  const d = [newEnd[0] - end[0], newEnd[1] - end[1]];
  const moves = new Map([[g.n1, newEnd]]);
  const next = otherAt(geo, g.n1, g.id);
  if (next) {
    const far = next.n0 === g.n1 ? next.n1 : next.n0;
    if (far !== g.n0) moves.set(far, slidEnd(geo, next, far, d, pos));
  }
  return normalizeRoom({
    ...room,
    nodes: room.nodes.map((n) => (moves.has(n.id) ? { ...n, x: r3(moves.get(n.id)[0]), z: r3(moves.get(n.id)[1]) } : n)),
  });
}

export function setWallLength(room, wallId, length) {
  const g = wallGeometry(room).find((w) => w.id === wallId);
  if (!g || !(length > 0)) return room;
  return moveEnd(room, g, [g.a[0] + g.u[0] * length, g.a[1] + g.u[1] * length]);
}

// mode 'abs': ángulo en planta; 'rel': ángulo respecto de la pared anterior (ver wallAngles).
export function setWallAngle(room, wallId, deg, mode = 'abs') {
  const g = wallGeometry(room).find((w) => w.id === wallId);
  if (!g) return room;
  let abs = deg;
  if (mode === 'rel') {
    const angles = wallAngles(room);
    const me = angles.find((a) => a.id === wallId);
    if (me.rel == null) return room;
    abs = angles.find((a) => a.id === me.prevId).abs + (deg - 180);
  }
  const rad = (abs * Math.PI) / 180;
  const len = Math.hypot(g.b[0] - g.a[0], g.b[1] - g.a[1]);
  return moveEnd(room, g, [g.a[0] + Math.cos(rad) * len, g.a[1] - Math.sin(rad) * len]);
}

export function updateWall(room, wallId, patch) {
  return normalizeRoom({ ...room, walls: room.walls.map((w) => (w.id === wallId ? { ...w, ...patch } : w)) });
}
