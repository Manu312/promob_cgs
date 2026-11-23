// Selección de varios módulos (como Promob: Ctrl+clic suma o quita, Ctrl+T selecciona todo).
// Las acciones sobre la selección mueven el conjunto rígido: todos se corren lo mismo.

import { footprint } from './modules.js';
import { collideMove } from './collision.js';

// Ctrl+clic: suma el módulo si no estaba, lo quita si estaba.
export function toggleId(ids, id) {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
}

// Ctrl+T "Seleccionar todo": los módulos visibles.
export function selectAllIds(project) {
  return project.modules.filter((m) => !m.hidden).map((m) => m.id);
}

// Rectángulo en planta que ocupa la selección (mm) y su centro.
export function groupBounds(modules) {
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity, y1 = 0;
  for (const m of modules) {
    const { fw, fd } = footprint(m);
    x0 = Math.min(x0, m.x); z0 = Math.min(z0, m.z);
    x1 = Math.max(x1, m.x + fw); z1 = Math.max(z1, m.z + fd);
    y1 = Math.max(y1, (m.y || 0) + (m.params?.height || 0));
  }
  return { x0, z0, x1, z1, w: x1 - x0, d: z1 - z0, h: y1, cx: (x0 + x1) / 2, cz: (z0 + z1) / 2 };
}

// Cuánto puede correrse el conjunto en un eje sin chocar con lo que no está seleccionado.
function allowedAxis(mods, others, room, axis, delta) {
  if (!delta) return 0;
  let best = delta;
  for (const m of mods) {
    const tx = axis === 'x' ? m.x + delta : m.x;
    const tz = axis === 'z' ? m.z + delta : m.z;
    const r = collideMove(m, tx, tz, room, others);
    const got = axis === 'x' ? r.x - m.x : r.z - m.z;
    if (Math.abs(got) < Math.abs(best)) best = Math.sign(delta) === Math.sign(got) ? got : 0;
  }
  return best;
}

// Mueve rígidamente los módulos `ids` (dx, dz) a partir de `base` (posiciones al empezar el arrastre;
// por defecto las actuales). Con colisión, el conjunto se frena en el primer obstáculo de cada eje.
export function moveGroup(project, ids, dx, dz, { collision = false, base = null } = {}) {
  const src = base || project.modules;
  const set = new Set(ids);
  const start = src.filter((m) => set.has(m.id));
  if (!start.length) return project;
  let ax = Math.round(dx), az = Math.round(dz);
  if (collision) {
    const others = project.modules.filter((m) => !set.has(m.id));
    ax = allowedAxis(start, others, project.room, 'x', ax);
    const moved = start.map((m) => ({ ...m, x: m.x + ax }));
    az = allowedAxis(moved, others, project.room, 'z', az);
  }
  const pos = new Map(start.map((m) => [m.id, { x: m.x + ax, z: m.z + az }]));
  let changed = false;
  const modules = project.modules.map((m) => {
    const p = pos.get(m.id);
    if (!p || (p.x === m.x && p.z === m.z)) return m;
    changed = true;
    return { ...m, ...p };
  });
  return changed ? { ...project, modules } : project;
}

// Gira el conjunto `deg` grados alrededor del centro de la selección (cada módulo gira y se reubica).
export function rotateGroup(project, ids, deg) {
  const set = new Set(ids);
  const mods = project.modules.filter((m) => set.has(m.id));
  if (!mods.length) return project;
  const { cx, cz } = groupBounds(mods);
  const a = (deg * Math.PI) / 180;
  // rot crece en sentido antihorario visto desde arriba (x derecha, z hacia el frente)
  const c = Math.cos(a), s = Math.sin(a);
  return {
    ...project,
    modules: project.modules.map((m) => {
      if (!set.has(m.id)) return m;
      const f0 = footprint(m);
      const mx = m.x + f0.fw / 2 - cx, mz = m.z + f0.fd / 2 - cz;
      const nx = cx + mx * c + mz * s, nz = cz - mx * s + mz * c;
      const rot = ((((m.rot || 0) + deg) % 360) + 360) % 360;
      const f1 = footprint({ ...m, rot });
      return { ...m, rot, x: Math.round(nx - f1.fw / 2), z: Math.round(nz - f1.fd / 2) };
    }),
  };
}

// Texto de la barra de estado para varios módulos.
export function describeMulti(project, ids) {
  const mods = project.modules.filter((m) => ids.includes(m.id));
  if (mods.length < 2) return '';
  const b = groupBounds(mods);
  return `${mods.length} módulos seleccionados · ${Math.round(b.w)} × ${Math.round(b.h)} × ${Math.round(b.d)}`;
}
