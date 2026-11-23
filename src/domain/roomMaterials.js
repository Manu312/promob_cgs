// Materiales del ambiente (Promob "Materiais": arrastrar un material al piso o a una pared; en
// pared, "Cara" o "Todo"). Biblioteca propia: pinturas, revestimientos y pisos, con texturas que
// genera la app (nada de Promob). Cada superficie guarda el material y sus propiedades de
// mapeo: escala X/Y, rotación, espejado y tonalidad ("Mudar Tonalidade").

export const ROOM_MATERIAL_GROUPS = [['pinturas', 'Pinturas'], ['revestimientos', 'Revestimientos'], ['pisos', 'Pisos']];

const pint = (id, label, color) => ({ id, label, group: 'pinturas', kind: 'pintura', color });
const cer = (id, label, color, tile, joint = 2, jointColor = '#d4d0c8', group = 'revestimientos') => ({ id, label, group, kind: 'ceramica', color, tile, joint, jointColor });
const mad = (id, label, color, color2, tile) => ({ id, label, group: 'pisos', kind: 'madera', color, color2, tile });

export const ROOM_MATERIALS = [
  pint('pint-blanco', 'Blanco', '#f2f0ea'),
  pint('pint-hueso', 'Hueso', '#ece4d4'),
  pint('pint-gris', 'Gris perla', '#cfd0cc'),
  pint('pint-arena', 'Arena', '#d9c7a7'),
  pint('pint-salvia', 'Verde salvia', '#a9b59a'),
  pint('pint-petroleo', 'Azul petróleo', '#3f5c66'),
  pint('pint-terracota', 'Terracota', '#b9694a'),
  pint('pint-grafito', 'Grafito', '#4a4b4d'),
  cer('rev-blanco-30x60', 'Cerámica blanca 30 × 60', '#f4f4f1', [300, 600]),
  cer('rev-subway', 'Azulejo subway 7,5 × 15', '#f7f7f4', [150, 75], 2, '#cfcac0'),
  cer('rev-subway-verde', 'Azulejo subway verde', '#6f8f7d', [150, 75], 2, '#e6e2d8'),
  cer('rev-gris-60', 'Porcellanato gris 60 × 60', '#9d9d99', [600, 600], 1.5, '#8a8a86'),
  cer('rev-hexagonal', 'Calcáreo gris 20 × 20', '#b9b6ae', [200, 200], 2, '#e8e4dc'),
  cer('piso-beige-60', 'Porcellanato beige 60 × 60', '#d8ccb6', [600, 600], 1.5, '#c4b79f', 'pisos'),
  cer('piso-gris-60x120', 'Porcellanato gris 60 × 120', '#a7a6a1', [1200, 600], 1.5, '#91908b', 'pisos'),
  cer('piso-marmol', 'Símil mármol blanco 60 × 60', '#ece9e3', [600, 600], 1, '#d9d4ca', 'pisos'),
  cer('piso-cemento', 'Cemento alisado', '#a39f97', [2000, 2000], 0, '#a39f97', 'pisos'),
  mad('piso-roble', 'Madera roble', '#b98f5e', '#9c7447', [1200, 180]),
  mad('piso-nogal', 'Madera nogal', '#6e4a2f', '#573823', [1200, 180]),
  mad('piso-vinilico', 'Vinílico gris', '#9a958c', '#86827a', [1220, 180]),
];

export const roomMatById = (id) => ROOM_MATERIALS.find((m) => m.id === id) || null;

const isHex = (c) => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c);

// Propiedades de una superficie (con valores por defecto).
export function normalizeFinish(f) {
  if (!f || !roomMatById(f.mat)) return null;
  return {
    mat: f.mat,
    scaleX: Number.isFinite(+f.scaleX) && +f.scaleX > 0 ? +f.scaleX : 1,
    scaleY: Number.isFinite(+f.scaleY) && +f.scaleY > 0 ? +f.scaleY : 1,
    rot: Number.isFinite(+f.rot) ? ((Math.round(+f.rot) % 360) + 360) % 360 : 0,
    mirrorX: !!f.mirrorX,
    mirrorY: !!f.mirrorY,
    tint: isHex(f.tint) ? f.tint : null,
  };
}

// Terminaciones del ambiente: { floor, walls: { [wallId]: finish } } (cara interior de cada pared).
export function finishesOf(room) {
  const f = room.finishes || {};
  const walls = {};
  for (const w of room.walls || []) { const n = normalizeFinish(f.walls?.[w.id]); if (n) walls[w.id] = n; }
  return { floor: normalizeFinish(f.floor), walls };
}

// Arrastrar un material: al piso, a la cara de una pared ("Cara") o a todas las paredes ("Todo").
// Conserva el mapeo que ya tenía la superficie.
export function applyRoomMaterial(room, target, matId, scope = 'cara') {
  if (!roomMatById(matId)) return room;
  const cur = finishesOf(room);
  const put = (old) => normalizeFinish({ ...(old || {}), mat: matId });
  if (target.kind === 'floor') return { ...room, finishes: { ...cur, floor: put(cur.floor) } };
  const ids = scope === 'todo' ? room.walls.map((w) => w.id) : [target.wallId];
  const walls = { ...cur.walls };
  for (const id of ids) walls[id] = put(walls[id]);
  return { ...room, finishes: { ...cur, walls } };
}

// Cambiar propiedades de mapeo / tonalidad de una superficie.
export function setFinishProps(room, target, patch) {
  const cur = finishesOf(room);
  const old = target.kind === 'floor' ? cur.floor : cur.walls[target.wallId];
  if (!old) return room;
  const n = normalizeFinish({ ...old, ...patch });
  if (target.kind === 'floor') return { ...room, finishes: { ...cur, floor: n } };
  return { ...room, finishes: { ...cur, walls: { ...cur.walls, [target.wallId]: n } } };
}

// Quitar el material (vuelve al color de siempre).
export function clearFinish(room, target) {
  const cur = finishesOf(room);
  if (target.kind === 'floor') return { ...room, finishes: { ...cur, floor: null } };
  const { [target.wallId]: _x, ...walls } = cur.walls; // eslint-disable-line no-unused-vars
  return { ...room, finishes: { ...cur, walls } };
}

// Copiar material: lo de la superficie `from` pasa a `to` (material y mapeo).
export function copyFinish(room, from, to) {
  const cur = finishesOf(room);
  const src = from.kind === 'floor' ? cur.floor : cur.walls[from.wallId];
  if (!src) return room;
  if (to.kind === 'floor') return { ...room, finishes: { ...cur, floor: { ...src } } };
  return { ...room, finishes: { ...cur, walls: { ...cur.walls, [to.wallId]: { ...src } } } };
}

// Repeticiones de la textura en una cara de ancho × alto (mm): una baldosa (o tabla) por tile.
export function textureRepeat(finish, widthMm, heightMm) {
  const m = roomMatById(finish.mat);
  const [tw, th] = m?.tile || [1000, 1000];
  return [widthMm / (tw * finish.scaleX), heightMm / (th * finish.scaleY)];
}

// Búsqueda rápida de materiales (por nombre, sin acentos).
const plainTxt = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export function searchRoomMaterials(q) {
  const t = plainTxt(q.trim());
  return t ? ROOM_MATERIALS.filter((m) => plainTxt(m.label).includes(t)) : ROOM_MATERIALS;
}
