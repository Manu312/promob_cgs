// Aberturas (ventanas, puertas, vanos) y columnas: edición y arrastre.
// Las aberturas viven en una pared (wallId + offset desde su inicio); normalizeRoom las
// mantiene siempre dentro de la pared.

import { normalizeRoom, roomWalls } from './room.js';

export const updateOpening = (room, id, patch) => normalizeRoom({ ...room, openings: room.openings.map((o) => (o.id === id ? { ...o, ...patch } : o)) });
export const removeOpening = (room, id) => normalizeRoom({ ...room, openings: room.openings.filter((o) => o.id !== id) });

// Distancias de la abertura a los extremos de su pared (cotas editables).
export function openingDims(room, id) {
  const o = room.openings.find((x) => x.id === id);
  const g = o && roomWalls(room).find((w) => w.id === o.wallId);
  if (!g) return null;
  return { start: Math.round(o.offset), end: Math.round(g.len - o.offset - o.width), len: g.len };
}

export function setOpeningDim(room, id, which, value) {
  const d = openingDims(room, id);
  if (!d) return room;
  const o = room.openings.find((x) => x.id === id);
  return updateOpening(room, id, { offset: which === 'start' ? value : d.len - o.width - value });
}

export const updateColumn = (room, id, patch) => normalizeRoom({ ...room, columns: room.columns.map((c) => (c.id === id ? { ...c, ...patch } : c)) });
export const removeColumn = (room, id) => normalizeRoom({ ...room, columns: room.columns.filter((c) => c.id !== id) });

// Arrastrar una columna: imán (a `thr` mm) a las caras interiores de paredes alineadas a
// los ejes y a otras columnas; si no hay nada cerca, redondea al paso.
export function moveColumn(room, id, x, z, step = 10, thr = 40) {
  const c = room.columns.find((o) => o.id === id);
  if (!c) return room;
  const xs = [], zs = [];
  for (const w of roomWalls(room)) {
    if (Math.abs(w.u[0]) < 1e-6) xs.push(w.n[0] < 0 ? w.a[0] : w.a[0] - c.w);
    else if (Math.abs(w.u[1]) < 1e-6) zs.push(w.n[1] < 0 ? w.a[1] : w.a[1] - c.d);
  }
  for (const o of room.columns) {
    if (o.id === id) continue;
    xs.push(o.x + o.w, o.x - c.w, o.x);
    zs.push(o.z + o.d, o.z - c.d, o.z);
  }
  const near = (v, cands) => {
    let best = Math.round(v / step) * step, bd = thr;
    for (const k of cands) { const d = Math.abs(k - v); if (d < bd) { bd = d; best = k; } }
    return Math.round(best);
  };
  return updateColumn(room, id, { x: near(x, xs), z: near(z, zs) });
}
