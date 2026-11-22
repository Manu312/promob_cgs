// Motor de módulos paramétricos.
// Coordenadas locales en mm: x = ancho (izq→der), y = alto (piso→arriba),
// z = profundidad (fondo/pared = 0 → frente = depth). Cada pieza es una caja
// alineada a ejes; la misma geometría alimenta el 3D y el despiece.

import { snapCandidates } from './room.js';
import { bounds } from './walls.js';

const SLIDES = [250, 300, 350, 400, 450, 500, 550, 600];
const GROOVE = 8; // profundidad de ranura para fondo
const GROOVE_SET = 10; // distancia de la ranura al canto trasero

// Reglas de construcción: se definen por proyecto y se pueden pisar por módulo.
// No hay valores "correctos": dependen del mueble y del trabajo.
export const DEFAULT_RULES = {
  backType: 'clavado',
  frontType: 'superpuesto',
  base: 'patas_zocalo',
  gap: 3,
  slideGap: 13,
  plinthSetback: 40,
};

export const RULE_DEFS = {
  backType: { label: 'Fondo', type: 'sel', options: [['clavado', 'Clavado atrás'], ['ranurado', 'En ranura'], ['sin', 'Sin fondo']] },
  frontType: { label: 'Frentes', type: 'sel', options: [['superpuesto', 'Superpuestos'], ['embutido', 'Embutidos']] },
  base: { label: 'Base', type: 'sel', options: [['patas_zocalo', 'Patas regulables + zócalo'], ['zocalo', 'Zócalo fijo'], ['ninguna', 'Sin base']] },
  gap: { label: 'Luz entre frentes', type: 'num', min: 0, max: 10, step: 0.5, unit: 'mm' },
  slideGap: { label: 'Holgura corredera / lado', type: 'num', min: 5, max: 25, step: 0.5, unit: 'mm' },
  plinthSetback: { label: 'Retiro del zócalo', type: 'num', min: 0, max: 120, step: 5, unit: 'mm' },
};

export const PARAM_DEFS = {
  width: { label: 'Ancho', type: 'num', min: 150, max: 3600, step: 10, unit: 'mm' },
  height: { label: 'Alto total', type: 'num', min: 200, max: 2800, step: 10, unit: 'mm' },
  depth: { label: 'Profundidad', type: 'num', min: 100, max: 900, step: 10, unit: 'mm' },
  plinth: { label: 'Zócalo / patas', type: 'num', min: 0, max: 300, step: 10, unit: 'mm' },
  top: { label: 'Parte superior', type: 'sel', options: [['travesanos', 'Travesaños (p/ mesada)'], ['techo', 'Techo']] },
  dividers: { label: 'Cuerpos (divisiones)', type: 'num', min: 1, max: 8, step: 1 },
  shelves: { label: 'Estantes por cuerpo', type: 'num', min: 0, max: 10, step: 1 },
  interior: { label: 'Interior', type: 'sel', options: [['estantes', 'Estantes'], ['barral', 'Barral + maletero'], ['mixto', 'Mixto (1º estantes)']] },
  doorType: { label: 'Puertas', type: 'sel', options: [['batientes', 'Batientes'], ['corredizas', 'Corredizas'], ['ninguna', 'Sin puertas']] },
  doors: { label: 'Cantidad de puertas', type: 'num', min: 0, max: 8, step: 1 },
  drawers: { label: 'Cajones (solo 1 cuerpo)', type: 'num', min: 0, max: 8, step: 1 },
  drawerH: { label: 'Alto frente cajón (si hay puertas)', type: 'num', min: 100, max: 400, step: 10, unit: 'mm' },
  handlePos: { label: 'Manijas', type: 'sel', options: [['top', 'Arriba'], ['middle', 'Medio'], ['bottom', 'Abajo'], ['none', 'Sin manijas']] },
  mesada: { label: 'Mesada', type: 'sel', options: [['no', 'No'], ['si', 'Sí']] },
  mesadaT: { label: 'Espesor mesada', type: 'num', min: 10, max: 60, step: 1, unit: 'mm' },
  mesadaOver: { label: 'Vuelo frontal mesada', type: 'num', min: 0, max: 100, step: 5, unit: 'mm' },
};

