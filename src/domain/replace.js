// Sustitución rápida (Promob: S o Ctrl+Shift+K) y Ubicar en el catálogo (Ctrl+Shift+L).

import { flatItems } from './library.js';

// El módulo nuevo ocupa el lugar del viejo: misma posición, giro, altura, materiales, grupo y
// visibilidad; tipo, medidas y agregados son los del ítem elegido.
export function replaceModule(old, fresh) {
  const out = { ...fresh, id: old.id, x: old.x, z: old.z, y: old.y ?? fresh.y ?? 0, rot: old.rot || 0, mats: { ...(old.mats || {}) } };
  if (old.groupId) out.groupId = old.groupId;
  if (old.hidden) out.hidden = true;
  return out;
}

// Ítem del catálogo del que salió el módulo: por el id guardado al insertarlo; si no lo tiene
// (proyectos viejos), el primero del mismo tipo con el mismo ancho, o el primero del tipo.
export function findItemForModule(mod, lib) {
  const all = flatItems(lib);
  if (mod.itemId) {
    const hit = all.find((x) => x.item.id === mod.itemId);
    if (hit) return hit;
  }
  const same = all.filter((x) => x.item.type === mod.type);
  return same.find((x) => x.item.params?.width === mod.params?.width) || same[0] || null;
}
