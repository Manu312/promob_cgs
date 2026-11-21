// Ambiente: polígono de paredes (interior, en mm) con aberturas y columnas.
// Coordenadas: x → derecha, z → hacia el observador. El polígono se recorre en
// orden; cada lado i va del punto i al i+1 y es la "Pared i+1".

let seq = 0;
export const rid = (p = 'r') => `${p}${Date.now().toString(36)}${(seq++).toString(36)}`;

export const ROOM_DEFAULTS = { shape: 'rect', w: 3600, d: 3000, h: 2600, t: 150, cutW: 1200, cutD: 1200, points: null, openings: [], columns: [] };

export const OPENING_TYPES = {
  ventana: { label: 'Ventana', width: 1200, height: 1100, sill: 1000 },
  puerta: { label: 'Puerta', width: 800, height: 2050, sill: 0 },
  paso: { label: 'Paso / vano', width: 900, height: 2100, sill: 0 },
};

function shapePoints(r) {
  const { w, d } = r;
  if (r.shape === 'L') {
    const cw = Math.min(Math.max(r.cutW, 100), w - 100), cd = Math.min(Math.max(r.cutD, 100), d - 100);
    return [[0, 0], [w, 0], [w, d - cd], [w - cw, d - cd], [w - cw, d], [0, d]];
  }
  if (r.shape === 'libre' && Array.isArray(r.points) && r.points.length >= 3) return r.points.map(([x, z]) => [Math.max(0, +x || 0), Math.max(0, +z || 0)]);
  return [[0, 0], [w, 0], [w, d], [0, d]];
}

export function normalizeRoom(r0) {
  const r = { ...ROOM_DEFAULTS, ...(r0 || {}) };
  r.openings = Array.isArray(r.openings) ? r.openings : [];
  r.columns = Array.isArray(r.columns) ? r.columns : [];
  const points = shapePoints(r);
  const w = Math.max(...points.map((p) => p[0]));
  const d = Math.max(...points.map((p) => p[1]));
  const room = { ...r, points, w, d };
  const walls = roomWalls(room);
  room.openings = r.openings
    .filter((o) => walls[o.wall])
    .map((o) => {
      const len = walls[o.wall].len;
      const width = Math.min(Math.max(o.width, 100), len);
      const height = Math.min(Math.max(o.height, 100), room.h);
      const sill = Math.min(Math.max(o.sill || 0, 0), room.h - height);
      return { ...o, width, height, sill, offset: Math.min(Math.max(o.offset || 0, 0), len - width) };
    });
  return room;
}

export function signedArea(points) {
  let a = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, z1] = points[i], [x2, z2] = points[(i + 1) % points.length];
    a += x1 * z2 - x2 * z1;
  }
  return a / 2;
}

export function roomWalls(room) {
  const pts = room.points;
  const sgn = signedArea(pts) >= 0 ? 1 : -1;
  return pts.map((a, i) => {
    const b = pts[(i + 1) % pts.length];
    const dx = b[0] - a[0], dz = b[1] - a[1];
    const len = Math.hypot(dx, dz) || 1;
    const ux = dx / len, uz = dz / len;
    return { i, a, b, len: Math.round(len), u: [ux, uz], n: [sgn * uz, -sgn * ux] }; // n = normal hacia afuera
  });
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