const CAJA_FIELDS = ['width', 'height', 'depth', 'plinth', 'top', 'dividers', 'shelves', 'interior', 'doorType', 'doors', 'drawers', 'drawerH', 'handlePos', 'mesada', 'mesadaT', 'mesadaOver'];
const caja = (d) => ({ top: 'techo', dividers: 1, shelves: 1, interior: 'estantes', doorType: 'batientes', doors: 2, drawers: 0, drawerH: 180, handlePos: 'top', plinth: 0, mesada: 'no', mesadaT: 20, mesadaOver: 20, ...d });
const conMesada = (d) => caja({ mesada: 'si', ...d });

export const MODULE_TYPES = {
  bajo: { label: 'Bajo mesada puertas', cat: 'Cocina', kind: 'caja', y: 0, defaults: conMesada({ width: 600, height: 870, depth: 560, plinth: 150, top: 'travesanos', doors: 2 }) },
  bajo_cajones: { label: 'Bajo mesada cajonero', cat: 'Cocina', kind: 'caja', y: 0, defaults: conMesada({ width: 600, height: 870, depth: 560, plinth: 150, top: 'travesanos', doors: 0, drawers: 3, shelves: 0 }) },
  bajo_mixto: { label: 'Bajo mesada cajón + puertas', cat: 'Cocina', kind: 'caja', y: 0, defaults: conMesada({ width: 800, height: 870, depth: 560, plinth: 150, top: 'travesanos', doors: 2, drawers: 1 }) },
  bajo_bacha: { label: 'Bajo bacha', cat: 'Cocina', kind: 'caja', y: 0, defaults: conMesada({ width: 800, height: 870, depth: 560, plinth: 150, top: 'travesanos', doors: 2, shelves: 0 }) },
  alacena: { label: 'Alacena', cat: 'Cocina', kind: 'caja', y: 1450, defaults: caja({ width: 600, height: 700, depth: 330, doors: 2, shelves: 1, handlePos: 'bottom' }) },
  alacena_1p: { label: 'Alacena 1 puerta', cat: 'Cocina', kind: 'caja', y: 1450, defaults: caja({ width: 400, height: 700, depth: 330, doors: 1, shelves: 1, handlePos: 'bottom' }) },
  columna: { label: 'Columna / torre', cat: 'Cocina', kind: 'caja', y: 0, defaults: caja({ width: 600, height: 2150, depth: 560, plinth: 150, doors: 1, shelves: 4, handlePos: 'middle' }) },

  placard_bat: { label: 'Placard batientes', cat: 'Placares', kind: 'caja', y: 0, defaults: caja({ width: 1800, height: 2400, depth: 600, plinth: 80, dividers: 3, interior: 'mixto', shelves: 4, doors: 4, handlePos: 'middle' }) },
  placard_corr: { label: 'Placard corredizo', cat: 'Placares', kind: 'caja', y: 0, defaults: caja({ width: 1800, height: 2400, depth: 600, plinth: 80, dividers: 2, interior: 'mixto', shelves: 4, doorType: 'corredizas', doors: 2, handlePos: 'none' }) },
  vestidor: { label: 'Vestidor abierto', cat: 'Placares', kind: 'caja', y: 0, defaults: caja({ width: 1500, height: 2400, depth: 550, plinth: 80, dividers: 3, interior: 'mixto', shelves: 5, doorType: 'ninguna', doors: 0, handlePos: 'none' }) },
  cajonera_placard: { label: 'Cajonera interior', cat: 'Placares', kind: 'caja', y: 0, defaults: caja({ width: 600, height: 700, depth: 500, plinth: 0, doors: 0, drawers: 3, shelves: 0, handlePos: 'middle' }) },

  vanitory: { label: 'Vanitory puertas', cat: 'Baño', kind: 'caja', y: 0, defaults: conMesada({ width: 800, height: 800, depth: 450, plinth: 150, top: 'travesanos', doors: 2, shelves: 0 }) },
  vanitory_cajones: { label: 'Vanitory cajones', cat: 'Baño', kind: 'caja', y: 0, defaults: conMesada({ width: 800, height: 800, depth: 450, plinth: 150, top: 'travesanos', doors: 0, drawers: 2, shelves: 0 }) },
  botiquin: { label: 'Botiquín', cat: 'Baño', kind: 'caja', y: 1300, defaults: caja({ width: 600, height: 700, depth: 150, doors: 1, shelves: 2, handlePos: 'bottom' }) },
  columna_bano: { label: 'Columna de baño', cat: 'Baño', kind: 'caja', y: 0, defaults: caja({ width: 400, height: 1800, depth: 300, plinth: 100, doors: 1, shelves: 4, handlePos: 'middle' }) },

  escritorio: { label: 'Escritorio', cat: 'Oficina', kind: 'escritorio', y: 0, defaults: { width: 1200, height: 750, depth: 600 } },
  cajonera: { label: 'Cajonera', cat: 'Oficina', kind: 'caja', y: 0, defaults: caja({ width: 400, height: 600, depth: 500, doors: 0, drawers: 3, shelves: 0, handlePos: 'middle' }) },
  biblioteca: { label: 'Biblioteca abierta', cat: 'Oficina', kind: 'caja', y: 0, defaults: caja({ width: 900, height: 1800, depth: 350, doorType: 'ninguna', doors: 0, shelves: 4, handlePos: 'none' }) },
  armario: { label: 'Armario de oficina', cat: 'Oficina', kind: 'caja', y: 0, defaults: caja({ width: 900, height: 1800, depth: 450, plinth: 80, doors: 2, shelves: 4, handlePos: 'middle' }) },
  mostrador: { label: 'Mostrador', cat: 'Oficina', kind: 'caja', y: 0, defaults: caja({ width: 1500, height: 1050, depth: 500, plinth: 100, dividers: 2, doorType: 'ninguna', doors: 0, shelves: 1, handlePos: 'none' }) },
};

