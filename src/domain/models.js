// Panel Modelos (como Promob): qué material tiene cada tipo de pieza y cómo se cambia.
// "Todos" cambia el del proyecto (y lo que se inserte después) y quita lo que cada
// módulo tuviera propio en ese tipo de pieza; "Selección" cambia solo los módulos elegidos.
import { slotIds } from './catalog.js';

export function effectiveModel(project, slot, mod = null) {
  const own = mod ? slotIds(mod.mats)[slot] : undefined;
  if (own) return { id: own, inherited: false };
  return { id: slotIds(project.defaults, { fill: true })[slot], inherited: !!mod };
}

export function applyModel(project, slot, id, scope = 'todos', moduleIds = []) {
  if (scope === 'todos') {
    const modules = project.modules.map((m) => {
      if (!m.mats || m.mats[slot] === undefined) return m;
      const { [slot]: _drop, ...rest } = m.mats; // eslint-disable-line no-unused-vars
      return { ...m, mats: rest };
    });
    return { ...project, defaults: { ...slotIds(project.defaults, { fill: true }), [slot]: id }, modules };
  }
  const set = new Set(moduleIds);
  return {
    ...project,
    modules: project.modules.map((m) => {
      if (!set.has(m.id)) return m;
      const mats = { ...(m.mats || {}) };
      if (id == null) delete mats[slot]; else mats[slot] = id; // null = volver a "igual que Todos"
      return { ...m, mats };
    }),
  };
}
