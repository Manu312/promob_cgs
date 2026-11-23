import { normalizeRender } from './render.js';
import { normalizeExternals } from './externals.js';
import { MODULE_TYPES, DEFAULT_RULES, uid } from './modules.js';
import { slotIds } from './catalog.js';
import { normalizeRoom, rid } from './room.js';
import { roomTemplate } from './drawWalls.js';
import { isSafeImageDataUrl } from './safeData.js';

// Plano de referencia de un proyecto (puede venir de un archivo importado): solo una imagen
// embebida (data URL) y medidas numéricas; una dirección de internet se descarta.
function safePlanImage(pi) {
  if (!pi || !isSafeImageDataUrl(pi.src)) return null;
  if (!['x', 'z', 'wPx', 'hPx', 'mmPerPx'].every((k) => Number.isFinite(pi[k]))) return null;
  return pi;
}

export function normalizeProject(p) {
  // materiales por tipo de pieza (los proyectos viejos tenían cuerpo / frente / fondo / cajon)
  const defaults = slotIds(p.defaults, { fill: true });
  const modules = (p.modules || []).map((m) => (m.mats && Object.keys(m.mats).length ? { ...m, mats: slotIds(m.mats) } : m));
  return { ...p, defaults, modules, room: normalizeRoom(p.room), rules: { ...DEFAULT_RULES, ...(p.rules || {}) }, annotations: Array.isArray(p.annotations) ? p.annotations : [], planImage: safePlanImage(p.planImage), externals: normalizeExternals(p.externals), planDxf: p.planDxf && Array.isArray(p.planDxf.segments) ? { ...p.planDxf, segments: p.planDxf.segments.filter((s) => Array.isArray(s?.a) && Array.isArray(s?.b)).slice(0, 20000) } : null, render: normalizeRender(p.render) };
}

const mk = (type, x, extra = {}) => ({ id: uid(), type, params: { ...MODULE_TYPES[type].defaults, ...(extra.params || {}) }, x, z: 0, y: extra.y ?? MODULE_TYPES[type].y ?? 0, rot: 0, mats: {} });

export function emptyProject() {
  return {
    name: 'Proyecto nuevo',
    room: roomTemplate('dos', { w: 3600, d: 3000 }), // como Promob: arranca con 2 paredes y el piso
    defaults: slotIds({ cuerpo: 'mel18_blanco', frente: 'mel18_roble', fondo: 'fibro3_blanco', cajon: 'mel18_blanco', tapas: 'gra_gris_mara' }, { fill: true }),
    rules: { ...DEFAULT_RULES },
    modules: [],
  };
}

export function sampleProject() {
  const p = emptyProject();
  p.name = 'Cocina de ejemplo';
  p.room = roomTemplate('rect', { w: 3600, d: 3000 });
  p.modules = [
    mk('columna', 0),
    mk('bajo_cajones', 600),
    mk('bajo_bacha', 1200),
    mk('bajo_mixto', 2000),
    mk('alacena', 600),
    mk('alacena', 1200, { params: { width: 800 } }),
    mk('alacena', 2000, { params: { width: 800 } }),
  ];
  const walls = p.room.walls;
  p.room = normalizeRoom({
    ...p.room,
    openings: [
      { id: rid('o'), type: 'ventana', wallId: walls[1].id, offset: 900, width: 1200, height: 1100, sill: 1000 },
      { id: rid('o'), type: 'puerta', wallId: walls[3].id, offset: 500, width: 800, height: 2050, sill: 0 },
    ],
  });
  return p;
}
