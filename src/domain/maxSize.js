// Tamaño máximo (clic derecho en el módulo, como Promob): estira ancho, profundidad o alto
// hasta el obstáculo más cercano a cada lado (pared, columna, otro módulo, techo).
import { localAxes, resizeModule, isSquare } from './modules.js';
import { nearestDistances, verticalDistances } from './dimensions.js';

const SIDES = { width: ['right', 'left'], depth: ['front', 'back'] };

// Dirección en el mundo ('+x', '-z', …) de la cara del módulo que mira hacia `local` (vector local).
const worldDir = (rot, handle) => {
  const { ex, ez } = localAxes(rot);
  const v = { right: ex, left: [-ex[0], -ex[1]], front: ez, back: [-ez[0], -ez[1]] }[handle];
  return Math.abs(v[0]) > 0.5 ? (v[0] > 0 ? '+x' : '-x') : (v[1] > 0 ? '+z' : '-z');
};

export function canMaxSize(mod) { return isSquare(mod.rot || 0); }

// `param`: 'width' | 'depth' | 'height'. Sin obstáculo de un lado, ese lado no crece.
export function maxSize(mod, param, room, modules) {
  if (param === 'height') {
    const up = verticalDistances(mod, room, modules).find((d) => d.dir === 'up');
    return up ? resizeModule(mod, 'top', up.dist) : mod;
  }
  if (!canMaxSize(mod)) return mod;
  let out = mod;
  for (const handle of SIDES[param]) {
    const dir = worldDir(mod.rot || 0, handle);
    const d = nearestDistances(out, room, modules.map((m) => (m.id === out.id ? out : m))).find((x) => x.dir === dir);
    if (d && d.dist > 0) out = resizeModule(out, handle, d.dist);
  }
  return out;
}
