// Inserción (Promob): Dirección de inserción (el ítem nuevo al lado del seleccionado), Orientación
// de inserción (Horizontal, Vertical, Horizontal en el plano, Vertical en el plano), cambiar de
// plano con clic derecho mientras se arrastra y Desasociar (el ítem deja su plano: queda sobre el
// piso y ya no acompaña a la pared).

import { footprint, localAxes, MODULE_TYPES } from './modules.js';
import { insertPose } from './insert.js';

export const INSERT_DIRECTIONS = [['derecha', 'A la derecha'], ['izquierda', 'A la izquierda'], ['arriba', 'Arriba'], ['abajo', 'Abajo'], ['adelante', 'Adelante'], ['atras', 'Atrás']];
export const INSERT_ORIENTATIONS = [['', 'Normal'], ['horizontal', 'Horizontal'], ['vertical', 'Vertical'], ['horizontal-plano', 'Horizontal en el plano'], ['vertical-plano', 'Vertical en el plano']];

// El módulo nuevo `m` (ya con medidas) pegado al `base` en esa dirección, con el giro del base.
export function placeRelative(base, m, dir) {
  const rot = base.rot || 0;
  const { ex, ez } = localAxes(rot);
  const W0 = base.params.width, D0 = base.params.depth, W1 = m.params.width, D1 = m.params.depth;
  const fb = footprint(base);
  const c0 = [base.x + fb.fw / 2, base.z + fb.fd / 2]; // centro del base
  // desplazamiento del centro, en ejes del base (a lo ancho y en profundidad, alineados atrás)
  let du = 0, dd = (D1 - D0) / 2, y = base.y || 0;
  if (dir === 'derecha') du = (W0 + W1) / 2;
  else if (dir === 'izquierda') du = -(W0 + W1) / 2;
  else if (dir === 'adelante') { dd = (D0 + D1) / 2; }
  else if (dir === 'atras') { dd = -(D0 + D1) / 2; }
  else if (dir === 'arriba') y = (base.y || 0) + base.params.height;
  else if (dir === 'abajo') y = Math.max(0, (base.y || 0) - m.params.height);
  const c = [c0[0] + ex[0] * du + ez[0] * dd, c0[1] + ex[1] * du + ez[1] * dd];
  const f = footprint({ ...m, rot });
  return { ...m, rot, y, x: Math.round(c[0] - f.fw / 2), z: Math.round(c[1] - f.fd / 2) };
}

// Orientación: el ítem (una placa) acostado, parado de costado o de frente al plano.
// Devuelve tipo y medidas: L = lado largo, D = el otro, t = espesor.
export function orientItem(type, params, orientation) {
  const kind = MODULE_TYPES[type]?.kind;
  if (!orientation || !['panel', 'estante', 'vista', 'tapa'].includes(kind)) return { type, params };
  const dims = [params.width, params.height, params.depth].sort((a, b) => b - a);
  const [L, D, t] = [dims[0], dims[1], Math.max(3, dims[2])];
  if (orientation === 'horizontal') return { type: 'estante', params: { ...MODULE_TYPES.estante.defaults, width: L, depth: D, height: t } };
  if (orientation === 'vertical') return { type: 'vista', params: { ...MODULE_TYPES.vista.defaults, width: t, height: L, depth: D } };
  if (orientation === 'vertical-plano') return { type: 'panel', params: { ...MODULE_TYPES.panel.defaults, width: D, height: L, depth: t } };
  return { type: 'panel', params: { ...MODULE_TYPES.panel.defaults, width: L, height: D, depth: t } }; // horizontal en el plano
}

// Cambiar de plano (clic derecho al arrastrar): piso, arriba de otro módulo o contra una pared.
export function changePlane(m, target, project) {
  if (target.kind === 'floor') return { ...m, y: 0, rest: false, detached: false };
  if (target.kind === 'module') {
    const o = project.modules.find((x) => x.id === target.id);
    if (!o || o.id === m.id) return m;
    const top = (o.y || 0) + o.params.height + (o.params.mesada === 'si' ? o.params.mesadaT || 0 : 0);
    return { ...m, y: top, rest: true, detached: false };
  }
  if (target.kind === 'wall' && target.point) {
    const pose = insertPose(m.type, m.params, project.room, target.point, m.y ?? 0);
    if (!pose.wallId) return m;
    return { ...m, x: pose.x, z: pose.z, rot: pose.rot, detached: false };
  }
  return m;
}

// Desasociar: el ítem deja su plano (queda referido al piso, no se apoya ni sigue a la pared).
export function detachModule(m) {
  return { ...m, rest: false, detached: true };
}