export function fieldsFor(type) {
  return MODULE_TYPES[type]?.kind === 'escritorio' ? ['width', 'height', 'depth'] : CAJA_FIELDS;
}

export const hingesFor = (h) => (h <= 900 ? 2 : h <= 1600 ? 3 : h <= 2000 ? 4 : 5);
const slideFor = (depth) => SLIDES.reduce((s, v) => (v <= depth ? v : s), SLIDES[0]);

function sanitize(params) {
  const p = { ...params };
  for (const [k, d] of Object.entries(PARAM_DEFS)) {
    if (d.type === 'num' && p[k] != null) {
      let v = Number(p[k]);
      if (!Number.isFinite(v)) v = d.min;
      p[k] = Math.min(d.max, Math.max(d.min, v));
    }
  }
  return p;
}

const part = (name, role, x, y, z, sx, sy, sz, edge = {}) => ({ name, role, x, y, z, sx, sy, sz, edge });
const decor = (kind, x, y, z, sx, sy, sz) => ({ decor: kind, x, y, z, sx, sy, sz });

function buildCaja(raw, { t, tf, tb = 3, tc = t, rules = {} }) {
  const p = sanitize(raw);
  const R = { ...DEFAULT_RULES, ...rules };
  const G = R.gap;
  const W = p.width, H = p.height, D = p.depth;
  const P = R.base === 'ninguna' ? 0 : Math.min(p.plinth || 0, H - 4 * t);
  const parts = [], decors = [], hw = {};
  const add = (c, n) => { if (n > 0) hw[c] = (hw[c] || 0) + n; };

  const y0 = P, yTop = H, bodyH = H - P, iw = W - 2 * t;
  const yIn0 = y0 + t, yIn1 = yTop - t;
  // Fondo: clavado (paneles más cortos), en ranura (paneles a profundidad total) o sin fondo
  const zIn = R.backType === 'clavado' ? tb : 0; // donde empiezan laterales/piso/techo
  const dIn = D - zIn;
  const zInt = R.backType === 'ranurado' ? GROOVE_SET + tb : zIn; // donde empieza el espacio útil
  const inset = R.frontType === 'embutido';
  const dFront = inset ? tf : 0; // profundidad que ocupan frentes embutidos
  const zf = inset ? D - tf : D; // z de los frentes

  // Carcasa
  parts.push(part('Lateral', 'cuerpo', 0, y0, zIn, t, bodyH, dIn, { y: 1 }));
  parts.push(part('Lateral', 'cuerpo', W - t, y0, zIn, t, bodyH, dIn, { y: 1 }));
  parts.push(part('Piso', 'cuerpo', t, y0, zIn, iw, t, dIn, { x: 1 }));
  if (p.top === 'travesanos') {
    parts.push(part('Travesaño', 'cuerpo', t, yTop - t, D - 100, iw, t, 100, { x: 1 }));
    parts.push(part('Travesaño', 'cuerpo', t, yTop - t, zIn, iw, t, 100));
  } else {
    parts.push(part('Techo', 'cuerpo', t, yTop - t, zIn, iw, t, dIn, { x: 1 }));
  }
  if (R.backType === 'clavado') parts.push(part('Fondo', 'fondo', 0, y0, 0, W, bodyH, tb));
  else if (R.backType === 'ranurado') parts.push(part('Fondo', 'fondo', t - GROOVE, y0 + t - GROOVE, GROOVE_SET, iw + 2 * GROOVE, bodyH - 2 * t + 2 * GROOVE, tb));
  if (P > 0) {
    parts.push(part('Zócalo', 'cuerpo', 0, 0, D - t - R.plinthSetback, W, P, t, { x: 1 }));
    if (R.base === 'patas_zocalo') add('pata', W > 1000 ? 6 : 4);
    else parts.push(part('Zócalo trasero', 'cuerpo', t, 0, zIn + 30, iw, P, t));
  }

  // Divisiones verticales → cuerpos
  const n = Math.max(1, Math.round(p.dividers || 1));
  const compW = (iw - (n - 1) * t) / n;
  const comps = [];
  for (let i = 0; i < n; i++) {
    const x0 = t + i * (compW + t);
    comps.push({ x0, w: compW });
    if (i > 0) parts.push(part('División', 'cuerpo', x0 - t, yIn0, zIn, t, yIn1 - yIn0, dIn - dFront, { y: 1 }));
  }

  // Zona de frentes
  const sliding = p.doorType === 'corredizas';
  const nDoors = p.doorType === 'batientes' ? Math.round(p.doors) : 0;
  const nDrawers = n === 1 && !sliding ? Math.round(p.drawers) : 0;
  const zone = inset
    ? { x0: t + G, x1: W - t - G, y0: y0 + t + G, y1: yTop - t - G }
    : { x0: G / 2, x1: W - G / 2, y0: y0 + G / 2, y1: yTop - G / 2 };
  const fronts = [];
  let shelfTop = yIn1;
  if (nDrawers > 0 || nDoors > 0) {
    let top = zone.y1;
    const bottom = zone.y0, fw = zone.x1 - zone.x0;
    if (nDrawers > 0 && nDoors === 0) {
      const fh = (top - bottom - (nDrawers - 1) * G) / nDrawers;
      for (let j = 0; j < nDrawers; j++) { fronts.push({ kind: 'drawer', x: zone.x0, y: top - fh, w: fw, h: fh }); top -= fh + G; }
      shelfTop = null;
    } else {
      for (let j = 0; j < nDrawers; j++) { const fh = p.drawerH; fronts.push({ kind: 'drawer', x: zone.x0, y: top - fh, w: fw, h: fh }); top -= fh + G; }
      if (nDrawers > 0) {
        const divY = top + G / 2 - t;
        parts.push(part('Divisor horizontal', 'cuerpo', t, divY, zIn, iw, t, dIn - dFront, { x: 1 }));
        shelfTop = divY;
      }
      const dh = top - bottom;
      if (nDoors > 0 && dh > 80) {
        const dw = (fw - (nDoors - 1) * G) / nDoors;
        for (let i = 0; i < nDoors; i++) fronts.push({ kind: 'door', x: zone.x0 + i * (dw + G), y: bottom, w: dw, h: dh, idx: i, n: nDoors });
      }
    }
  }

  // Interior: estantes / barral
  const shelfD = D - zInt - dFront - 20;
  comps.forEach((c, i) => {
    const mode = p.interior === 'mixto' ? (i === 0 || n === 1 ? 'estantes' : 'barral') : p.interior;
    if (shelfTop == null) return;
    if (mode === 'barral' && shelfTop - yIn0 > 900) {
      const sy = shelfTop - 400;
      parts.push(part('Estante maletero', 'cuerpo', c.x0 + 1, sy, zInt, c.w - 2, t, shelfD, { x: 1 }));
      add('soporte_estante', 4);
      decors.push(decor('barral', c.x0, sy - 70, zInt + shelfD / 2, c.w, 25, 15));
      add('barral', Math.ceil(c.w / 100) / 10);
    } else {
      const s = Math.round(p.shelves);
      for (let k = 1; k <= s; k++) {
        const y = yIn0 + (k * (shelfTop - yIn0)) / (s + 1) - t / 2;
        parts.push(part('Estante', 'cuerpo', c.x0 + 1, y, zInt, c.w - 2, t, shelfD, { x: 1 }));
        add('soporte_estante', 4);
      }
    }
  });

  // Puertas y cajones
  const hp = p.handlePos;
  for (const f of fronts) {
    if (f.kind === 'drawer') {
      parts.push(part('Frente cajón', 'frente', f.x, f.y, zf, f.w, f.h, tf, { x: 2, y: 2 }));
      const L = slideFor(D - zInt - dFront - 10);
      const bw = iw - 2 * R.slideGap;
      const by = Math.max(f.y + 15, y0 + t + 5);
      const bh = Math.max(60, Math.min(f.h - 50, f.y + f.h - 25 - by));
      const bx = t + R.slideGap, bz = zf - L;
      parts.push(part('Lateral cajón', 'cajon', bx, by, bz, tc, bh, L, { z: 1 }));
      parts.push(part('Lateral cajón', 'cajon', bx + bw - tc, by, bz, tc, bh, L, { z: 1 }));
      parts.push(part('Contrafrente cajón', 'cajon', bx + tc, by, zf - tc, bw - 2 * tc, bh, tc, { x: 1 }));
      parts.push(part('Trasero cajón', 'cajon', bx + tc, by, bz, bw - 2 * tc, bh, tc, { x: 1 }));
      parts.push(part('Fondo cajón', 'fondo', bx, by - tb, bz, bw, tb, L));
      add('corredera', 1);
      if (hp !== 'none') {
        const hy = hp === 'top' ? f.y + f.h - 45 : hp === 'bottom' ? f.y + 30 : f.y + f.h / 2 - 6;
        decors.push(decor('manija', f.x + f.w / 2 - 64, hy, zf + tf, 128, 12, 25));
        add('manija', 1);
      }
    } else {
      parts.push(part('Puerta', 'frente', f.x, f.y, zf, f.w, f.h, tf, { x: 2, y: 2 }));
      add('bisagra', hingesFor(f.h));
      if (hp !== 'none') {
        const hingeLeft = f.n === 1 ? true : f.idx < f.n / 2;
        const hx = hingeLeft ? f.x + f.w - 46 : f.x + 34;
        const hy = hp === 'top' ? f.y + f.h - 168 : hp === 'bottom' ? f.y + 40 : f.y + f.h / 2 - 64;
        decors.push(decor('manija', hx, hy, zf + tf, 12, 128, 25));
        add('manija', 1);
      }
    }
  }

  // Mesada (se compra aparte: va al presupuesto por m², no al plan de corte)
  if (p.mesada === 'si') {
    const md = D + tf + p.mesadaOver;
    decors.push(decor('mesada', 0, H, 0, W, p.mesadaT, md));
    add('mesada', Math.round((W * md) / 1e4) / 100);
  }

  if (sliding) {
    const nd = Math.max(2, Math.round(p.doors));
    const ov = 25;
    const dw = (W + (nd - 1) * ov) / nd;
    for (let i = 0; i < nd; i++) {
      const z = D + 5 + (i % 2) * (tf + 5);
      parts.push(part('Puerta corrediza', 'frente', i * (dw - ov), y0 + 20, z, dw, bodyH - 40, tf, { x: 2, y: 2 }));
    }
    add('kit_corrediza', nd);
  }

  add('kit_armado', 1);
  return { parts, decors, hardware: hw };
}

