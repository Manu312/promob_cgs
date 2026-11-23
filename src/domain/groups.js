// Grupos de módulos (como Promob: U agrupa, Ctrl+U desagrupa, también desde el menú del clic
// derecho). Un grupo se selecciona, mueve, gira y borra como una sola cosa. Solo agrupa
// módulos del proyecto (no paredes ni el plano donde están).

let seq = 0;
const newGroupId = () => `g${Date.now().toString(36)}${(seq++).toString(36)}`;

// Los ids más todos los integrantes de los grupos a los que pertenecen.
export function expandToGroups(project, ids) {
  const groups = new Set(project.modules.filter((m) => ids.includes(m.id) && m.groupId).map((m) => m.groupId));
  if (!groups.size) return ids;
  const out = [...ids];
  for (const m of project.modules) if (m.groupId && groups.has(m.groupId) && !out.includes(m.id)) out.push(m.id);
  return out;
}

// Agrupa la selección (si ya tenía grupos adentro, quedan todos en uno nuevo). Hace falta más de un módulo.
export function groupModules(project, ids, gid = newGroupId()) {
  const all = expandToGroups(project, ids);
  if (all.length < 2) return project;
  return { ...project, modules: project.modules.map((m) => (all.includes(m.id) ? { ...m, groupId: gid } : m)) };
}

// Desagrupa los grupos que toca la selección.
export function ungroupModules(project, ids) {
  const groups = new Set(project.modules.filter((m) => ids.includes(m.id) && m.groupId).map((m) => m.groupId));
  if (!groups.size) return project;
  return {
    ...project,
    modules: project.modules.map((m) => {
      if (!m.groupId || !groups.has(m.groupId)) return m;
      const { groupId, ...rest } = m; // eslint-disable-line no-unused-vars
      return rest;
    }),
  };
}

// ¿La selección es exactamente un grupo?
export function selectionGroup(project, ids) {
  const mods = project.modules.filter((m) => ids.includes(m.id));
  const g = mods[0]?.groupId;
  if (!g || !mods.every((m) => m.groupId === g)) return null;
  const n = project.modules.filter((m) => m.groupId === g).length;
  return n === mods.length ? g : null;
}

// Si un grupo queda con un solo integrante (se borró el resto), deja de ser grupo.
export function pruneGroups(project) {
  const count = new Map();
  for (const m of project.modules) if (m.groupId) count.set(m.groupId, (count.get(m.groupId) || 0) + 1);
  if (![...count.values()].some((n) => n < 2)) return project;
  return {
    ...project,
    modules: project.modules.map((m) => {
      if (!m.groupId || count.get(m.groupId) > 1) return m;
      const { groupId, ...rest } = m; // eslint-disable-line no-unused-vars
      return rest;
    }),
  };
}
