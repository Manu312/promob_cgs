// Módulos favoritos (Promob): guardar un módulo o un conjunto ya configurado (con sus agregados,
// medidas y materiales) con nombre, descripción, imagen y grupo; insertarlo después desde la barra
// de modulación y exportar o importar la lista como archivo.

import { MODULE_TYPES, footprint } from './modules.js';

export const FAVORITES_FORMAT = 'mueblesapp-favoritos';
const IMAGE_RE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
const MAX_IMAGE = 400_000; // caracteres del data URL

const clean = (s, n) => String(s ?? '').slice(0, n).trim();
const safeImage = (img) => (typeof img === 'string' && img.length <= MAX_IMAGE && IMAGE_RE.test(img) ? img : null);

// Los módulos quedan relativos al primero (posición y giro), sin ids ni grupos.
export function makeFavorite(mods, { name, desc = '', group = '', image = null } = {}, id = `fav${Date.now().toString(36)}`) {
  if (!mods.length) return null;
  const b = mods[0];
  const modules = mods.map(({ id: _i, groupId: _g, ...m }) => ({ ...m, x: m.x - b.x, z: m.z - b.z, y: (m.y || 0) - (b.y || 0) })); // eslint-disable-line no-unused-vars
  return { id, name: clean(name, 80) || 'Favorito', desc: clean(desc, 400), group: clean(group, 40), image: safeImage(image), y0: b.y || 0, modules };
}

// Instancia: el primer módulo va a la pose `at` ({ x, z, y, rot }); el resto gira con él.
export function placeFavorite(fav, at, newId) {
  const m0 = fav.modules[0];
  const dRot = (((at.rot ?? m0.rot ?? 0) - (m0.rot || 0)) % 360 + 360) % 360;
  const f0 = footprint(m0), c0 = [f0.fw / 2, f0.fd / 2]; // centro del primero (relativo)
  const fa = footprint({ ...m0, rot: (m0.rot || 0) + dRot });
  const ca = [at.x + fa.fw / 2, at.z + fa.fd / 2]; // centro del primero en el destino
  const rad = (dRot * Math.PI) / 180, cs = Math.cos(rad), sn = Math.sin(rad);
  const gid = fav.modules.length > 1 ? `g${newId()}` : null;
  return fav.modules.map((m) => {
    const f = footprint(m);
    const d = [m.x + f.fw / 2 - c0[0], m.z + f.fd / 2 - c0[1]];
    // mismo giro que rotateGroup (antihorario visto desde arriba)
    const r = [d[0] * cs + d[1] * sn, -d[0] * sn + d[1] * cs];
    const rot = (((m.rot || 0) + dRot) % 360 + 360) % 360;
    const fr = footprint({ ...m, rot });
    return { ...m, id: newId(), rot, x: Math.round(ca[0] + r[0] - fr.fw / 2), z: Math.round(ca[1] + r[1] - fr.fd / 2), y: (at.y ?? fav.y0 ?? 0) + m.y, ...(gid ? { groupId: gid } : {}) };
  });
}

// Ítem de la barra de modulación (pestaña Favoritos).
export function favoriteItem(fav) {
  const m0 = fav.modules[0];
  return { id: `fav:${fav.id}`, label: fav.name, type: m0.type, params: m0.params, y: fav.y0 ?? 0, favorite: fav, image: fav.image, desc: fav.desc };
}

export function favoriteGroups(list) {
  return [...new Set(list.map((f) => f.group || 'General'))];
}

export const updateFavorite = (list, id, patch) => list.map((f) => (f.id === id ? { ...f, ...patch, name: clean(patch.name ?? f.name, 80) || f.name } : f));
export const removeFavorite = (list, id) => list.filter((f) => f.id !== id);

export function exportFavorites(list) {
  return JSON.stringify({ format: FAVORITES_FORMAT, version: 1, favorites: list }, null, 1);
}

// Importar: valida formato, tipos de módulo e imagen (solo data URL de imagen; nada externo).
// Los que tienen el mismo id se reemplazan; devuelve { list, added } o { error }.
export function importFavorites(text, existing = []) {
  let data;
  try { data = JSON.parse(text); } catch { return { error: 'El archivo no es un JSON válido.' }; }
  if (data?.format !== FAVORITES_FORMAT || !Array.isArray(data.favorites)) return { error: 'No es un archivo de favoritos de MueblesApp.' };
  const ok = [];
  for (const f of data.favorites) {
    if (!f || typeof f.id !== 'string' || !Array.isArray(f.modules) || !f.modules.length) continue;
    if (!f.modules.every((m) => m && MODULE_TYPES[m.type] && m.params && typeof m.params === 'object' && [m.x, m.z].every(Number.isFinite))) continue;
    const modules = f.modules.map((m) => ({ ...m, y: Number.isFinite(m.y) ? m.y : 0, rot: Number.isFinite(m.rot) ? m.rot : 0, mats: m.mats && typeof m.mats === 'object' ? m.mats : {} }));
    ok.push({ y0: Number.isFinite(f.y0) ? f.y0 : 0, id: clean(f.id, 40), name: clean(f.name, 80) || 'Favorito', desc: clean(f.desc, 400), group: clean(f.group, 40), image: safeImage(f.image), modules });
  }
  if (!ok.length) return { error: 'El archivo no tiene favoritos válidos.' };
  const ids = new Set(ok.map((f) => f.id));
  return { list: [...existing.filter((f) => !ids.has(f.id)), ...ok], added: ok.length };
}
