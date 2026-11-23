// Encastre (como los electrodomésticos empotrados de Promob): la bacha o el anafe sobre un bajo con
// mesada, el horno o el microondas en el hueco de una torre. Al soltarlos sobre el mueble se
// acomodan solos y quedan enganchados (`hostId` + posición relativa `hostLocal`): si el mueble se
// mueve, gira o se borra, lo acompañan. Se pueden elegir solos; arrastrados afuera se desenganchan.

import { footprint, localAxes, MODULE_TYPES } from './modules.js';

export const TOP_GUESTS = ['bacha', 'anafe']; // van sobre la mesada (la calan)
export const NICHE_GUESTS = ['horno', 'microondas']; // van en el hueco de una torre

export const guestKind = (m) => (TOP_GUESTS.includes(m?.type) ? 'top' : NICHE_GUESTS.includes(m?.type) ? 'niche' : null);

const center = (m) => { const { fw, fd } = footprint(m); return [m.x + fw / 2, m.z + fd / 2]; };

// Coordenadas del módulo: x a lo ancho (0..W), z de atrás (0) al frente (D), alrededor de su centro.
export function toWorld(host, lx, lz) {
  const { ex, ez } = localAxes(host.rot || 0);
  const [cx, cz] = center(host);
  const ux = lx - host.params.width / 2, uz = lz - host.params.depth / 2;
  return [cx + ex[0] * ux + ez[0] * uz, cz + ex[1] * ux + ez[1] * uz];
}
export function toLocal(host, wx, wz) {
  const { ex, ez } = localAxes(host.rot || 0);
  const [cx, cz] = center(host);
  const dx = wx - cx, dz = wz - cz;
  return [dx * ex[0] + dz * ex[1] + host.params.width / 2, dx * ez[0] + dz * ez[1] + host.params.depth / 2];
}

// ¿El punto (planta) cae dentro de la huella del módulo?
export function insideHost(host, wx, wz, margin = 0) {
  const [lx, lz] = toLocal(host, wx, wz);
  return lx >= -margin && lx <= host.params.width + margin && lz >= -margin && lz <= host.params.depth + margin;
}

// Hueco de la torre (alto útil desde el piso del módulo), a partir de sus piezas: arriba del
// piso + nicheY, y que entre el alto del hueco debajo del techo.
export function nicheOf(host, built) {
  const p = host.params;
  if (!(p.nicheH > 0)) return null;
  const parts = built?.parts || [];
  const piso = parts.find((x) => x.name === 'Piso');
  const techo = parts.find((x) => x.name === 'Techo' || x.name === 'Travesaño');
  const lat = parts.find((x) => x.name === 'Lateral' || x.name?.startsWith('Lateral'));
  const t = lat?.sx || 18;
  const yIn0 = piso ? piso.y + piso.sy : (p.plinth || 0) + t;
  const yIn1 = techo ? techo.y : p.height - t;
  const h = Math.min(p.nicheH, yIn1 - yIn0);
  const y0 = Math.min(yIn0 + (p.nicheY || 0), yIn1 - h);
  return { y0, h, x0: t, w: p.width - 2 * t };
}

// ¿Este mueble puede recibir a este artefacto?
export function canHost(host, guest, built) {
  if (!host || host.id === guest.id || MODULE_TYPES[host.type]?.kind === 'aparato') return false;
  const k = guestKind(guest);
  if (k === 'top') return host.params.mesada === 'si' && guest.params.width <= host.params.width + 1;
  if (k === 'niche') {
    const n = nicheOf(host, built);
    // el frente del horno tapa los laterales: alcanza con que entre en el ancho del mueble
    return !!n && guest.params.width <= host.params.width + 1 && guest.params.height <= n.h + 1;
  }
  return false;
}

