// Lista de Módulos (como Promob): los módulos agrupados por plano de inserción. Un módulo
// apoyado en una pared (espalda contra su cara interior) va en esa pared; el resto, en el piso.
import { moduleName } from './modules.js';
import { roomWalls } from './room.js';
import { modulesOnWall } from './wallEdit.js';

export function moduleTree(project) {
  const { room, modules } = project;
  const placed = new Set();
  const planes = [];
  for (const g of roomWalls(room)) {
    const ids = modulesOnWall(room, g.id, modules).filter((id) => !placed.has(id));
    ids.forEach((id) => placed.add(id));
    planes.push({ kind: 'wall', id: g.id, label: `Pared ${g.i + 1}`, ids });
  }
  planes.push({ kind: 'floor', id: 'floor', label: 'Piso', ids: modules.filter((m) => !placed.has(m.id)).map((m) => m.id) });
  return planes.filter((p) => p.ids.length);
}

// Etiqueta de un módulo en la lista: número de orden (como en el despiece), nombre y medidas.
export function moduleRowLabel(project, id) {
  const i = project.modules.findIndex((m) => m.id === id);
  const m = project.modules[i];
  if (!m) return '';
  const { width, height, depth } = m.params;
  return `M${i + 1} · ${moduleName(m)} · ${width}×${height}×${depth}`;
}

export const toggleHidden = (project, ids) => {
  const set = new Set(ids);
  const anyVisible = project.modules.some((m) => set.has(m.id) && !m.hidden);
  return { ...project, modules: project.modules.map((m) => (set.has(m.id) ? { ...m, hidden: anyVisible } : m)) };
};

export const removeModules = (project, ids) => {
  const set = new Set(ids);
  return { ...project, modules: project.modules.filter((m) => !set.has(m.id)) };
};