function buildEscritorio(raw, { t }) {
  const p = sanitize(raw);
  const W = p.width, H = p.height, D = p.depth;
  const parts = [
    part('Tapa', 'cuerpo', 0, H - t, 0, W, t, D, { x: 2, z: 2 }),
    part('Lateral', 'cuerpo', 0, 0, 0, t, H - t, D, { y: 1, z: 1 }),
    part('Lateral', 'cuerpo', W - t, 0, 0, t, H - t, D, { y: 1, z: 1 }),
    part('Faldón', 'cuerpo', t, H - t - 350, 80, W - 2 * t, 350, t, { x: 1 }),
  ];
  return { parts, decors: [], hardware: { kit_armado: 1 } };
}

export function buildModule(mod, ctx) {
  const def = MODULE_TYPES[mod.type];
  if (!def) return { parts: [], decors: [], hardware: {} };
  return def.kind === 'escritorio' ? buildEscritorio(mod.params, ctx) : buildCaja(mod.params, ctx);
}

// ---- Ubicación en el ambiente ----

export const uid = () => Math.random().toString(36).slice(2, 9);

// Huella en planta: caja envolvente del módulo girado (`x`, `z` son su esquina mínima).
// Con giros de 90° es el ancho y la profundidad (intercambiados si está de costado).
export function footprint(mod) {
  const W = mod.params.width, D = mod.params.depth;
  const { ex } = localAxes(mod.rot || 0);
  const c = Math.abs(ex[0]), s = Math.abs(ex[1]);
  const r = (v) => Math.round(v * 1000) / 1000;
  return { fw: r(W * c + D * s), fd: r(W * s + D * c) };
}

