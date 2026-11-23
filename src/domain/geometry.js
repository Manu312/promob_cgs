// Geometrías (Promob "Construir Geometria"): figuras extruidas sobre un plano de construcción
// (el piso, la cara interior de una pared o la tapa de un módulo). Tipos: libre (polilínea
// cerrada), rectangular, circular, poligonal y lineal (un recorrido con espesor: zócalos,
// molduras, guardas). Propiedades: dimensiones, altura (extrusión), afastamiento (separación
// del plano), material, presupuesto, visible/movible, observaciones y perforante (Fase 7b S13).
// Coordenadas del plano en mm: piso y tapa (x, z) del ambiente; pared (u a lo largo, v alto).

import { circlePts, rectPts, polyArea, offsetPolygon } from './strips.js';

export const GEOMETRY_KINDS = [['libre', 'Libre'], ['rect', 'Rectangular'], ['circ', 'Circular'], ['poly', 'Poligonal'], ['lineal', 'Lineal']];
export const DEFAULT_GEOMETRY_HEIGHT = 150;
export const ALIGNS = [['cima', 'Por arriba'], ['baixo', 'Por abajo'], ['frente', 'Por el frente'], ['tras', 'Por atrás']];

let seq = 0;
export const geometryId = () => `ge${Date.now().toString(36)}${(seq++).toString(36)}`;

const r1 = (v) => Math.round(v * 10) / 10;

// Polígono regular por cantidad de lados: radio circunscrito, inscrito o tamaño del lado.
export function regularPolygon(cx, cy, sides, { circ = null, insc = null, side = null } = {}) {
  const n = Math.max(3, Math.round(sides));
  const R = circ ?? (insc != null ? insc / Math.cos(Math.PI / n) : side != null ? side / (2 * Math.sin(Math.PI / n)) : 300);
  return Array.from({ length: n }, (_, i) => {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / n;
    return [cx + R * Math.cos(a), cy + R * Math.sin(a)];
  });
}
export function polygonRadii(sides, circ) {
  const n = Math.max(3, Math.round(sides));
  return { circ: r1(circ), insc: r1(circ * Math.cos(Math.PI / n)), side: r1(2 * circ * Math.sin(Math.PI / n)) };
}

// Siguiente vértice al construir con precisión: largo y ángulo (grados, 0 = +x, antihorario).
export function nextPoint([x, y], length, angleDeg) {
  const a = (angleDeg * Math.PI) / 180;
  return [x + length * Math.cos(a), y + length * Math.sin(a)];
}

// Ajuste por incremento lineal y angular (como al construir paredes).
export function snapSegment(from, to, incL = 50, incA = 5) {
  const dx = to[0] - from[0], dy = to[1] - from[1];
  const len = Math.max(incL, Math.round(Math.hypot(dx, dy) / incL) * incL);
  const ang = Math.round(((Math.atan2(dy, dx) * 180) / Math.PI) / incA) * incA;
  return { point: nextPoint(from, len, ang), length: len, angle: ((ang % 360) + 360) % 360 };
}

// Contorno de una lineal: el recorrido con su espesor hacia un lado (frente / atrás) o centrado.
export function linealOutline(path, thickness, align = 'frente') {
  if (path.length < 2) return [];
  const side = align === 'tras' ? -1 : align === 'frente' ? 1 : 0;
  const normals = path.slice(0, -1).map((p, i) => {
    const q = path[i + 1]; const l = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
    return [-(q[1] - p[1]) / l, (q[0] - p[0]) / l];
  });
  const at = (i) => { // normal promedio en el vértice (inglete)
    const a = normals[Math.max(0, i - 1)], b = normals[Math.min(normals.length - 1, i)];
    const m = [a[0] + b[0], a[1] + b[1]]; const l = Math.hypot(...m) || 1;
    const cos = (m[0] * a[0] + m[1] * a[1]) / l;
    return [m[0] / l / Math.max(cos, 0.3), m[1] / l / Math.max(cos, 0.3)];
  };
  const off = (s) => path.map((p, i) => { const n = at(i); return [p[0] + n[0] * s, p[1] + n[1] * s]; });
  const a = side === 0 ? off(thickness / 2) : side > 0 ? off(thickness) : path;
  const b = side === 0 ? off(-thickness / 2) : side > 0 ? path : off(-thickness);
  return [...a, ...[...b].reverse()];
}