// Pose del artefacto encastrado: bacha centrada sobre la mesada; horno centrado en el hueco, con
// el frente al ras del mueble. Devuelve el artefacto con hostId y su posición relativa.
export function snapGuest(guest, host, built, modules = []) {
  const k = guestKind(guest);
  const W = host.params.width, D = host.params.depth;
  let lx = W / 2, lz, ly;
  if (k === 'top') {
    lz = D / 2;
    ly = host.params.height + (host.params.mesada === 'si' ? host.params.mesadaT || 0 : 0);
  } else {
    const n = nicheOf(host, built);
    // frente al ras; si el artefacto es más profundo que el mueble, al ras del fondo (no se mete en la pared)
    lz = Math.max(D - guest.params.depth / 2, guest.params.depth / 2);
    // se apilan: arriba de lo que ya está encastrado en el hueco (horno abajo, microondas arriba)
    const below = modules.filter((o) => o.hostId === host.id && o.id !== guest.id && guestKind(o) === 'niche');
    ly = (n ? n.y0 : 0) + below.reduce((s, o) => s + o.params.height, 0);
  }
  return attachAt(guest, host, { lx, lz, ly, drot: 0 });
}

function attachAt(guest, host, hostLocal) {
  return { ...guest, ...poseFrom(guest, host, hostLocal), hostId: host.id, hostLocal };
}

// Pose (x, z, y, rot) del artefacto a partir de su posición relativa al mueble.
export function poseFrom(guest, host, { lx, lz, ly, drot = 0 }) {
  const rot = (((host.rot || 0) + drot) % 360 + 360) % 360;
  const [wx, wz] = toWorld(host, lx, lz);
  const { fw, fd } = footprint({ ...guest, rot });
  return { x: Math.round(wx - fw / 2), z: Math.round(wz - fd / 2), y: Math.round((host.y || 0) + ly), rot };
}

export function detach(guest) {
  const { hostId: _h, hostLocal: _l, ...rest } = guest; // eslint-disable-line no-unused-vars
  return rest;
}

// El mueble que recibiría al artefacto si se suelta acá: el que tiene debajo su centro.
export function findHost(guest, modules, builtById) {
  const [cx, cz] = center(guest);
  return modules.find((h) => insideHost(h, cx, cz) && canHost(h, guest, builtById?.get?.(h.id))) || null;
}

// Módulos enganchados a `id` (sus artefactos, o su mueble): no chocan entre sí.
export function linkedIds(modules, id) {
  const m = modules.find((o) => o.id === id);
  return modules.filter((o) => o.id !== id && (o.hostId === id || (m?.hostId && o.id === m.hostId))).map((o) => o.id);
}

const samePose = (a, b) => a && b && a.x === b.x && a.z === b.z && (a.y || 0) === (b.y || 0) && (a.rot || 0) === (b.rot || 0);

// Después de cada cambio del proyecto: los artefactos acompañan a su mueble; si se movió el
// artefacto solo, se actualiza su posición relativa (o se desengancha si salió del mueble); si se
// borró el mueble, se van con él.
export function syncGuests(prev, next) {
  if (!next?.modules?.some((m) => m.hostId)) return next;
  const before = new Map((prev?.modules || []).map((m) => [m.id, m]));
  const byId = new Map(next.modules.map((m) => [m.id, m]));
  let changed = false;
  const modules = [];
  for (const g of next.modules) {
    if (!g.hostId) { modules.push(g); continue; }
    const h = byId.get(g.hostId);
    if (!h) { changed = true; continue; } // se borró el mueble: el artefacto se va con él
    const hp = before.get(h.id), gp = before.get(g.id);
    const hostMoved = !samePose(h, hp) || h.params.width !== hp?.params.width || h.params.depth !== hp?.params.depth || h.params.height !== hp?.params.height;
    const guestMoved = !samePose(g, gp);
    if (hostMoved && g.hostLocal) {
      const pose = poseFrom(g, h, g.hostLocal);
      if (!samePose(pose, g)) changed = true;
      modules.push({ ...g, ...pose });
    } else if (guestMoved) {
      changed = true;
      const [cx, cz] = center(g);
      if (!insideHost(h, cx, cz)) { modules.push(detach(g)); continue; }
      const [lx, lz] = toLocal(h, cx, cz);
      modules.push({ ...g, hostLocal: { lx, lz, ly: (g.y || 0) - (h.y || 0), drot: (((g.rot || 0) - (h.rot || 0)) % 360 + 360) % 360 } });
    } else modules.push(g);
  }
  return changed ? { ...next, modules } : next;
}
