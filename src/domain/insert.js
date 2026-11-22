// Posición de inserción al arrastrar desde el catálogo (como el recuadro verde de Promob).
// El plano de inserción es la pared más cercana al puntero (el módulo queda de espaldas
// contra su cara interior, centrado en el puntero a lo largo de la pared) o, lejos de las
// paredes, el piso (centrado en el puntero, sin girar).
import { MODULE_TYPES, footprint } from './modules.js';
import { roomWalls } from './room.js';

export const WALL_REACH = 600; // mm: a esta distancia de la pared, el plano de inserción es la pared

export function insertPose(type, params, room, [px, pz]) {
  const y = MODULE_TYPES[type]?.y || 0;
  const D = params.depth;
  let best = null;
  for (const g of roomWalls(room)) {
    const s = (px - g.a[0]) * g.u[0] + (pz - g.a[1]) * g.u[1];
    const d = -((px - g.a[0]) * g.n[0] + (pz - g.a[1]) * g.n[1]); // distancia hacia adentro
    if (s < 0 || s > g.len || d < -50 || d > Math.max(WALL_REACH, D)) continue;
    if (!best || d < best.d) best = { g, s, d };
  }
  if (!best) {
    const f = footprint({ params, rot: 0 });
    return { x: Math.round(px - f.fw / 2), z: Math.round(pz - f.fd / 2), y, rot: 0, wallId: null };
  }
  const { g, s } = best;
  const inward = [-g.n[0], -g.n[1]];
  let rot = (Math.atan2(inward[0], inward[1]) * 180) / Math.PI;
  rot = ((Math.round(rot * 100) / 100) % 360 + 360) % 360;
  const f = footprint({ params, rot });
  const c = [g.a[0] + g.u[0] * s + inward[0] * (D / 2), g.a[1] + g.u[1] * s + inward[1] * (D / 2)];
  return { x: Math.round(c[0] - f.fw / 2), z: Math.round(c[1] - f.fd / 2), y, rot, wallId: g.id };
}
