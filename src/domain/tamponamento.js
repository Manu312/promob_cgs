// Ítems lineales sobre varios módulos y Editor de Tamponamentos (Promob).
// - Lineales: una tapa o un estante arrastrado sobre varios módulos los cubre a todos.
// - Tamponamento: tapas (arriba) y laterales (vistas a los costados) para un conjunto de módulos,
//   con alineación, offset (separación) y profundidad; inserción automática con prioridad:
//   si van primero las tapas, los laterales crecen hasta cubrirlas; si van primero los laterales,
//   la tapa crece hasta cubrirlos.

import { footprint, localAxes, MODULE_TYPES } from './modules.js';

// Ítems registrados por defecto ("Cadastrar itens"); el usuario puede agregar los suyos.
export const DEFAULT_TOP_ITEMS = [
  { id: 'mesada-20', label: 'Mesada de piedra 20 mm', kind: 'tapa', type: 'tapa', thickness: 20, depthExtra: 20, offset: 0, align: 'frente' },
  { id: 'tapa-18', label: 'Tapa melamina 18 mm', kind: 'tapa', type: 'tapa', thickness: 18, depthExtra: 0, offset: 0, align: 'frente' },
  { id: 'estante-18', label: 'Estante 18 mm', kind: 'tapa', type: 'estante', thickness: 18, depthExtra: 0, offset: 0, align: 'atras' },
  { id: 'lateral-18', label: 'Lateral (vista) 18 mm', kind: 'lateral', type: 'vista', thickness: 18, depthExtra: 0, offset: 0, align: 'frente' },
];

// Extensión de un conjunto de módulos en su propio eje (todos con el mismo giro que el primero):
// s0..s1 a lo largo (mm, sobre ex), b0 = fondo (sobre ez), profundidad máxima, techo y piso.
export function linearSpan(mods) {
  if (!mods.length) return null;
  const rot = mods[0].rot || 0;
  const { ex, ez } = localAxes(rot);
  let s0 = Infinity, s1 = -Infinity, b0 = Infinity, depth = 0, top = 0, bottom = Infinity;
  for (const m of mods) {
    const { fw, fd } = footprint(m);
    for (const [x, z] of [[m.x, m.z], [m.x + fw, m.z], [m.x, m.z + fd], [m.x + fw, m.z + fd]]) {
      s0 = Math.min(s0, x * ex[0] + z * ex[1]); s1 = Math.max(s1, x * ex[0] + z * ex[1]);
      b0 = Math.min(b0, x * ez[0] + z * ez[1]);
    }
    depth = Math.max(depth, m.params.depth);
    top = Math.max(top, (m.y || 0) + m.params.height);
    bottom = Math.min(bottom, m.y || 0);
  }
  return { rot, ex, ez, s0, s1, b0, depth, top, bottom };
}

// Posición (x, z) de un módulo de ancho × fondo cuyo frente-izquierda local cae en (s, b) del eje.
function placeAt(span, s, b, width, depth) {
  const { ex, ez, rot } = span;
  const cs = s + width / 2, cb = b + depth / 2;
  const cx = ex[0] * cs + ez[0] * cb, cz = ex[1] * cs + ez[1] * cb;
  const { fw, fd } = footprint({ rot, params: { width, depth } });
  return { x: Math.round(cx - fw / 2), z: Math.round(cz - fd / 2) };
}

// Tapa / estante que cubre el conjunto (de s0 a s1, o el tramo [a, b] indicado), arriba de todo.
export function linearItemFor(mods, item, seg = null) {
  const sp = linearSpan(mods);
  if (!sp) return null;
  const a = seg ? seg[0] : sp.s0, b = seg ? seg[1] : sp.s1;
  const width = Math.round(b - a);
  const depth = Math.round(sp.depth + (item.depthExtra || 0));
  const y = item.align === 'abajo' ? Math.max(0, sp.bottom - item.thickness - (item.offset || 0)) : sp.top + (item.offset || 0);
  const params = { ...MODULE_TYPES[item.type].defaults, width, depth, height: item.thickness, ...(item.type === 'tapa' ? { mesadaT: item.thickness } : {}) };
  return { type: item.type, rot: sp.rot, y, params, ...placeAt(sp, a, sp.b0, width, depth) };
}

// Tramos de la tapa según los clics en la vista frontal: el orden de los clics define las uniones.
export function segmentsFromClicks(s0, s1, clicks) {
  const cuts = [...new Set(clicks.map((c) => Math.round(Math.min(s1, Math.max(s0, c)))))].filter((c) => c > s0 && c < s1).sort((x, y) => x - y);
  const pts = [s0, ...cuts, s1];
  return pts.slice(0, -1).map((p, i) => [p, pts[i + 1]]);
}

// ¿El ítem no alcanza a cubrir los módulos? (Promob pregunta si ajustar las medidas.)
export function exceedsMax(mods, type) {
  const sp = linearSpan(mods);
  const max = MODULE_TYPES[type]?.max?.width ?? 4000;
  return sp ? sp.s1 - sp.s0 > max : false;
}

// Inserción automática: tapas, laterales o ambos, con prioridad.
export function autoTamponamento(mods, { top = DEFAULT_TOP_ITEMS[0], side = DEFAULT_TOP_ITEMS[3], mode = 'ambos', priority = 'tapas' } = {}) {
  const sp = linearSpan(mods);
  if (!sp) return [];
  const out = [];
  const withTop = mode !== 'laterales', withSide = mode !== 'tapas';
  const t = side.thickness;
  if (withTop) {
    const grow = withSide && priority === 'laterales' ? t : 0; // la tapa cubre también los laterales
    out.push(linearItemFor(mods, top, [sp.s0 - grow, sp.s1 + grow]));
  }
  if (withSide) {
    const h = sp.top - sp.bottom + (withTop && priority === 'tapas' ? top.thickness : 0); // el lateral sube hasta tapar la tapa
    const depth = Math.round(sp.depth + (withTop && priority === 'tapas' ? top.depthExtra || 0 : 0));
    for (const s of [sp.s0 - t, sp.s1]) {
      out.push({ type: side.type, rot: sp.rot, y: sp.bottom, params: { ...MODULE_TYPES[side.type].defaults, width: t, height: h, depth }, ...placeAt(sp, s, sp.b0, t, depth) });
    }
  }
  return out;
}