// ¿Está a escuadra (0, 90, 180, 270°)? El imán solo actúa así.
export const isSquare = (rot = 0) => Math.abs(((rot % 90) + 90) % 90) < 1e-6;


// Flechas de redimensionar, en el sistema del módulo: eje local y signo hacia afuera.
// Como Promob: un par por eje, a ambos lados (rojo ancho, verde profundidad, azul alto).
export const RESIZE_HANDLES = {
  right: { param: 'width', axis: 'x', sign: 1 },
  left: { param: 'width', axis: 'x', sign: -1 },
  front: { param: 'depth', axis: 'z', sign: 1 },
  back: { param: 'depth', axis: 'z', sign: -1 },
  top: { param: 'height', axis: 'y', sign: 1 },
  bottom: { param: 'height', axis: 'y', sign: -1 },
};
export const AXIS_COLORS = { x: '#e03131', z: '#2f9e44', y: '#1c7ed6' };

// Ejes locales del módulo en planta (x, z del mundo) según su rotación (igual que el 3D: giro sobre y).
export function localAxes(rot = 0) {
  const t = (rot * Math.PI) / 180;
  const c = Math.round(Math.cos(t) * 1e9) / 1e9, s = Math.round(Math.sin(t) * 1e9) / 1e9;
  return { ex: [c, -s], ez: [s, c] };
}

