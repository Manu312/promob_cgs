// Ambiente v2: paredes como grafo (ver walls.js) + aberturas por pared + columnas.
// Coordenadas: x → derecha, z → hacia el observador, en mm.
// Campos derivados (se recalculan siempre en normalizeRoom): `points` (contorno
// cerrado o null), `w` y `d` (extremos máximos en x y z).

import { rid, signedArea, fromPoints, flippedIndex, wallGeometry, outline, bounds, WALL_DEFAULTS } from './walls.js';

export { rid, signedArea };

export const ROOM_DEFAULTS = {
  version: 2,
  shape: 'rect', // forma del editor numérico (rect / L / libre)
  h: 2600, // alto por defecto de paredes nuevas
  t: 150, // espesor por defecto de paredes nuevas
  cutW: 1200,
  cutD: 1200,
  nodes: [],
  walls: [],
  openings: [],
  columns: [],
  refHeights: [100, 820, 1470, 2010, 2280],
  grid: { size: 50, magnetic: true },
  draw: { linear: 50, angular: 5 },
  floor: { auto: true },
};

const V1_DEFAULTS = { shape: 'rect', w: 3600, d: 3000, h: 2600, t: 150, cutW: 1200, cutD: 1200 };

export const OPENING_TYPES = {
  ventana: { label: 'Ventana', width: 1200, height: 1100, sill: 1000 },
  puerta: { label: 'Puerta', width: 800, height: 2050, sill: 0 },
  paso: { label: 'Paso / vano', width: 900, height: 2100, sill: 0 },
};

// Puntos del contorno según la forma del editor numérico.
export function shapePoints(r) {
  const { w, d } = r;
  if (r.shape === 'L') {
    const cw = Math.min(Math.max(r.cutW, 100), w - 100), cd = Math.min(Math.max(r.cutD, 100), d - 100);
    return [[0, 0], [w, 0], [w, d - cd], [w - cw, d - cd], [w - cw, d], [0, d]];
  }
  // Puntos libres: pueden ser negativos (paredes arrastradas fuera del origen).
  if (r.shape === 'libre' && Array.isArray(r.points) && r.points.length >= 3) return r.points.map(([x, z]) => [+x || 0, +z || 0]);
  return [[0, 0], [w, 0], [w, d], [0, d]];
}

const segLen = (pts, i) => { const a = pts[i], b = pts[(i + 1) % pts.length]; return Math.hypot(b[0] - a[0], b[1] - a[1]); };

// v1 (polígono `points`/`shape` + aberturas con índice de pared) → v2. Idempotente.
export function migrateRoom(r0) {
  if (r0?.version === 2) return r0;
  const r = { ...V1_DEFAULTS, ...(r0 || {}) };
  const pts = shapePoints(r);
  const { nodes, walls, flipped } = fromPoints(pts, { t: r.t, h: r.h });
  const openings = (Array.isArray(r.openings) ? r.openings : [])
    .filter((o) => walls[o.wall])
    .map(({ wall, ...o }) => (flipped
      ? { ...o, wallId: walls[flippedIndex(wall, pts.length)].id, offset: segLen(pts, wall) - (o.offset || 0) - o.width }
      : { ...o, wallId: walls[wall].id }));
  return {
    ...ROOM_DEFAULTS,
    shape: r.shape, h: r.h, t: r.t, cutW: r.cutW, cutD: r.cutD,
    nodes, walls, openings,
    columns: Array.isArray(r.columns) ? r.columns : [],
  };
}

