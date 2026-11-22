// Texto de la barra de estado para el elemento seleccionado.

import { roomWalls, OPENING_TYPES } from './room.js';
import { MODULE_TYPES } from './modules.js';

const area = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function describeSelection(project, sel) {
  if (!sel) return '';
  if (sel.kind === 'wall') {
    const g = roomWalls(project.room).find((w) => w.id === sel.id);
    if (!g) return '';
    const { h0, h1, t } = g.wall;
    const h = h0 === h1 ? `${h0}` : `${h0}–${h1}`;
    return `Pared ${g.i + 1} · ${g.len} × ${t} × ${h} · ${area.format((g.len * (h0 + h1)) / 2 / 1e6)} m²`;
  }
  if (sel.kind === 'opening') {
    const o = project.room.openings.find((x) => x.id === sel.id);
    if (!o) return '';
    const i = project.room.walls.findIndex((w) => w.id === o.wallId);
    return `${OPENING_TYPES[o.type]?.label || o.type} · ${o.width} × ${o.height}${o.sill ? ` · antepecho ${o.sill}` : ''} · Pared ${i + 1}`;
  }
  if (sel.kind === 'column') {
    const c = project.room.columns.find((x) => x.id === sel.id);
    return c ? `Columna · ${c.w} × ${c.d}` : '';
  }
  if (sel.kind === 'module') {
    const m = project.modules.find((x) => x.id === sel.id);
    if (!m) return '';
    const { width, height, depth } = m.params;
    return `${MODULE_TYPES[m.type]?.label || m.type} · ${width} × ${height} × ${depth}`;
  }
  return '';
}