// Contorno (polígono cerrado) de la geometría en su plano.
export function outlineOf(g) {
  if (g.kind === 'lineal') return linealOutline(g.pts, g.thickness ?? 18, g.align);
  if (g.kind === 'circ') {
    const pts = circlePts(g.cx, g.cy, g.radius, 64);
    if (g.arc && g.arc < 360) { // arco: sector desde el ángulo base
      const n = 48, a0 = ((g.baseAngle || 0) * Math.PI) / 180, a1 = a0 + (g.arc * Math.PI) / 180;
      return [[g.cx, g.cy], ...Array.from({ length: n + 1 }, (_, i) => { const a = a0 + ((a1 - a0) * i) / n; return [g.cx + g.radius * Math.cos(a), g.cy + g.radius * Math.sin(a)]; })];
    }
    return pts;
  }
  return g.pts;
}

export function boundsOf(pts) {
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys), w: Math.max(...xs) - Math.min(...xs), d: Math.max(...ys) - Math.min(...ys) };
}

// Medidas que muestra Propiedades: Largura (x), Profundidade (y del plano), Altura (extrusión), Área.
export function geometryDims(g) {
  const o = outlineOf(g);
  const b = boundsOf(o);
  return { width: Math.round(b.w), depth: Math.round(b.d), height: g.height ?? DEFAULT_GEOMETRY_HEIGHT, area: Math.round(Math.abs(polyArea(o))) };
}

// Cambiar Largura o Profundidade: estira la figura (con Escalar, proporcional en ambas).
export function resizeGeometry(g, key, value, scale = false) {
  const d = geometryDims(g);
  const cur = key === 'width' ? d.width : d.depth;
  if (!cur || value <= 0) return g;
  const k = value / cur;
  const kx = key === 'width' || scale ? k : 1, ky = key === 'depth' || scale ? k : 1;
  const b = boundsOf(outlineOf(g));
  const tr = ([x, y]) => [b.x0 + (x - b.x0) * kx, b.y0 + (y - b.y0) * ky];
  if (g.kind === 'circ') return { ...g, radius: g.radius * (scale ? k : (kx + ky) / 2) };
  return { ...g, pts: g.pts.map(tr) };
}

export function moveGeometry(g, dx, dy) {
  if (g.kind === 'circ') return { ...g, cx: g.cx + dx, cy: g.cy + dy };
  return { ...g, pts: g.pts.map(([x, y]) => [x + dx, y + dy]) };
}

export function newGeometry(kind, plane, data, opts = {}) {
  return {
    id: geometryId(), kind, plane, ...data,
    height: opts.height ?? DEFAULT_GEOMETRY_HEIGHT, offset: opts.offset ?? 0,
    ...(kind === 'lineal' ? { thickness: opts.thickness ?? 18, align: opts.align ?? 'frente' } : {}),
    color: opts.color ?? '#c9c4ba', finish: null,
    budget: { on: false, desc: '', category: '', group: '', ref: '', price: 0 },
    visible: true, movable: true, notes: '', hole: { on: false, depth: null },
  };
}

export function addGeometry(project, g) {
  return { ...project, geometries: [...(project.geometries || []), g] };
}
export function updateGeometry(project, id, patch) {
  return { ...project, geometries: (project.geometries || []).map((g) => (g.id === id ? { ...g, ...patch } : g)) };
}
export function removeGeometry(project, id) {
  return { ...project, geometries: (project.geometries || []).filter((g) => g.id !== id) };
}

