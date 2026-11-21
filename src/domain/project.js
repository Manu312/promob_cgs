import { MODULE_TYPES, DEFAULT_RULES, uid } from './modules.js';

const mk = (type, x, extra = {}) => ({ id: uid(), type, params: { ...MODULE_TYPES[type].defaults, ...(extra.params || {}) }, x, z: 0, y: extra.y ?? MODULE_TYPES[type].y ?? 0, rot: 0, mats: {} });

export function emptyProject() {
  return {
    name: 'Proyecto nuevo',
    room: { w: 3600, d: 3000, h: 2600 },
    defaults: { cuerpo: 'mel18_blanco', frente: 'mel18_roble', fondo: 'fibro3_blanco', cajon: 'mel18_blanco' },
    rules: { ...DEFAULT_RULES },
    modules: [],
  };
}

export function sampleProject() {
  const p = emptyProject();
  p.name = 'Cocina de ejemplo';
  p.modules = [
    mk('columna', 0),
    mk('bajo_cajones', 600),
    mk('bajo_bacha', 1200),
    mk('bajo_mixto', 2000),
    mk('alacena', 600),
    mk('alacena', 1200, { params: { width: 800 } }),
    mk('alacena', 2000, { params: { width: 800 } }),
  ];
  return p;
}
