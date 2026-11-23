// Herramientas de navegación de Promob: Zoom Total (F6), Zoom Total Entidad/Plano (F7/F5: lo
// seleccionado), Zoom Ventana (W: recuadro), Pan (P), Zoom (Z) y Caminar (C, solo en perspectiva).
// Poses en metros (escena). Las cámaras ortogonales usan `zoom` en vez de distancia.

const sub = (a, b) => a.map((v, i) => v - b[i]);
const add = (a, b) => a.map((v, i) => v + b[i]);
const mul = (a, k) => a.map((v) => v * k);
const len = (a) => Math.hypot(...a);
const norm = (a) => { const l = len(a) || 1; return mul(a, 1 / l); };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

// Encuadrar una caja (min, max) sin cambiar desde dónde se mira.
export function fitBoxPose(min, max, camPos, target, fovDeg = 45, aspect = 1.6, margin = 1.1) {
  const center = mul(add(min, max), 0.5);
  const r = (len(sub(max, min)) / 2) * margin;
  const v = (fovDeg * Math.PI) / 180;
  const h = 2 * Math.atan(Math.tan(v / 2) * aspect);
  const dist = Math.max(r / Math.sin(Math.min(v, h) / 2), 0.6);
  const dir = norm(sub(camPos, target));
  return { pos: add(center, mul(dir, dist)), target: center };
}

// Ejes de la pantalla (derecha, arriba) para una cámara que mira de camPos a target.
function screenAxes(camPos, target) {
  const fwd = norm(sub(target, camPos));
  let right = cross(fwd, [0, 1, 0]);
  if (len(right) < 1e-6) right = [1, 0, 0]; // mirando derecho para abajo (planta)
  right = norm(right);
  const up = norm(cross(right, fwd));
  return { fwd, right, up };
}

// Zoom Ventana: el recuadro (fracciones 0–1 de la vista, y hacia abajo) pasa a llenar la vista.
// Perspectiva: se acerca; ortogonal: devuelve también el factor por el que se multiplica el zoom.
export function zoomWindowPose(camPos, target, rect, { fovDeg = 45, aspect = 1.6, ortho = false, zoom = 1, viewH = 600 } = {}) {
  const { right, up } = screenAxes(camPos, target);
  const D = len(sub(camPos, target));
  const halfH = ortho ? viewH / 2 / zoom : D * Math.tan(((fovDeg * Math.PI) / 180) / 2);
  const halfW = halfH * aspect;
  const cx = (rect.x0 + rect.x1) / 2 - 0.5, cy = 0.5 - (rect.y0 + rect.y1) / 2;
  const t = add(add(target, mul(right, cx * 2 * halfW)), mul(up, cy * 2 * halfH));
  const s = Math.max(Math.abs(rect.x1 - rect.x0), Math.abs(rect.y1 - rect.y0), 0.02);
  const dir = norm(sub(camPos, target));
  if (ortho) return { pos: add(t, mul(dir, D)), target: t, zoomFactor: 1 / s };
  return { pos: add(t, mul(dir, Math.max(D * s, 0.3))), target: t, zoomFactor: 1 };
}

// Caminar: avanzar (m) en horizontal hacia donde se mira y girar la mirada (grados, + = derecha).
export function walkPose(camPos, target, forward, yawDeg) {
  const d = sub(target, camPos);
  const a = (-yawDeg * Math.PI) / 180;
  const c = Math.cos(a), s = Math.sin(a);
  const rd = [d[0] * c + d[2] * s, d[1], -d[0] * s + d[2] * c]; // giro alrededor del eje vertical
  const h = norm([rd[0], 0, rd[2]]);
  const step = mul(h, forward);
  const pos = add(camPos, step);
  return { pos, target: add(pos, rd) };
}
