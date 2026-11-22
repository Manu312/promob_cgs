// Construir paredes (herramienta de dibujo) y plantillas de ambiente.
// Ángulos como en el panel de pared: el primer tramo usa el absoluto (0 = hacia +x en
// planta); los siguientes el relativo a la pared anterior (90 = dobla a la derecha en
// pantalla, o sea se dibuja en sentido horario y el espesor queda hacia afuera).

import { normalizeRoom, shapePoints, ROOM_DEFAULTS } from './room.js';
import { rid, fromPoints, WALL_DEFAULTS } from './walls.js';

const r3 = (v) => Math.round(v * 1000) / 1000;

export function segmentEnd(p, len, absDeg) {
  const t = (absDeg * Math.PI) / 180;
  return [p[0] + Math.cos(t) * len, p[1] - Math.sin(t) * len];
}

const degree = (room, id) => room.walls.filter((w) => w.n0 === id || w.n1 === id).length;

// { nodeId } o { point }: un punto a menos de `tol` de una esquina libre (< 2 paredes) se une a ella.
function resolve(room, ref, tol, nodes) {
  if (ref.nodeId) return { id: ref.nodeId, created: false };
  const [x, z] = ref.point;
  const hit = nodes.find((n) => Math.hypot(n.x - x, n.z - z) <= tol && degree(room, n.id) < 2);
  if (hit) return { id: hit.id, created: false };
  const n = { id: rid('n'), x: r3(x), z: r3(z) };
  nodes.push(n);
  return { id: n.id, created: true };
}

// Agrega un tramo. `closed` = terminó sobre una esquina existente (cerró el ambiente o se unió a otra cadena).
export function addWall(room, from, to, { tol = 1 } = {}) {
  const nodes = [...room.nodes];
  const a = resolve(room, from, tol, nodes);
  const b = resolve(room, to, tol, nodes);
  if (a.id === b.id) return { room, startNodeId: a.id, endNodeId: b.id, closed: false };
  const wall = { id: rid('w'), n0: a.id, n1: b.id, t: room.t, h0: room.h, h1: room.h, ...WALL_DEFAULTS };
  return { room: normalizeRoom({ ...room, shape: 'libre', nodes, walls: [...room.walls, wall] }), startNodeId: a.id, endNodeId: b.id, closed: !b.created };
}

// Dibuja tramos con medidas: [{ len, angle }] para el primero y [{ len, rel }] para los siguientes.
export function drawWalls(room, start, segments) {
  let r = room, from = { point: start }, prevAbs = null, closed = false;
  for (const s of segments) {
    const abs = prevAbs == null ? (s.angle ?? 0) : prevAbs + ((s.rel ?? 180) - 180);
    const p0 = from.nodeId ? (({ x, z }) => [x, z])(r.nodes.find((n) => n.id === from.nodeId)) : from.point;
    const res = addWall(r, from, { point: segmentEnd(p0, s.len, abs) });
    r = res.room;
    from = { nodeId: res.endNodeId };
    prevAbs = abs;
    if (res.closed) { closed = true; break; }
  }
  return { room: r, closed };
}

export const TEMPLATES = [['dos', '2 paredes en L'], ['rect', 'Rectangular'], ['L', 'En L'], ['U', 'En U']];

// Ambiente desde plantilla. `base` aporta alto/espesor por defecto, grilla, alturas de referencia, columnas.
export function roomTemplate(kind, dims = {}, base = {}) {
  const w = dims.w ?? 3600, d = dims.d ?? 3000;
  const t = base.t ?? ROOM_DEFAULTS.t, h = base.h ?? ROOM_DEFAULTS.h;
  const common = { ...ROOM_DEFAULTS, ...base, version: 2, openings: [] };
  if (kind === 'rect' || kind === 'L') {
    const pts = shapePoints({ shape: kind, w, d, cutW: dims.cutW ?? 1200, cutD: dims.cutD ?? 1200 });
    const { nodes, walls } = fromPoints(pts, { t, h });
    return normalizeRoom({ ...common, shape: kind, cutW: dims.cutW ?? common.cutW, cutD: dims.cutD ?? common.cutD, nodes, walls });
  }
  // Cadenas abiertas, recorridas en sentido horario (espesor hacia afuera).
  const pts = kind === 'U' ? [[0, d], [0, 0], [w, 0], [w, d]] : [[0, d], [0, 0], [w, 0]];
  const nodes = pts.map(([x, z]) => ({ id: rid('n'), x, z }));
  const walls = nodes.slice(1).map((n, i) => ({ id: rid('w'), n0: nodes[i].id, n1: n.id, t, h0: h, h1: h, ...WALL_DEFAULTS }));
  return normalizeRoom({ ...common, shape: 'libre', nodes, walls });
}

// Reemplaza las paredes por una plantilla (las aberturas se quitan; el resto de la configuración queda).
export const applyTemplate = (room, kind, dims) => roomTemplate(kind, dims, room);