// Crecer / achicar el contorno (para las regiones que usan geometría como guía).
export const growOutline = offsetPolygon;

// "Convertir en" (Promob: Converter para painel): la geometría pasa a ser un ítem de la modulación
// con sus medidas (va al despiece y al presupuesto). Solo rectangulares (o lineales rectas).
export const CONVERT_TARGETS = [['vista', 'Panel (vista)'], ['estante', 'Estante'], ['tapa', 'Tapa / mesada']];
export function convertGeometry(g, type) {
  const rectish = g.kind === 'rect' || (g.kind === 'lineal' && g.pts.length === 2);
  const d = geometryDims(g);
  if (!rectish || d.width < 10 || d.depth < 3 || d.height < 3) return { error: 'La geometría seleccionada para conversión no tiene medidas válidas.' };
  if (g.plane.kind !== 'floor') return { error: 'Por ahora se convierten las geometrías hechas sobre el piso.' };
  const b = boundsOf(outlineOf(g));
  // Panel: espesor = lo más chico en planta, alto = la altura. Estante / tapa: espesor = la altura.
  if (type === 'vista') {
    const thin = Math.min(d.width, d.depth), long = Math.max(d.width, d.depth);
    return { module: { type, x: Math.round(b.x0), z: Math.round(b.y0), y: g.offset || 0, rot: d.width >= d.depth ? 90 : 0, params: { width: Math.round(thin), height: Math.round(d.height), depth: Math.round(long) } } };
  }
  return { module: { type, x: Math.round(b.x0), z: Math.round(b.y0), y: g.offset || 0, rot: 0, params: { width: Math.round(d.width), depth: Math.round(d.depth), height: Math.round(d.height), ...(type === 'tapa' ? { mesadaT: Math.round(d.height) } : {}) } } };
}

// Presupuesto: las geometrías marcadas como presupuestadas suman su precio.
export function geometryBudgetLines(project) {
  return (project.geometries || []).filter((g) => g.budget?.on && g.visible !== false).map((g) => ({
    label: g.budget.desc || `Geometría ${GEOMETRY_KINDS.find(([k]) => k === g.kind)?.[1] || ''}`.trim(),
    ref: g.budget.ref || '', qty: 1, price: +g.budget.price || 0,
  }));
}

export { rectPts, circlePts };

// ---------------- Perforar (Promob "Furar") ----------------
// Una geometría perforante agujerea su plano: la pared, el piso, la tapa del módulo (área
// húmeda: después se inserta la bacha) u otra geometría del mismo plano que se superponga.
// `depth` null = pasante; con profundidad, solo esa parte del espesor.

export function setHole(g, on, depth = g.hole?.depth ?? null) {
  return { ...g, hole: { on: !!on, depth: depth == null || depth === '' ? null : Math.max(1, +depth) } };
}

const samePlane = (a, b) => a.kind === b.kind && (a.kind !== 'wall' || a.wallId === b.wallId) && (a.kind !== 'module' || a.id === b.id);

// Agujeros sobre una superficie (pared, piso o módulo): contorno en coordenadas del plano.
export function holesOn(project, plane) {
  return (project.geometries || [])
    .filter((g) => g.hole?.on && g.visible !== false && samePlane(g.plane, plane))
    .map((g) => ({ id: g.id, pts: outlineOf(g), depth: g.hole.depth }));
}

// Agujeros que otras geometrías perforantes le hacen a `g` (mismo plano y se superponen).
export function holesInGeometry(project, g) {
  const b = boundsOf(outlineOf(g));
  return holesOn(project, g.plane).filter((h) => {
    if (h.id === g.id) return false;
    const hb = boundsOf(h.pts);
    return hb.x0 < b.x1 && hb.x1 > b.x0 && hb.y0 < b.y1 && hb.y1 > b.y0;
  });
}
