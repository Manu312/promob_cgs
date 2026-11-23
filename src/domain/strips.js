// Franjas de pared y regiones (Promob "Faixas" y "Regiões").
// Franjas: líneas horizontales (alturas) y verticales (posiciones a lo largo) que parten la cara
// interior de una pared en celdas; cada celda puede llevar su material. Al soltar un material
// sobre una pared con franjas se elige: Región (la celda), Perfil horizontal (la fila), Perfil
// vertical (la columna), Cara o Todo.
// Regiones: figuras (rectángulo, círculo, por puntos) sobre una pared o el piso, con su material.
// Coordenadas: en pared (u a lo largo desde el inicio, v desde el piso), en piso (x, z) en mm.

import { normalizeFinish } from './roomMaterials.js';

const uniqSorted = (xs, max) => [...new Set(xs.map((v) => Math.round(v)).filter((v) => v > 0 && v < max))].sort((a, b) => a - b);

// Franjas de una pared, limpias para su largo y alto.
export function stripsOf(room, wallId, len, h) {
  const s = room.strips?.[wallId] || {};
  return { h: uniqSorted(s.h || [], h), v: uniqSorted(s.v || [], len) };
}

export function setStrips(room, wallId, strips) {
  return { ...room, strips: { ...(room.strips || {}), [wallId]: { h: [...(strips.h || [])], v: [...(strips.v || [])] } } };
}

// Celdas de la cara: filas por alturas y columnas por posiciones. id = "fila,columna".
export function stripCells(strips, len, h) {
  const hs = [0, ...strips.h, h], vs = [0, ...strips.v, len];
  const out = [];
  for (let r = 0; r < hs.length - 1; r++) {
    for (let c = 0; c < vs.length - 1; c++) out.push({ id: `${r},${c}`, row: r, col: c, u0: vs[c], u1: vs[c + 1], v0: hs[r], v1: hs[r + 1] });
  }
  return out;
}

// Celda que contiene el punto (u, v) de la cara.
export function cellAt(strips, len, h, u, v) {
  return stripCells(strips, len, h).find((c) => u >= c.u0 && u <= c.u1 && v >= c.v0 && v <= c.v1) || null;
}

// Material en celdas de franjas: scope 'region' (la celda), 'perfil-h' (fila), 'perfil-v' (columna).
export function applyStripMaterial(room, wallId, len, h, cellId, matId, scope = 'region') {
  const strips = stripsOf(room, wallId, len, h);
  const cells = stripCells(strips, len, h);
  const cell = cells.find((c) => c.id === cellId);
  if (!cell) return room;
  const pick = scope === 'perfil-h' ? cells.filter((c) => c.row === cell.row) : scope === 'perfil-v' ? cells.filter((c) => c.col === cell.col) : [cell];
  const cur = { ...(room.stripFinishes?.[wallId] || {}) };
  for (const c of pick) cur[c.id] = normalizeFinish({ ...(cur[c.id] || {}), mat: matId });
  return { ...room, stripFinishes: { ...(room.stripFinishes || {}), [wallId]: cur } };
}

// Configuraciones de franjas guardadas con nombre (para reutilizar en otros proyectos).
export function saveStripPreset(presets, name, strips) {
  const n = name.trim();
  if (!n) return presets;
  return [...presets.filter((p) => p.name !== n), { name: n, h: [...strips.h], v: [...strips.v] }];
}

// ---------------- Regiones ----------------

let seq = 0;
export const regionId = () => `rg${Date.now().toString(36)}${(seq++).toString(36)}`;

export function rectPts(x0, y0, x1, y1) {
  const [a, b] = [Math.min(x0, x1), Math.max(x0, x1)], [c, d] = [Math.min(y0, y1), Math.max(y0, y1)];
  return [[a, c], [b, c], [b, d], [a, d]];
}

export function circlePts(cx, cy, r, n = 48) {
  return Array.from({ length: n }, (_, i) => [cx + r * Math.cos((2 * Math.PI * i) / n), cy + r * Math.sin((2 * Math.PI * i) / n)]);
}

export function polyArea(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) { const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length]; a += x0 * y1 - x1 * y0; }
  return a / 2;
}

const ccw = (pts) => (polyArea(pts) < 0 ? [...pts].reverse() : pts);

// Offset de la forma (crece con d > 0, se achica con d < 0), con esquinas a inglete.
export function offsetPolygon(pts0, d) {
  const pts = ccw(pts0);
  const n = pts.length;
  const out = [];
  for (let i = 0; i < n; i++) {
    const p = pts[(i - 1 + n) % n], c = pts[i], q = pts[(i + 1) % n];
    const e1 = norm([c[0] - p[0], c[1] - p[1]]), e2 = norm([q[0] - c[0], q[1] - c[1]]);
    const n1 = [e1[1], -e1[0]], n2 = [e2[1], -e2[0]]; // normales hacia afuera (antihorario)
    const b = norm([n1[0] + n2[0], n1[1] + n2[1]]);
    const cos = b[0] * n1[0] + b[1] * n1[1];
    const k = d / Math.max(cos, 0.2);
    out.push([c[0] + b[0] * k, c[1] + b[1] * k]);
  }
  return out;
}
function norm([x, y]) { const l = Math.hypot(x, y) || 1; return [x / l, y / l]; }

