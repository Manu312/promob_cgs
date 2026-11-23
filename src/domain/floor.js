// Piso (Promob): Ajustar límites del piso (sigue las paredes), Crear piso padrón (5000 × 5000),
// Alterar forma del piso (editar sus vértices) y la grilla del piso ("Editar Grid do Piso"):
// líneas cada tanto que atraen a los módulos cuando se acercan a menos de `gap`.

export const DEFAULT_FLOOR_GRID = { show: false, attract: false, gap: 50, ix: 600, iz: 600 };
export const STANDARD_FLOOR = 5000;

export function floorGridOf(room) {
  const g = room.floor?.grid || {};
  const n = (v, d, min = 1) => (Number.isFinite(+v) && +v >= min ? +v : d);
  return { show: !!g.show, attract: !!g.attract, gap: n(g.gap, DEFAULT_FLOOR_GRID.gap, 0), ix: n(g.ix, DEFAULT_FLOOR_GRID.ix, 10), iz: n(g.iz, DEFAULT_FLOOR_GRID.iz, 10) };
}

// Ajustar límites del piso: vuelve a seguir las paredes.
export function fitFloor(room) {
  return { ...room, floor: { ...(room.floor || {}), auto: true, pts: undefined } };
}

// Piso padrón: un cuadrado de 5000 × 5000 desde la esquina del ambiente.
export function standardFloor(room, x0 = 0, z0 = 0) {
  const s = STANDARD_FLOOR;
  return setFloorShape(room, [[x0, z0], [x0 + s, z0], [x0 + s, z0 + s], [x0, z0 + s]]);
}

// Forma propia del piso (deja de seguir las paredes).
export function setFloorShape(room, pts) {
  if (!Array.isArray(pts) || pts.length < 3) return room;
  return { ...room, floor: { ...(room.floor || {}), auto: false, pts: pts.map(([x, z]) => [Math.round(x), Math.round(z)]) } };
}

export function setFloorGrid(room, patch) {
  return { ...room, floor: { ...(room.floor || {}), grid: { ...floorGridOf(room), ...patch } } };
}

// Atracción de la grilla del piso: si un borde del módulo (huella fw × fd en x, z) queda a menos
// de `gap` de una línea, se pega a ella.
export function snapToFloorGrid(x, z, fw, fd, grid) {
  if (!grid?.attract) return { x, z };
  const pull = (lo, size, step) => {
    let best = null;
    for (const edge of [lo, lo + size]) {
      const line = Math.round(edge / step) * step;
      const d = line - edge;
      if (Math.abs(d) <= grid.gap && (best == null || Math.abs(d) < Math.abs(best))) best = d;
    }
    return best == null ? lo : lo + best;
  };
  return { x: Math.round(pull(x, fw, grid.ix)), z: Math.round(pull(z, fd, grid.iz)) };
}

// Agregar un vértice en el medio del lado i, o quitar uno (mínimo 3).
export function addFloorVertex(pts, i) {
  const a = pts[i], b = pts[(i + 1) % pts.length];
  return [...pts.slice(0, i + 1), [Math.round((a[0] + b[0]) / 2), Math.round((a[1] + b[1]) / 2)], ...pts.slice(i + 1)];
}
export function removeFloorVertex(pts, i) {
  return pts.length > 3 ? pts.filter((_, k) => k !== i) : pts;
}
