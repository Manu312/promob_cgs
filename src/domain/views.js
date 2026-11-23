// Menú Vistas (Promob): vistas predefinidas del ambiente, vista frontal de una pared (doble clic),
// historial Volver/Avanzar vista (últimas 20) y Ortogonal/Perspectiva (F8).
// Las poses están en metros, en coordenadas de la escena (el centro del ambiente es el origen).

export const VIEWS = [
  { id: 'perspectiva', label: 'Isométrica derecha' }, // la de siempre (por defecto, como Promob)
  { id: 'iso-izq', label: 'Isométrica izquierda', dir: [-1, 0.85, 1] },
  { id: 'iso-tras-der', label: 'Isométrica trasera derecha', dir: [1, 0.85, -1] },
  { id: 'iso-tras-izq', label: 'Isométrica trasera izquierda', dir: [-1, 0.85, -1] },
  { id: 'frente', label: 'Frente' },
  { id: 'fondo', label: 'Fondo', dir: [0, 0.2, -1] },
  { id: 'lat-der', label: 'Lateral derecha', dir: [1, 0.2, 0] },
  { id: 'lat-izq', label: 'Lateral izquierda', dir: [-1, 0.2, 0] },
  { id: 'planta', label: 'Planta' },
];
export const VIEW_HISTORY_MAX = 20;

const norm = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };
// Distancia para que una esfera de radio r entre en el campo de visión (vertical y horizontal).
function fitDistance(r, fovDeg, aspect) {
  const v = (fovDeg * Math.PI) / 180;
  const h = 2 * Math.atan(Math.tan(v / 2) * aspect);
  return r / Math.sin(Math.min(v, h) / 2);
}

// Pose de una vista predefinida para un ambiente de w × d × h mm.
export function viewPose(id, { w, d, h }, fovDeg = 45, aspect = 1.6) {
  const W = w / 1000, D = d / 1000, H = h / 1000;
  if (id === 'planta') return { pos: [0, 40, 0.001], target: [0, 0, 0], top: true };
  if (id === 'frente') return { pos: [0, 1.3, D / 2 + 2.8], target: [0, 1.1, -D / 4] };
  if (id === 'perspectiva' || !VIEWS.find((x) => x.id === id)?.dir) return { pos: [1.6, 2.3, D / 2 + 2.6], target: [0, 0.9, -D / 5] };
  const dir = norm(VIEWS.find((x) => x.id === id).dir);
  const target = [0, H * 0.4, 0];
  const dist = fitDistance(0.5 * Math.hypot(W, D, H), fovDeg, aspect) * 0.9;
  return { pos: target.map((t, i) => t + dir[i] * dist), target };
}

// Vista frontal de una pared (doble clic en la pared): de frente a su cara interior, centrada.
// `g` = pared de roomWalls (a, b, n = normal hacia afuera, len); `origin` = centro del ambiente (mm).
export function wallViewPose(g, h, origin, fovDeg = 45, aspect = 1.6) {
  const mid = [((g.a[0] + g.b[0]) / 2 - origin.x) / 1000, ((g.a[1] + g.b[1]) / 2 - origin.z) / 1000];
  const v = (fovDeg * Math.PI) / 180;
  const hf = 2 * Math.atan(Math.tan(v / 2) * aspect);
  const dist = Math.max((h / 2000) / Math.tan(v / 2), (g.len / 2000) / Math.tan(hf / 2)) * 1.15 + 0.3;
  const y = h / 2000;
  return { pos: [mid[0] - g.n[0] * dist, y, mid[1] - g.n[1] * dist], target: [mid[0], y, mid[1]] };
}

// Zoom de la cámara ortogonal para que entre un ancho × alto (m) en la vista (px).
export function orthoZoom(spanW, spanH, widthPx, heightPx, margin = 1.15) {
  return Math.min(widthPx / (spanW * margin), heightPx / (spanH * margin));
}

// Historial de vistas: ir a una vista guarda la actual en "atrás" (máx. 20) y borra "adelante".
const same = (a, b) => a && b && a.name === b.name && a.wallId === b.wallId && !!a.ortho === !!b.ortho;
export function pushView(hist, current, next) {
  if (same(current, next)) return hist;
  return { back: [...hist.back, current].slice(-VIEW_HISTORY_MAX), fwd: [] };
}
export function backView(hist, current) {
  if (!hist.back.length) return null;
  return { view: hist.back.at(-1), hist: { back: hist.back.slice(0, -1), fwd: [current, ...hist.fwd].slice(0, VIEW_HISTORY_MAX) } };
}
export function fwdView(hist, current) {
  if (!hist.fwd.length) return null;
  return { view: hist.fwd[0], hist: { back: [...hist.back, current].slice(-VIEW_HISTORY_MAX), fwd: hist.fwd.slice(1) } };
}
