// Atajos de movimiento de Promob: Ctrl+flechas lleva el módulo hasta el obstáculo más cercano
// ("Para máxima derecha / izquierda / atrás / frente"), Ctrl+Inicio lo centra a lo ancho
// ("Centralizar X"), Shift+mouse lo gira e I lo invierte (espeja izquierda ↔ derecha).

import { nearestDistances } from './dimensions.js';

const AXIS = { '-x': [-1, 0], '+x': [1, 0], '-z': [0, -1], '+z': [0, 1] };

// Hasta tocar lo que tiene en esa dirección (pared, columna u otro módulo a la misma altura).
export function toExtreme(mod, room, modules, dir) {
  const d = nearestDistances(mod, room, modules).find((x) => x.dir === dir);
  if (!d) return { x: mod.x, z: mod.z };
  const [ux, uz] = AXIS[dir];
  return { x: Math.round(mod.x + ux * d.dist), z: Math.round(mod.z + uz * d.dist) };
}

// Centrado a lo ancho (x) entre lo que tiene a la izquierda y a la derecha.
export function centerX(mod, room, modules) {
  const ds = nearestDistances(mod, room, modules);
  const l = ds.find((x) => x.dir === '-x')?.dist ?? 0;
  const r = ds.find((x) => x.dir === '+x')?.dist ?? 0;
  if (!ds.some((x) => x.dir === '-x') || !ds.some((x) => x.dir === '+x')) return { x: mod.x };
  return { x: Math.round(mod.x + (r - l) / 2) };
}

// Invertir: el esquinero cambia de lado y las puertas abren para el otro lado.
// `fronts` = frentes del módulo construido ({ k, kind, hinge }).
export function invertModule(mod, fronts = []) {
  const p = { ...mod.params };
  if (p.side === 'izq' || p.side === 'der') p.side = p.side === 'izq' ? 'der' : 'izq';
  const doors = fronts.filter((f) => f.kind === 'door' && f.hinge);
  if (doors.length) p.hinges = { ...(p.hinges || {}), ...Object.fromEntries(doors.map((f) => [f.k, f.hinge === 'izq' ? 'der' : 'izq'])) };
  return { ...mod, params: p };
}

// Shift + mover el mouse: grados de giro según lo que se corrió en horizontal (de a 1°).
export function shiftRotation(rot0, dxPx, degPerPx = 0.5) {
  return ((Math.round(rot0 + dxPx * degPerPx) % 360) + 360) % 360;
}