// Estira o achica con una flecha: `delta` mm hacia afuera (negativo = achicar). La cara
// opuesta queda fija; respeta mínimo y máximo de la medida.
export function resizeModule(mod, handle, delta) {
  const h = RESIZE_HANDLES[handle];
  if (!h || !delta) return mod;
  const def = PARAM_DEFS[h.param];
  const old = mod.params[h.param];
  let val = Math.min(def.max, Math.max(def.min, Math.round(old + delta)));
  if (handle === 'bottom') val = Math.min(val, old + (mod.y || 0)); // no baja del piso
  const eff = val - old;
  if (!eff) return mod;
  const params = { ...mod.params, [h.param]: val };
  if (handle === 'bottom') return { ...mod, params, y: (mod.y || 0) - eff }; // la cara de arriba queda fija
  if (h.axis === 'y') return { ...mod, params };
  const f0 = footprint(mod);
  const c = [mod.x + f0.fw / 2, mod.z + f0.fd / 2];
  const { ex, ez } = localAxes(mod.rot || 0);
  const e = h.axis === 'x' ? ex : ez;
  const nc = [c[0] + e[0] * h.sign * (eff / 2), c[1] + e[1] * h.sign * (eff / 2)];
  const f1 = footprint({ ...mod, params });
  return { ...mod, params, x: Math.round(nc[0] - f1.fw / 2), z: Math.round(nc[1] - f1.fd / 2) };
}