// Chanfle: corta cada esquina elegida (índices; todas si no se indica) a distancia d.
export function chamferPolygon(pts, d, which = null) {
  const out = [];
  pts.forEach((c, i) => {
    if (which && !which.includes(i)) { out.push(c); return; }
    const p = pts[(i - 1 + pts.length) % pts.length], q = pts[(i + 1) % pts.length];
    const a = norm([p[0] - c[0], p[1] - c[1]]), b = norm([q[0] - c[0], q[1] - c[1]]);
    out.push([c[0] + a[0] * d, c[1] + a[1] * d], [c[0] + b[0] * d, c[1] + b[1] * d]);
  });
  return out;
}

// Filete: redondea las esquinas con radio r (arco aproximado con `segs` tramos).
export function filletPolygon(pts, r, which = null, segs = 6) {
  const out = [];
  pts.forEach((c, i) => {
    if (which && !which.includes(i)) { out.push(c); return; }
    const p = pts[(i - 1 + pts.length) % pts.length], q = pts[(i + 1) % pts.length];
    const a = norm([p[0] - c[0], p[1] - c[1]]), b = norm([q[0] - c[0], q[1] - c[1]]);
    const ang = Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1])));
    const t = r / Math.tan(ang / 2); // distancia desde la esquina hasta donde empieza el arco
    const s = [c[0] + a[0] * t, c[1] + a[1] * t], e = [c[0] + b[0] * t, c[1] + b[1] * t];
    const bis = norm([a[0] + b[0], a[1] + b[1]]);
    const h = r / Math.sin(ang / 2);
    const o = [c[0] + bis[0] * h, c[1] + bis[1] * h];
    let a0 = Math.atan2(s[1] - o[1], s[0] - o[0]), a1 = Math.atan2(e[1] - o[1], e[0] - o[0]);
    let da = a1 - a0;
    if (da > Math.PI) da -= 2 * Math.PI;
    if (da < -Math.PI) da += 2 * Math.PI;
    for (let k = 0; k <= segs; k++) { const an = a0 + (da * k) / segs; out.push([o[0] + r * Math.cos(an), o[1] + r * Math.sin(an)]); }
  });
  return out;
}

// Corte: parte la región con una recta vertical (x = at) u horizontal (y = at). Devuelve 1 o 2 polígonos.
export function cutPolygon(pts, axis, at) {
  const k = axis === 'v' ? 0 : 1;
  const side = (p) => p[k] - at;
  const a = [], b = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    const sp = side(p), sq = side(q);
    if (sp <= 0) a.push(p);
    if (sp >= 0) b.push(p);
    if ((sp < 0 && sq > 0) || (sp > 0 && sq < 0)) {
      const t = sp / (sp - sq);
      const m = [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
      a.push(m); b.push(m);
    }
  }
  return [a, b].filter((x) => x.length >= 3 && Math.abs(polyArea(x)) > 1);
}

export function movePolygon(pts, dx, dy) { return pts.map(([x, y]) => [x + dx, y + dy]); }

export function addRegion(room, surface, pts, finish = null, id = regionId()) {
  const r = { id, surface, pts: pts.map(([x, y]) => [Math.round(x), Math.round(y)]), finish: normalizeFinish(finish) };
  return { room: { ...room, regions: [...(room.regions || []), r] }, id: r.id };
}

export function updateRegion(room, id, patch) {
  const fix = { ...(patch.pts ? { pts: patch.pts.map(([x, y]) => [Math.round(x), Math.round(y)]) } : {}), ...('finish' in patch ? { finish: normalizeFinish(patch.finish) } : {}) };
  return { ...room, regions: (room.regions || []).map((r) => (r.id === id ? { ...r, ...patch, ...fix } : r)) };
}

export function removeRegion(room, id) {
  return { ...room, regions: (room.regions || []).filter((r) => r.id !== id) };
}

// Duplicar: la copia queda a la derecha de la original.
export function duplicateRegion(room, id, newId = regionId()) {
  const r = (room.regions || []).find((x) => x.id === id);
  if (!r) return { room, id: null };
  const xs = r.pts.map((p) => p[0]);
  return addRegion(room, r.surface, movePolygon(r.pts, Math.max(...xs) - Math.min(...xs), 0), r.finish, newId);
}

// Regiones de una superficie (pared o piso) cuyas paredes siguen existiendo.
export function regionsOn(room, surface) {
  return (room.regions || []).filter((r) => r.surface.kind === surface.kind && (surface.kind !== 'wall' || r.surface.wallId === surface.wallId));
}

// Rectángulo menos rectángulos (vanos de puertas y ventanas): la parte que queda, en rectángulos.
export function rectMinusRects(r, holes) {
  const hs = holes.map((h) => ({ u0: Math.max(h.u0, r.u0), u1: Math.min(h.u1, r.u1), v0: Math.max(h.v0, r.v0), v1: Math.min(h.v1, r.v1) }))
    .filter((h) => h.u1 > h.u0 && h.v1 > h.v0);
  if (!hs.length) return [r];
  const us = [...new Set([r.u0, r.u1, ...hs.flatMap((h) => [h.u0, h.u1])])].sort((a, b) => a - b);
  const vs = [...new Set([r.v0, r.v1, ...hs.flatMap((h) => [h.v0, h.v1])])].sort((a, b) => a - b);
  const out = [];
  for (let i = 0; i < us.length - 1; i++) {
    for (let j = 0; j < vs.length - 1; j++) {
      const c = { u0: us[i], u1: us[i + 1], v0: vs[j], v1: vs[j + 1] };
      const mu = (c.u0 + c.u1) / 2, mv = (c.v0 + c.v1) / 2;
      if (!hs.some((h) => mu > h.u0 && mu < h.u1 && mv > h.v0 && mv < h.v1)) out.push(c);
    }
  }
  return out;
}
