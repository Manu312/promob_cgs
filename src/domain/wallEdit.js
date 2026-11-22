// Ediciones de paredes desde el panel de propiedades. Devuelven el ambiente normalizado.

import { normalizeRoom } from './room.js';
import { wallGeometry, wallAngles, rid } from './walls.js';
import { footprint, localAxes } from './modules.js';

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

// Aplica posiciones nuevas a vértices. Tras una edición a mano el ambiente deja de ser
// una forma del editor numérico (rect / L): pasa a "libre" para no regenerarse encima.
function withMoves(room, moves) {
  return normalizeRoom({
    ...room,
    shape: 'libre',
    nodes: room.nodes.map((n) => (moves.has(n.id) ? { ...n, x: r3(moves.get(n.id)[0]), z: r3(moves.get(n.id)[1]) } : n)),
  });
}

const posFn = (room) => {
  const nodes = new Map(room.nodes.map((n) => [n.id, [n.x, n.z]]));
  return (id) => nodes.get(id);
};

// Lleva el final (n1) de la pared a `newEnd`. La pared siguiente se traslada con el
// mismo vector (conserva su ángulo) y su otro extremo se desliza sobre la pared que sigue.
function moveEnd(room, g, newEnd) {
  const geo = wallGeometry(room);
  const pos = posFn(room);
  const end = pos(g.n1);
  const d = [newEnd[0] - end[0], newEnd[1] - end[1]];
  const moves = new Map([[g.n1, newEnd]]);
  const next = otherAt(geo, g.n1, g.id);
  if (next) {
    const far = next.n0 === g.n1 ? next.n1 : next.n0;
    if (far !== g.n0) moves.set(far, slidEnd(geo, next, far, d, pos));
  }
  return withMoves(room, moves);
}

// Arrastrar una pared: se traslada (dx, dz) y cada extremo se desliza sobre la pared
// vecina de ese vértice, así las vecinas se estiran o acortan sin cambiar de ángulo.
export function moveWall(room, wallId, dx, dz) {
  const geo = wallGeometry(room);
  const g = geo.find((w) => w.id === wallId);
  if (!g || (!dx && !dz)) return room;
  const pos = posFn(room);
  return withMoves(room, new Map([g.n0, g.n1].map((id) => [id, slidEnd(geo, g, id, [dx, dz], pos)])));
}

// Arrastrar un vértice: las paredes que lo usan lo siguen.
export function moveNode(room, nodeId, x, z) {
  if (!room.nodes.some((n) => n.id === nodeId)) return room;
  return withMoves(room, new Map([[nodeId, [x, z]]]));
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

// Módulos "apoyados" en la pared: su cara trasera es paralela a la pared, está a ≤ `tol`
// de su cara interior y se superpone con su largo.
export function modulesOnWall(room, wallId, modules, tol = 20) {
  const g = wallGeometry(room).find((w) => w.id === wallId);
  if (!g) return [];
  return modules.filter((m) => {
    const { fw, fd } = footprint(m);
    const { ex, ez } = localAxes(m.rot || 0);
    if (Math.abs(ex[0] * g.n[0] + ex[1] * g.n[1]) > 0.01) return false; // no es paralela
    const back = [m.x + fw / 2 - ez[0] * (m.params.depth / 2), m.z + fd / 2 - ez[1] * (m.params.depth / 2)];
    if (Math.abs((back[0] - g.a[0]) * g.n[0] + (back[1] - g.a[1]) * g.n[1]) > tol) return false;
    const s = (p) => (p[0] - g.a[0]) * g.u[0] + (p[1] - g.a[1]) * g.u[1];
    const half = m.params.width / 2;
    const s0 = s([back[0] - ex[0] * half, back[1] - ex[1] * half]), s1 = s([back[0] + ex[0] * half, back[1] + ex[1] * half]);
    return Math.min(Math.max(s0, s1), g.len) - Math.max(Math.min(s0, s1), 0) > 1;
  }).map((m) => m.id);
}

// Eliminar paredes: 'tramo' (solo esta), 'todas', 'conservar' (todas menos esta).
// Se van también los vértices sueltos y las aberturas de esas paredes.
export function deleteWalls(room, wallId, mode, modules = [], { withModules = false } = {}) {
  const ids = new Set(mode === 'todas' ? room.walls.map((w) => w.id) : mode === 'conservar' ? room.walls.filter((w) => w.id !== wallId).map((w) => w.id) : [wallId]);
  const removedModuleIds = withModules ? [...new Set([...ids].flatMap((id) => modulesOnWall(room, id, modules)))] : [];
  const walls = room.walls.filter((w) => !ids.has(w.id));
  const used = new Set(walls.flatMap((w) => [w.n0, w.n1]));
  return {
    room: normalizeRoom({ ...room, shape: 'libre', walls, nodes: room.nodes.filter((n) => used.has(n.id)), openings: room.openings.filter((o) => !ids.has(o.wallId)) }),
    removedModuleIds,
  };
}

// Dividir una pared a `offset` mm de su inicio. El tramo nuevo hereda las propiedades; el alto
// se interpola en el corte y cada abertura queda en el tramo donde está su centro.
export function splitWall(room, wallId, offset) {
  const g = wallGeometry(room).find((w) => w.id === wallId);
  const len = g && Math.hypot(g.b[0] - g.a[0], g.b[1] - g.a[1]);
  if (!g || !(offset >= 1 && offset <= len - 1)) return { room };
  const cut = Math.round(offset);
  const node = { id: rid('n'), x: r3(g.a[0] + g.u[0] * cut), z: r3(g.a[1] + g.u[1] * cut) };
  const w = g.wall;
  const hm = Math.round(w.h0 + ((w.h1 - w.h0) * cut) / len);
  const w2 = { ...w, id: rid('w'), n0: node.id, h0: hm };
  const walls = room.walls.flatMap((x) => (x.id === wallId ? [{ ...x, n1: node.id, h1: hm }, w2] : [x]));
  const openings = room.openings.map((o) => (o.wallId === wallId && o.offset + o.width / 2 > cut ? { ...o, wallId: w2.id, offset: o.offset - cut } : o));
  return { room: normalizeRoom({ ...room, shape: 'libre', nodes: [...room.nodes, node], walls, openings }), newWallId: w2.id, nodeId: node.id };
}

export function updateWall(room, wallId, patch) {
  return normalizeRoom({ ...room, walls: room.walls.map((w) => (w.id === wallId ? { ...w, ...patch } : w)) });
}

// Al mover una pared, los módulos apoyados en ella la acompañan (mismo desplazamiento).
// Se calcula siempre desde el estado del comienzo del arrastre (`baseRoom`, `baseModules`);
// `current` son los módulos actuales (los que no están apoyados quedan como estén).
export function followWall(baseRoom, wallId, baseModules, dx, dz, current = baseModules) {
  const ids = new Set(modulesOnWall(baseRoom, wallId, baseModules));
  if (!ids.size) return current;
  const base = new Map(baseModules.map((m) => [m.id, m]));
  return current.map((m) => (ids.has(m.id) && base.has(m.id) ? { ...m, x: Math.round(base.get(m.id).x + dx) + 0, z: Math.round(base.get(m.id).z + dz) + 0 } : m));
}
