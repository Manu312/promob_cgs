// Panel Movimiento (como Promob): mover y girar el objeto seleccionado de a un paso.
// Ejes: 'w' ancho (rojo), 'd' profundidad (verde), 'h' alto (azul).
import { footprint, localAxes } from './modules.js';
import { modulePoly, overlaps } from './collision.js';

export const MOVE_AXES = [
  { axis: 'w', label: 'Ancho', color: '#e03131' },
  { axis: 'd', label: 'Profundidad', color: '#2f9e44' },
  { axis: 'h', label: 'Alto', color: '#1c7ed6' },
];

// Destino de un paso: con `relative` los ejes son los del módulo (siguen su rotación);
// sin ella, los del ambiente. El alto nunca baja del piso.
export function nudgeTarget(mod, axis, sign, step, relative = true) {
  if (axis === 'h') return { y: Math.max(0, Math.round((mod.y || 0) + sign * step)) };
  let dir = axis === 'w' ? [1, 0] : [0, 1];
  if (relative) { const { ex, ez } = localAxes(mod.rot || 0); dir = axis === 'w' ? ex : ez; }
  return { x: Math.round(mod.x + dir[0] * sign * step) + 0, z: Math.round(mod.z + dir[1] * sign * step) + 0 };
}

// Gira el módulo sobre su centro (no sobre la esquina): la huella cambia y x, z se
// recalculan para que el centro quede en el mismo lugar.
export function rotateAboutCenter(mod, deg) {
  const f0 = footprint(mod);
  const cx = mod.x + f0.fw / 2, cz = mod.z + f0.fd / 2;
  const rot = ((((mod.rot || 0) + deg) % 360) + 360) % 360;
  const f1 = footprint({ ...mod, rot });
  return { rot, x: Math.round(cx - f1.fw / 2), z: Math.round(cz - f1.fd / 2) };
}

// Traba de eje para el arrastre (teclas X / Y de Promob): 'x' solo se mueve en x; 'z' solo en profundidad.
export function lockAxis(mod, x, z, lock) {
  if (lock === 'x') return { x, z: mod.z };
  if (lock === 'z') return { x: mod.x, z };
  return { x, z };
}

// Apoyar sobre otros (bacha sobre mesada, microondas sobre un bajo): altura de la cara de
// arriba más alta entre los módulos que tiene debajo en planta. Solo apoyan superficies de
// trabajo: módulos en el piso o apoyados a su vez, con la cara de arriba hasta SUPPORT_MAX_H
// (una alacena colgada o un placard no son apoyo: contra ellos actúa la colisión).
export const SUPPORT_MAX_H = 1200;

export function restingHeight(mod, modules) {
  const poly = modulePoly(mod);
  let y = 0;
  for (const o of modules) {
    if (o.id === mod.id || !((o.y || 0) <= 1 || o.rest)) continue;
    if ((o.y || 0) + o.params.height > SUPPORT_MAX_H) continue;
    if (!overlaps(poly, modulePoly(o))) continue;
    const mesada = o.params.mesada === 'si' ? o.params.mesadaT || 0 : 0; // se apoya arriba de la mesada
    y = Math.max(y, (o.y || 0) + o.params.height + mesada);
  }
  return Math.round(y);
}
