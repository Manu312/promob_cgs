// Copiar / Cortar / Pegar y Duplicar (Ctrl+C, Ctrl+X, Ctrl+V, Ctrl+D), como Promob.
// Las copias son independientes (ids nuevos); si se copia un grupo, la copia es otro grupo.

import { uid } from './modules.js';
import { groupBounds } from './multiSelect.js';

// Copia profunda de los módulos, corridos (dx, dz, dy) y con ids y grupos nuevos.
export function cloneModules(mods, { dx = 0, dz = 0, dy = 0 } = {}, newId = uid) {
  const groups = new Map();
  return mods.map((m) => {
    const c = JSON.parse(JSON.stringify(m));
    c.id = newId();
    c.x = Math.round(m.x + dx);
    c.z = Math.round(m.z + dz);
    if (dy) c.y = Math.max(0, Math.round((m.y || 0) + dy));
    if (m.groupId) {
      if (!groups.has(m.groupId)) groups.set(m.groupId, `g${newId()}`);
      c.groupId = groups.get(m.groupId);
    }
    return c;
  });
}

// Desplazamiento por defecto de la copia: al lado, a la derecha del conjunto (en planta).
export function sideOffset(mods) {
  return { dx: Math.round(groupBounds(mods).w), dz: 0, dy: 0 };
}

// Pegar: agrega las copias corridas. Devuelve el proyecto y los ids nuevos (para seleccionarlos).
export function pasteModules(project, mods, offset, newId = uid) {
  const copies = cloneModules(mods, offset, newId);
  return { project: { ...project, modules: [...project.modules, ...copies] }, ids: copies.map((c) => c.id) };
}