// `step`: paso al que se redondea cuando no hay imán cerca (10 mm, o la grilla magnética en Planta).
export function snapPosition(mod, others, room, thr = 40, step = 10) {
  const { fw, fd } = footprint(mod);
  if (!isSquare(mod.rot || 0)) return { x: Math.round(mod.x / step) * step, z: Math.round(mod.z / step) * step }; // girado: solo la grilla
  const walls = room.walls?.length ? snapCandidates(room, fw, fd) : { xs: [0, room.w - fw], zs: [0, room.d - fd] };
  const cx = [...walls.xs], cz = [...walls.zs];
  for (const o of others) {
    const f = footprint(o);
    cx.push(o.x + f.fw, o.x - fw, o.x, o.x + f.fw - fw);
    cz.push(o.z + f.fd, o.z - fd, o.z, o.z + f.fd - fd);
  }
  const near = (v, cands) => {
    let best = Math.round(v / step) * step, bd = thr;
    for (const c of cands) { const d = Math.abs(c - v); if (d < bd) { bd = d; best = c; } }
    return best;
  };
  // Sin límite duro: con paredes que se mueven o ambientes abiertos, el imán y la
  // colisión (Fase 2) ordenan los módulos.
  return { x: Math.round(near(mod.x, cx)), z: Math.round(near(mod.z, cz)) };
}

// Módulo nuevo: a continuación de la fila apoyada en la pared del fondo (la de menor z).
export function newModule(type, project, params = null) {
  const def = MODULE_TYPES[type];
  const { room } = project;
  const b = room.nodes?.length ? bounds(room) : { minX: 0, minZ: 0, maxX: room.w, maxZ: room.d };
  const m = { id: uid(), type, params: { ...def.defaults, ...(params || {}) }, x: b.minX, z: b.minZ, y: def.y || 0, rot: 0, mats: {} };
  const high = m.y >= 1000;
  const row = project.modules.filter((o) => (o.rot || 0) === 0 && o.z <= b.minZ + 10 && (o.y >= 1000) === high);
  const x = row.reduce((acc, o) => Math.max(acc, o.x + footprint(o).fw), b.minX);
  if (x + m.params.width <= b.maxX) m.x = x;
  else { m.x = b.minX; m.z = Math.round((b.minZ + b.maxZ) / 2 - m.params.depth / 2); }
  return m;
}
