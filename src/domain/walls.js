// Paredes como grafo: vértices compartidos (`nodes`) + tramos (`walls`, n0 → n1).
// Las cadenas pueden ser abiertas (p. ej. 2 paredes) o cerradas. El espesor de
// cada pared crece hacia su normal n = (uz, -ux), que en un contorno de área
// positiva apunta hacia afuera del ambiente.

let seq = 0;
export const rid = (p = 'r') => `${p}${Date.now().toString(36)}${(seq++).toString(36)}`;

export const WALL_DEFAULTS = { floorGap: 0, movable: false, lowered: false, transparent: false, visible: true };

export function signedArea(points) {
  let a = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, z1] = points[i], [x2, z2] = points[(i + 1) % points.length];
    a += x1 * z2 - x2 * z1;
  }
  return a / 2;
}

// Contorno cerrado de puntos → vértices y paredes (pared i = punto i → punto i+1).
// Reutiliza ids y propiedades de `prev` por índice (para que aberturas y ajustes
// sobrevivan a un cambio de forma). Si el contorno está en sentido negativo se
// invierte el orden de los puntos, así el espesor queda siempre hacia afuera y
// vértices, paredes y contorno quedan en el mismo orden.
export function fromPoints(points0, { t, h }, prev = { nodes: [], walls: [] }) {
  const flipped = signedArea(points0) < 0;
  const points = flipped ? [...points0].reverse() : points0;
  const nodes = points.map(([x, z], i) => ({ id: prev.nodes[i]?.id ?? rid('n'), x, z }));
  const walls = nodes.map((n, i) => {
    const old = prev.walls[i];
    const base = old ? { ...old } : { id: rid('w'), t, h0: h, h1: h, ...WALL_DEFAULTS };
    return { ...base, n0: n.id, n1: nodes[(i + 1) % nodes.length].id };
  });
  return { nodes, walls, flipped };
}

// Con el contorno invertido, el tramo original i (p[i] → p[i+1]) pasa a ser el
// tramo (n - 2 - i) mod n, recorrido al revés.
export const flippedIndex = (i, n) => (((n - 2 - i) % n) + n) % n;

const nodeMap = (room) => new Map(room.nodes.map((n) => [n.id, n]));

export function wallGeometry(room) {
  const nm = nodeMap(room);
  return room.walls.map((w, i) => {
    const A = nm.get(w.n0), B = nm.get(w.n1);
    const a = [A.x, A.z], b = [B.x, B.z];
    const dx = b[0] - a[0], dz = b[1] - a[1];
    const len = Math.hypot(dx, dz) || 1;
    const u = [dx / len, dz / len];
    return { i, id: w.id, n0: w.n0, n1: w.n1, a, b, len: Math.round(len), u, n: [u[1], -u[0]], t: w.t, h: Math.max(w.h0, w.h1), wall: w };
  });
}

// Contornos cerrados, siguiendo n0 → n1. Devuelve listas de puntos.
export function wallLoops(room) {
  const nm = nodeMap(room);
  const byStart = new Map();
  for (const w of room.walls) if (!byStart.has(w.n0)) byStart.set(w.n0, w);
  const used = new Set();
  const loops = [];
  for (const w0 of room.walls) {
    if (used.has(w0.id)) continue;
    const ids = [];
    let w = w0;
    while (w && !used.has(w.id)) { used.add(w.id); ids.push(w.n0); w = byStart.get(w.n1); }
    if (w === w0 && ids.length >= 3) loops.push(ids.map((id) => [nm.get(id).x, nm.get(id).z]));
  }
  return loops;
}

export const outline = (room) => wallLoops(room)[0] ?? null;

export function bounds(room) {
  const xs = room.nodes.map((n) => n.x), zs = room.nodes.map((n) => n.z);
  if (!xs.length) return { minX: 0, minZ: 0, maxX: 0, maxZ: 0 };
  return { minX: Math.min(...xs), minZ: Math.min(...zs), maxX: Math.max(...xs), maxZ: Math.max(...zs) };
}

// Piso: el contorno si las paredes cierran; si no, el rectángulo envolvente.
export function floorPolygon(room) {
  const o = outline(room);
  if (o) return o;
  const { minX, minZ, maxX, maxZ } = bounds(room);
  return [[minX, minZ], [maxX, minZ], [maxX, maxZ], [minX, maxZ]];
}

// Vértices donde se unen exactamente dos paredes. `incoming` termina en el vértice,
// `outgoing` empieza en él (si la orientación es inconsistente, se toman en orden).
export function wallCorners(room) {
  const geo = wallGeometry(room);
  const at = new Map();
  for (const g of geo) for (const id of [g.n0, g.n1]) at.set(id, [...(at.get(id) || []), g]);
  const out = [];
  for (const [nodeId, gs] of at) {
    if (gs.length !== 2) continue;
    const outgoing = gs.find((g) => g.n0 === nodeId) ?? gs[1];
    const incoming = gs.find((g) => g !== outgoing);
    out.push({ nodeId, incoming, outgoing });
  }
  return out;
}
