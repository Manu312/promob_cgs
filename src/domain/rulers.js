// Réguas (Promob): grupos de reglas de altura que se asignan a una pared (clic derecho → Reglas)
// y atraen a los módulos: si el borde de abajo o de arriba queda a menos del gap de una regla,
// se pega a ella. Se ven con Mostrar → Grilla y reglas. Los grupos se editan (Editar reglas) y
// quedan guardados para todos los proyectos.

export const DEFAULT_RULER_GROUPS = [
  { id: 'cocina', name: 'Cocina', attract: true, gap: 30, rulers: [{ value: 150, text: 'Zócalo' }, { value: 870, text: 'Mesada' }, { value: 1450, text: 'Alacenas (abajo)' }, { value: 2150, text: 'Alacenas (arriba)' }] },
  { id: 'dormitorio', name: 'Dormitorio', attract: true, gap: 30, rulers: [{ value: 80, text: 'Zócalo' }, { value: 2100, text: 'Maletero' }, { value: 2400, text: 'Placard' }] },
  { id: 'bano', name: 'Baño', attract: true, gap: 30, rulers: [{ value: 800, text: 'Vanitory' }, { value: 1100, text: 'Espejo (abajo)' }, { value: 1900, text: 'Espejo (arriba)' }] },
];

export function rulerGroups(saved) {
  return Array.isArray(saved) && saved.length ? saved : DEFAULT_RULER_GROUPS;
}

// Reglas de la pared (las de su grupo), ordenadas por altura.
export function wallRulers(wall, groups) {
  const g = groups.find((x) => x.id === wall?.rulerGroup);
  return g ? { ...g, rulers: [...g.rulers].sort((a, b) => a.value - b.value) } : null;
}

// Atraer: y (abajo) de un módulo de alto h a la regla más cercana (por abajo o por arriba).
export function snapToRulers(y, h, group) {
  if (!group?.attract) return y;
  let best = null;
  for (const r of group.rulers) {
    for (const d of [r.value - y, r.value - (y + h)]) if (Math.abs(d) <= group.gap && (best == null || Math.abs(d) < Math.abs(best))) best = d;
  }
  return best == null ? y : Math.max(0, Math.round(y + best));
}

// Editar grupos: agregar grupo / regla, cambiar y quitar.
let seq = 0;
export const addRulerGroup = (groups, name) => [...groups, { id: `rg${Date.now().toString(36)}${seq++}`, name: name.trim() || 'Grupo', attract: true, gap: 30, rulers: [] }];
export const updateRulerGroup = (groups, id, patch) => groups.map((g) => (g.id === id ? { ...g, ...patch } : g));
export const removeRulerGroup = (groups, id) => groups.filter((g) => g.id !== id);
export const addRuler = (groups, id, value = 1000, text = '') => groups.map((g) => (g.id === id ? { ...g, rulers: [...g.rulers, { value, text }] } : g));
export const updateRuler = (groups, id, i, patch) => groups.map((g) => (g.id === id ? { ...g, rulers: g.rulers.map((r, k) => (k === i ? { ...r, ...patch } : r)) } : g));
export const removeRuler = (groups, id, i) => groups.map((g) => (g.id === id ? { ...g, rulers: g.rulers.filter((_, k) => k !== i) } : g));