export function normalizeRoom(r0) {
  const m = migrateRoom(r0 || {});
  const room = { ...ROOM_DEFAULTS, ...m };
  room.nodes = Array.isArray(room.nodes) ? room.nodes : [];
  const ids = new Set(room.nodes.map((n) => n.id));
  room.walls = (Array.isArray(room.walls) ? room.walls : [])
    .filter((w) => ids.has(w.n0) && ids.has(w.n1) && w.n0 !== w.n1)
    .map((w) => ({ ...WALL_DEFAULTS, t: room.t, h0: room.h, h1: w.h0 ?? room.h, ...w }));
  room.columns = Array.isArray(room.columns) ? room.columns : [];
  const geo = new Map(wallGeometry(room).map((g) => [g.id, g]));
  room.openings = (Array.isArray(room.openings) ? room.openings : [])
    .map(({ wall, ...o }) => ({ ...o, wallId: o.wallId ?? room.walls[wall]?.id }))
    .filter((o) => geo.has(o.wallId))
    .map((o) => {
      const g = geo.get(o.wallId);
      const width = Math.min(Math.max(o.width, 100), g.len);
      const height = Math.min(Math.max(o.height, 100), g.h);
      const sill = Math.min(Math.max(o.sill || 0, 0), g.h - height);
      return { ...o, width, height, sill, offset: Math.min(Math.max(o.offset || 0, 0), g.len - width) };
    });
  const b = bounds(room);
  return { ...room, points: outline(room), w: b.maxX, d: b.maxZ };
}

export const roomWalls = (room) => wallGeometry(room);

// Editor numérico: regenera las paredes desde la forma (rect / L / libre) conservando
// ids y propiedades de pared por índice, así las aberturas siguen en su pared.
export function rebuildFromShape(room, patch) {
  const r = { ...room, ...patch };
  if (r.shape === 'libre' && !Array.isArray(patch.points)) r.points = room.points || shapePoints({ ...r, shape: 'rect' });
  const { nodes, walls } = fromPoints(shapePoints(r), { t: room.t, h: room.h }, room);
  return normalizeRoom({ ...r, nodes, walls });
}

export function setWallDefaults(room, { h = room.h, t = room.t }) {
  return normalizeRoom({ ...room, h, t, walls: room.walls.map((w) => ({ ...w, h0: h, h1: h, t })) });
}

// Trozos macizos de una pared con aberturas, en coordenadas de la pared:
// u a lo largo (0..len), v vertical (0..h).
export function wallPieces(len, h, openings) {
  const ops = [...openings].sort((a, b) => a.offset - b.offset);
  const pieces = [];
  let u = 0;
  for (const o of ops) {
    const u0 = Math.max(o.offset, u), u1 = o.offset + o.width;
    if (u0 > u) pieces.push({ u0: u, u1: u0, v0: 0, v1: h });
    if (u1 > u0) {
      if (o.sill > 0) pieces.push({ u0, u1, v0: 0, v1: o.sill });
      if (o.sill + o.height < h) pieces.push({ u0, u1, v0: o.sill + o.height, v1: h });
    }
    u = Math.max(u, u1);
  }
  if (u < len) pieces.push({ u0: u, u1: len, v0: 0, v1: h });
  return pieces.filter((p) => p.u1 - p.u0 > 0.5 && p.v1 - p.v0 > 0.5);
}

// Posiciones a las que se "pega" la huella de un módulo (fw × fd):
// paredes alineadas a los ejes y caras de columnas.
export function snapCandidates(room, fw, fd) {
  const xs = [], zs = [];
  for (const w of roomWalls(room)) {
    if (Math.abs(w.u[0]) < 1e-6) { // pared vertical en planta (corre en z)
      const x = w.a[0];
      xs.push(w.n[0] < 0 ? x : x - fw);
    } else if (Math.abs(w.u[1]) < 1e-6) { // pared horizontal (corre en x)
      const z = w.a[1];
      zs.push(w.n[1] < 0 ? z : z - fd);
    }
  }
  for (const c of room.columns || []) {
    xs.push(c.x + c.w, c.x - fw);
    zs.push(c.z + c.d, c.z - fd);
  }
  return { xs, zs };
}

export function pointInPolygon([x, z], pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, zi] = pts[i], [xj, zj] = pts[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}
