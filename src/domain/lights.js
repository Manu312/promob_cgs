// Lumen y Editor de luces (Promob): luminarias que iluminan el render. Tres tipos de luz:
// ambiente (puntual, ilumina para todos lados), spot (cono con apertura, falloff e inclinación)
// y lineal (tira LED). Intensidad 0 a 2; color; sombra; si ilumina objetos transparentes.
// Las luces se ven en el Modo render y en el render (como en Promob, no en la vista normal).

import { MODULE_TYPES, localAxes, footprint } from './modules.js';

export const LIGHT_KINDS = [['ambiente', 'Ambiente'], ['spot', 'Spot'], ['lineal', 'Lineal (LED)']];

// Luz de un módulo luminaria: posición (mm, del ambiente), dirección y propiedades.
export function lightOf(mod) {
  const def = MODULE_TYPES[mod.type];
  if (!def?.light) return null;
  const p = mod.params;
  const { fw, fd } = footprint(mod);
  const { ex, ez } = localAxes(mod.rot || 0);
  const [lx, ly, lz] = def.light.at(p); // punto de la luz en coordenadas del módulo (desde su centro en planta)
  const cx = mod.x + fw / 2, cz = mod.z + fd / 2;
  const pos = [cx + ex[0] * lx + ez[0] * lz, (mod.y || 0) + ly, cz + ex[1] * lx + ez[1] * lz];
  // inclinación: 0 = para abajo; positiva = hacia el frente del módulo
  const t = ((p.tilt || 0) * Math.PI) / 180;
  const dir = [ez[0] * Math.sin(t), -Math.cos(t), ez[1] * Math.sin(t)];
  return {
    id: mod.id, kind: def.light.kind, pos, dir,
    color: p.lightColor || '#fff1d6', intensity: Math.min(2, Math.max(0, +p.lightI || 0)),
    shadow: p.shadow !== 'no', transparency: p.transparency !== 'no',
    angle: p.beam ?? 40, falloff: Math.max(p.falloff ?? 60, p.beam ?? 40), // el falloff tiene que ser mayor que la apertura
    length: def.light.kind === 'lineal' ? p.width : 0, axis: ex,
  };
}

export const lightsOf = (project) => project.modules.filter((m) => !m.hidden).map(lightOf).filter(Boolean);

// Ancho del cono para three (radianes) y penumbra (0–1) a partir de apertura y falloff (grados).
export function spotCone(angle, falloff) {
  const outer = Math.min(89, Math.max(angle, falloff)) / 2;
  return { angle: (outer * Math.PI) / 180, penumbra: outer > 0 ? Math.min(1, Math.max(0, 1 - angle / 2 / outer)) : 0 };
}
