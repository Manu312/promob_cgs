// Motor de módulos paramétricos.
// Coordenadas locales en mm: x = ancho (izq→der), y = alto (piso→arriba),
// z = profundidad (fondo/pared = 0 → frente = depth). Cada pieza es una caja
// alineada a ejes; la misma geometría alimenta el 3D y el despiece.

import { snapCandidates } from './room.js';
import { buildAparato, FINISHES, TIPOS, CARGAS, CANIOS, splitAround, APPLIANCE_BUILDERS } from './appliances.js';
import { DECORE_BUILDERS, DECORE_MATERIALS } from './decore.js';

// Los objetos de Decore se construyen como los aparatos (piezas de decoración, sin despiece).
Object.assign(APPLIANCE_BUILDERS, DECORE_BUILDERS);
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
  golaH: 40,
  golaD: 25,
};

export const RULE_DEFS = {
  backType: { label: 'Fondo', type: 'sel', options: [['clavado', 'Clavado atrás'], ['ranurado', 'En ranura'], ['sin', 'Sin fondo']] },
  frontType: { label: 'Frentes', type: 'sel', options: [['superpuesto', 'Superpuestos'], ['embutido', 'Embutidos']] },
  base: { label: 'Base', type: 'sel', options: [['patas_zocalo', 'Patas regulables + zócalo'], ['zocalo', 'Zócalo fijo'], ['ninguna', 'Sin base']] },
  gap: { label: 'Luz entre frentes', type: 'num', min: 0, max: 10, step: 0.5, unit: 'mm' },
  slideGap: { label: 'Holgura corredera / lado', type: 'num', min: 5, max: 25, step: 0.5, unit: 'mm' },
  plinthSetback: { label: 'Retiro del zócalo', type: 'num', min: 0, max: 120, step: 5, unit: 'mm' },
  golaH: { label: 'Alto del perfil gola', type: 'num', min: 20, max: 80, step: 1, unit: 'mm' },
  golaD: { label: 'Profundidad del rebaje gola', type: 'num', min: 10, max: 60, step: 1, unit: 'mm' },
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
  // Línea Gola (sin tiradores): perfil de aluminio encastrado en un rebaje de los laterales
  gola: { label: 'Gola (sin tirador)', type: 'sel', options: [['no', 'Sin gola'], ['superior', 'Gola arriba'], ['superior_medio', 'Gola arriba y entre cajones'], ['inferior', 'Gola abajo (alacena)']] },
  handlePos: { label: 'Manijas', type: 'sel', options: [['top', 'Arriba'], ['middle', 'Medio'], ['bottom', 'Abajo'], ['custom', 'Personalizada (mm)'], ['none', 'Sin manijas']] },
  handleOffset: { label: 'Tirador: desde el borde de arriba', type: 'num', min: 0, max: 2000, step: 5, unit: 'mm' },
  handleOrient: { label: 'Tirador: orientación', type: 'sel', options: [['auto', 'Automática'], ['vertical', 'Vertical'], ['horizontal', 'Horizontal']] },
  mesada: { label: 'Mesada', type: 'sel', options: [['no', 'No'], ['si', 'Sí']] },
  mesadaT: { label: 'Espesor mesada', type: 'num', min: 10, max: 60, step: 1, unit: 'mm' },
  mesadaOver: { label: 'Vuelo frontal mesada', type: 'num', min: 0, max: 400, step: 5, unit: 'mm' },
  nicheH: { label: 'Hueco p/ electrodoméstico (alto)', type: 'num', min: 0, max: 2200, step: 10, unit: 'mm' },
  nicheY: { label: 'Hueco: altura desde abajo', type: 'num', min: 0, max: 2200, step: 10, unit: 'mm' },
  bachas: { label: 'Bachas', type: 'num', min: 0, max: 2, step: 1 },
  hornallas: { label: 'Hornallas', type: 'num', min: 2, max: 6, step: 1 },
  tipo: { label: 'Tipo', type: 'sel', options: TIPOS },
  carga: { label: 'Carga', type: 'sel', options: CARGAS },
  canio: { label: 'Caño', type: 'sel', options: CANIOS },
  bowls: { label: 'Cubetas', type: 'num', min: 1, max: 2, step: 1 },
  montaje: { label: 'Montaje', type: 'sel', options: [['apoyo', 'De apoyo'], ['bajo', 'Bajo mesada'], ['pie', 'Con pie'], ['colgar', 'De colgar']] },
  bowlDepth: { label: 'Profundidad de cubeta', type: 'num', min: 100, max: 300, step: 10, unit: 'mm' },
  reach: { label: 'Alcance del caño', type: 'num', min: 100, max: 350, step: 5, unit: 'mm' },
  finish: { label: 'Terminación', type: 'sel', options: FINISHES },
  material: { label: 'Material', type: 'sel', options: DECORE_MATERIALS },
  forma: { label: 'Forma', type: 'sel', options: [['rect', 'Rectangular'], ['redonda', 'Redonda']] },
  chimneyH: { label: 'Chimenea (alto)', type: 'num', min: 0, max: 1500, step: 10, unit: 'mm' },
  price: { label: 'Precio (opcional, al presupuesto)', type: 'num', min: 0, max: 1e9, step: 1000, unit: '$' },
  armD: { label: 'Profundidad del cuerpo', type: 'num', min: 250, max: 700, step: 10, unit: 'mm' },
  side: { label: 'Lado de la esquina', type: 'sel', options: [['izq', 'Izquierda'], ['der', 'Derecha']] },
};

const CAJA_FIELDS = ['width', 'height', 'depth', 'plinth', 'top', 'dividers', 'shelves', 'interior', 'doorType', 'doors', 'drawers', 'drawerH', 'gola', 'handlePos', 'handleOffset', 'handleOrient', 'mesada', 'mesadaT', 'mesadaOver', 'nicheH', 'nicheY'];
const caja = (d) => ({ gola: 'no', top: 'techo', dividers: 1, shelves: 1, interior: 'estantes', doorType: 'batientes', doors: 2, drawers: 0, drawerH: 180, handlePos: 'top', handleOffset: 40, handleOrient: 'auto', plinth: 0, mesada: 'no', mesadaT: 20, mesadaOver: 20, nicheH: 0, nicheY: 0, ...d });
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
  // Módulos para electrodomésticos: hueco libre (sin frentes) del alto del aparato.
  bajo_horno: { label: 'Bajo p/ horno empotrable', cat: 'Cocina', kind: 'caja', y: 0, defaults: conMesada({ width: 600, height: 870, depth: 560, plinth: 150, top: 'travesanos', doors: 0, drawers: 1, shelves: 0, nicheH: 590, nicheY: 120, handlePos: 'middle' }) },
  torre_horno: { label: 'Torre p/ horno y microondas', cat: 'Cocina', kind: 'caja', y: 0, defaults: caja({ width: 600, height: 2150, depth: 560, plinth: 150, doors: 1, drawers: 2, shelves: 1, nicheH: 980, nicheY: 520, handlePos: 'middle' }) },
  torre_heladera: { label: 'Torre p/ heladera', cat: 'Cocina', kind: 'caja', y: 0, defaults: caja({ width: 800, height: 2150, depth: 600, plinth: 0, doors: 2, drawers: 0, shelves: 0, nicheH: 1800, nicheY: 0, handlePos: 'bottom' }) },
  alacena_micro: { label: 'Alacena p/ microondas', cat: 'Cocina', kind: 'caja', y: 1300, defaults: caja({ width: 600, height: 850, depth: 380, doors: 2, shelves: 0, nicheH: 400, nicheY: 0, handlePos: 'bottom' }) },
  // Piezas sueltas: tapa (mesada de piedra, con hueco de bacha), vista (panel lateral) y estante.
  tapa: { label: 'Tapa / mesada', cat: 'Cocina', kind: 'tapa', y: 870, rest: true, defaults: { width: 1200, height: 20, depth: 600, mesadaT: 20, bachas: 0 } },
  vista: { label: 'Vista (panel lateral)', cat: 'Cocina', kind: 'vista', y: 0, defaults: { width: 18, height: 870, depth: 580 } },
  estante: { label: 'Estante', cat: 'Cocina', kind: 'estante', y: 1500, defaults: { width: 800, height: 18, depth: 250 } },
  // Frentes y paneles sueltos (Puertas/Frentes, Puertas extra, panel de TV): una placa de frente.
  panel: { label: 'Frente suelto', cat: 'Cocina', kind: 'panel', y: 0, fields: ['width', 'height'], defaults: { width: 600, height: 700, depth: 18 } },
  panel_tv: { label: 'Panel de TV', cat: 'Salas', kind: 'panel', y: 600, fields: ['width', 'height'], defaults: { width: 1800, height: 1100, depth: 18 } },
  // Salas (living): racks, aparadores, vajilleros
  rack_tv: { label: 'Rack de TV', cat: 'Salas', kind: 'caja', y: 0, defaults: caja({ width: 1800, height: 500, depth: 450, plinth: 80, dividers: 3, doorType: 'ninguna', doors: 0, shelves: 1, handlePos: 'none' }) },
  aparador: { label: 'Aparador', cat: 'Salas', kind: 'caja', y: 0, defaults: caja({ width: 1600, height: 850, depth: 450, plinth: 100, dividers: 2, doors: 4, shelves: 1, handlePos: 'middle' }) },
  vajillero: { label: 'Vajillero', cat: 'Salas', kind: 'caja', y: 0, defaults: caja({ width: 1000, height: 2000, depth: 400, plinth: 80, dividers: 1, doors: 2, drawers: 0, shelves: 4, handlePos: 'middle' }) },
  // Esquineros: ocupan la esquina (dos brazos contra las dos paredes). "Izquierda" = la esquina
  // queda a la izquierda (atrás-izquierda); "Derecha" = atrás-derecha.
  esq_l: { label: 'Esquinero L', cat: 'Cocina', kind: 'esquinero', y: 0, defaults: { width: 950, depth: 950, height: 870, armD: 560, plinth: 150, doors: 2, side: 'izq', shape: 'l', handlePos: 'top', mesada: 'si', mesadaT: 20, mesadaOver: 20 } },
  esq_oblicuo: { label: 'Esquinero oblicuo', cat: 'Cocina', kind: 'esquinero', y: 0, defaults: { width: 900, depth: 900, height: 870, armD: 560, plinth: 150, doors: 1, side: 'izq', shape: 'oblicuo', handlePos: 'top', mesada: 'si', mesadaT: 20, mesadaOver: 20 } },
  // Electrodomésticos (Fase 6): modelos propios con medidas de fichas públicas
  // (docs/MEDIDAS-ELECTRODOMESTICOS.md). No van al despiece; el precio es opcional.
  cocina: { label: 'Cocina', cat: 'Electrodomésticos', kind: 'aparato', ap: 'cocina', y: 0, fields: ['width', 'height', 'depth', 'hornallas', 'finish', 'price'], defaults: { width: 560, height: 850, depth: 580, hornallas: 4, finish: 'inox', price: 0 } },
  anafe: { label: 'Anafe', cat: 'Electrodomésticos', kind: 'aparato', ap: 'anafe', y: 870, rest: true, cut: { w: 560, d: 490 }, fields: ['width', 'depth', 'hornallas', 'finish', 'price'], defaults: { width: 585, height: 50, depth: 520, hornallas: 4, finish: 'vidrio', price: 0 } },
  horno: { label: 'Horno empotrable', cat: 'Electrodomésticos', kind: 'aparato', ap: 'horno', y: 850, fields: ['width', 'height', 'depth', 'finish', 'price'], defaults: { width: 595, height: 595, depth: 575, finish: 'inox', price: 0 } },
  campana: { label: 'Campana', cat: 'Electrodomésticos', kind: 'aparato', ap: 'campana', y: 1650, fields: ['width', 'height', 'depth', 'chimneyH', 'finish', 'price'], defaults: { width: 600, height: 300, depth: 480, chimneyH: 600, finish: 'inox', price: 0 } },
  heladera: { label: 'Heladera', cat: 'Electrodomésticos', kind: 'aparato', ap: 'heladera', y: 0, fields: ['width', 'height', 'depth', 'tipo', 'finish', 'price'], defaults: { width: 700, height: 1845, depth: 755, tipo: 'nofrost', finish: 'inox', price: 0 } },
  microondas: { label: 'Microondas', cat: 'Electrodomésticos', kind: 'aparato', ap: 'microondas', y: 890, rest: true, fields: ['width', 'height', 'depth', 'finish', 'price'], defaults: { width: 440, height: 260, depth: 340, finish: 'inox', price: 0 } },
  lavavajillas: { label: 'Lavavajillas', cat: 'Electrodomésticos', kind: 'aparato', ap: 'lavavajillas', y: 0, fields: ['width', 'height', 'depth', 'finish', 'price'], defaults: { width: 600, height: 850, depth: 600, finish: 'inox', price: 0 } },
  lavarropas: { label: 'Lavarropas', cat: 'Electrodomésticos', kind: 'aparato', ap: 'lavarropas', y: 0, fields: ['width', 'height', 'depth', 'carga', 'finish', 'price'], defaults: { width: 595, height: 850, depth: 550, carga: 'frontal', finish: 'blanco', price: 0 } },
  // Accesorios de cocina (Fase 6.2): la bacha cala la mesada sobre la que se apoya.
  bacha: { label: 'Bacha', cat: 'Accesorios', kind: 'aparato', ap: 'bacha', y: 870, rest: true, fields: ['width', 'depth', 'bowls', 'montaje', 'bowlDepth', 'price'], defaults: { width: 710, height: 10, depth: 482, bowls: 1, montaje: 'apoyo', bowlDepth: 180, price: 0 } },
  griferia: { label: 'Grifería', cat: 'Accesorios', kind: 'aparato', ap: 'griferia', y: 870, rest: true, fields: ['height', 'reach', 'canio', 'finish', 'price'], defaults: { width: 60, height: 334, depth: 240, reach: 210, canio: 'alto', finish: 'cromo', price: 0 } },
  // Decore (Fase 7b S16): decoración paramétrica propia
  mesa: { label: 'Mesa de comedor', cat: 'Decore', kind: 'aparato', ap: 'mesa', y: 0, fields: ['width', 'height', 'depth', 'forma', 'material', 'price'], defaults: { width: 1600, height: 760, depth: 900, forma: 'rect', material: 'madera', price: 0 } },
  silla: { label: 'Silla', cat: 'Decore', kind: 'aparato', ap: 'silla', y: 0, fields: ['width', 'height', 'depth', 'material', 'price'], defaults: { width: 450, height: 900, depth: 480, material: 'madera', price: 0 } },
  banqueta: { label: 'Banqueta alta', cat: 'Decore', kind: 'aparato', ap: 'banqueta', y: 0, fields: ['width', 'height', 'material', 'price'], defaults: { width: 380, height: 650, depth: 380, material: 'madera', price: 0 } },
  sofa: { label: 'Sofá', cat: 'Decore', kind: 'aparato', ap: 'sofa', y: 0, fields: ['width', 'height', 'depth', 'material', 'price'], defaults: { width: 2100, height: 850, depth: 900, material: 'tela_gris', price: 0 } },
  planta: { label: 'Planta', cat: 'Decore', kind: 'aparato', ap: 'planta', y: 0, fields: ['width', 'height', 'material', 'price'], defaults: { width: 450, height: 1200, depth: 450, material: 'terracota', price: 0 } },
  cuadro: { label: 'Cuadro', cat: 'Decore', kind: 'aparato', ap: 'cuadro', y: 1300, fields: ['width', 'height', 'material', 'price'], defaults: { width: 800, height: 600, depth: 28, material: 'negro', price: 0 } },
  frutero: { label: 'Frutero', cat: 'Decore', kind: 'aparato', ap: 'frutero', y: 890, rest: true, fields: ['width', 'material', 'price'], defaults: { width: 280, height: 150, depth: 280, material: 'ceramica', price: 0 } },
  ollas: { label: 'Juego de ollas', cat: 'Decore', kind: 'aparato', ap: 'ollas', y: 890, rest: true, fields: ['material', 'price'], defaults: { width: 450, height: 150, depth: 260, material: 'inox', price: 0 } },
  alfombra: { label: 'Alfombra', cat: 'Decore', kind: 'aparato', ap: 'alfombra', y: 0, fields: ['width', 'depth', 'material', 'price'], defaults: { width: 2000, height: 8, depth: 1400, material: 'tela_beige', price: 0 } },
  // Sanitarios de baño (Fase 6.3)
  inodoro: { label: 'Inodoro con mochila', cat: 'Baño', kind: 'aparato', ap: 'inodoro', y: 0, fields: ['width', 'height', 'depth', 'price'], defaults: { width: 380, height: 780, depth: 690, price: 0 } },
  bidet: { label: 'Bidet', cat: 'Baño', kind: 'aparato', ap: 'bidet', y: 0, fields: ['width', 'height', 'depth', 'price'], defaults: { width: 352, height: 400, depth: 500, price: 0 } },
  lavatorio: { label: 'Lavatorio', cat: 'Baño', kind: 'aparato', ap: 'lavatorio', y: 680, fields: ['width', 'height', 'depth', 'montaje', 'price'], defaults: { width: 412, height: 170, depth: 468, montaje: 'pie', price: 0 } },
  griferia_bano: { label: 'Grifería de lavatorio', cat: 'Baño', kind: 'aparato', ap: 'griferiaBano', y: 850, rest: true, fields: ['height', 'reach', 'finish', 'price'], defaults: { width: 50, height: 160, depth: 150, reach: 120, finish: 'cromo', price: 0 } },
  mostrador: { label: 'Mostrador', cat: 'Oficina', kind: 'caja', y: 0, defaults: caja({ width: 1500, height: 1050, depth: 500, plinth: 100, dividers: 2, doorType: 'ninguna', doors: 0, shelves: 1, handlePos: 'none' }) },
};

const KIND_FIELDS = { esquinero: ['width', 'depth', 'armD', 'height', 'plinth', 'doors', 'side', 'handlePos', 'mesada', 'mesadaT', 'mesadaOver'], escritorio: ['width', 'height', 'depth'], tapa: ['width', 'depth', 'mesadaT', 'bachas'], vista: ['height', 'depth'], estante: ['width', 'depth'] };

export function fieldsFor(type) {
  return MODULE_TYPES[type]?.fields || KIND_FIELDS[MODULE_TYPES[type]?.kind] || CAJA_FIELDS;
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

// Base de un módulo (agregados de base): la propia si se tocó en Agregados, o la que sale
// de la regla "Base" del proyecto (patas + zócalo / zócalo adelante y atrás / sin base).
export function baseOf(mod, rules = {}) {
  const a = mod.aggs || {};
  if (a.baseCustom) return { pies: !!a.pies, zocalo: !!a.zocalo, zocalo_tras: !!a.zocalo_tras, ruedas: !!a.ruedas };
  const r = rules.base || DEFAULT_RULES.base;
  return { pies: r === 'patas_zocalo', zocalo: r !== 'ninguna', zocalo_tras: r === 'zocalo', ruedas: false };
}

function buildCaja(raw, { t, tf, tb = 3, tc = t, rules = {}, aggs = null, holes = [] }) {
  const p = sanitize(raw);
  const R = { ...DEFAULT_RULES, ...rules };
  // Agregado "Fondo": pone o saca el fondo de este módulo
  if (aggs?.fondo) R.backType = aggs.fondo.on ? (R.backType === 'sin' ? 'clavado' : R.backType) : 'sin';
  const base = baseOf({ aggs }, R);
  const G = R.gap;
  const W = p.width, H = p.height, D = p.depth;
  const P = !(base.pies || base.zocalo || base.zocalo_tras || base.ruedas) ? 0 : Math.min(p.plinth || 0, H - 4 * t);
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
    if (base.zocalo) parts.push(part('Zócalo', 'cuerpo', 0, 0, D - t - R.plinthSetback, W, P, t, { x: 1 }));
    if (base.zocalo_tras) parts.push(part('Zócalo trasero', 'cuerpo', t, 0, zIn + 30, iw, P, t));
    // pies y ruedas en las esquinas (y al medio si el módulo es ancho)
    const xs = W > 1000 ? [60, W / 2 - 15, W - 90] : [60, W - 90];
    const spots = xs.flatMap((x) => [[x, zIn + 40], [x, D - R.plinthSetback - t - 70]]);
    if (base.pies) {
      add('pata', spots.length);
      for (const [x, z] of spots) decors.push(decor('pata', x, 0, z, 30, P, 30));
    }
    if (base.ruedas) {
      add('rueda', 4);
      for (const [x, z] of [[40, zIn + 30], [W - 90, zIn + 30], [40, D - 90], [W - 90, D - 90]]) decors.push(decor('rueda', x, 0, z, 50, Math.min(P, 70), 50));
    }
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
  // Gola: los frentes dejan libre el canal del perfil (arriba, o abajo en las alacenas)
  const gola = p.gola && p.gola !== 'no' ? p.gola : null;
  const gH = R.golaH, gD = R.golaD;
  if (gola === 'superior' || gola === 'superior_medio') zone.y1 -= gH;
  if (gola === 'inferior') zone.y0 += gH;
  // Hueco libre para un electrodoméstico (horno, microondas, heladera): sin frentes, con
  // divisores fijos arriba y abajo. Debajo van cajones (o puertas si no hay cajones); arriba, puertas.
  const nicheH = n === 1 && !sliding ? Math.min(p.nicheH || 0, yIn1 - yIn0) : 0;
  if (nicheH > 0) {
    const nb = Math.min(yIn0 + (p.nicheY || 0), yIn1 - nicheH); // piso del hueco
    const nt = nb + nicheH; // techo del hueco
    if (nb > yIn0 + 1) parts.push(part('Divisor horizontal', 'cuerpo', t, nb - t, zIn, iw, t, dIn - dFront, { x: 1 }));
    if (nt < yIn1 - 1) parts.push(part('Divisor horizontal', 'cuerpo', t, nt, zIn, iw, t, dIn - dFront, { x: 1 }));
    const fw = zone.x1 - zone.x0;
    const stack = (y0z, y1z, kind, count) => {
      const h = y1z - y0z;
      if (h < 80 || count < 1) return;
      if (kind === 'drawer') {
        const fh = (h - (count - 1) * G) / count;
        for (let j = 0; j < count; j++) fronts.push({ kind: 'drawer', x: zone.x0, y: y1z - (j + 1) * fh - j * G, w: fw, h: fh });
      } else {
        const dw = (fw - (count - 1) * G) / count;
        for (let i = 0; i < count; i++) fronts.push({ kind: 'door', x: zone.x0 + i * (dw + G), y: y0z, w: dw, h, idx: i, n: count });
      }
    };
    const below = [zone.y0, nb - t - G / 2], above = [nt + t + G / 2, zone.y1];
    if (nDrawers > 0) stack(below[0], below[1], 'drawer', nDrawers); else stack(below[0], below[1], 'door', nDoors);
    stack(above[0], above[1], 'door', nDoors);
    shelfTop = null;
    // estantes solo en la parte de arriba (alacena sobre el hueco)
    const s = Math.round(p.shelves);
    for (let k = 1; k <= s && yIn1 - nt > 300; k++) {
      parts.push(part('Estante', 'cuerpo', t + 1, nt + (k * (yIn1 - nt)) / (s + 1) - t / 2, zInt, iw - 2, t, D - zInt - dFront - 20, { x: 1 }));
      add('soporte_estante', 4);
    }
  } else if (nDrawers > 0 || nDoors > 0) {
    let top = zone.y1;
    const bottom = zone.y0, fw = zone.x1 - zone.x0;
    if (nDrawers > 0 && nDoors === 0) {
      const DG = gola === 'superior_medio' ? gH : G; // gola entre cajones: el perfil va en la separación
      const fh = (top - bottom - (nDrawers - 1) * DG) / nDrawers;
      for (let j = 0; j < nDrawers; j++) { fronts.push({ kind: 'drawer', x: zone.x0, y: top - fh, w: fw, h: fh }); top -= fh + DG; }
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

  // Altura del tirador (su borde de abajo) en el frente `f`: arriba, medio, abajo o
  // personalizada (`handleOffset` mm desde el borde de arriba del frente hasta el tirador).
  const handleY = (f, L, top, bottom) => {
    const hp0 = p.handlePos;
    if (hp0 === 'custom') return Math.max(f.y + 5, f.y + f.h - (p.handleOffset ?? 40) - L);
    return hp0 === 'top' ? f.y + f.h - top - L : hp0 === 'bottom' ? f.y + bottom : f.y + f.h / 2 - L / 2;
  };
  // Puertas y cajones. Cada pieza de un frente lleva `front` (índice) para las aperturas;
  // las puertas, además, `hinge` (lado de la bisagra; `params.hinges` lo invierte por puerta).
  const hp = gola ? 'none' : p.handlePos; // con gola no hay tiradores
  fronts.forEach((f, k) => {
    const n0 = parts.length, d0 = decors.length;
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
      if (hp !== 'none') { // cajón: horizontal al centro (o vertical si se pide y entra)
        const vert = p.handleOrient === 'vertical' && f.h >= 170;
        const L = vert ? 128 : 12; // alto del tirador
        const hy = handleY(f, L, 33, 30);
        decors.push(vert ? decor('manija', f.x + f.w / 2 - 6, hy, zf + tf, 12, 128, 25) : decor('manija', f.x + f.w / 2 - 64, hy, zf + tf, 128, 12, 25));
        add('manija', 1);
      }
    } else {
      const hinge = p.hinges?.[k] || (f.n === 1 || f.idx < f.n / 2 ? 'izq' : 'der');
      parts.push({ ...part('Puerta', 'frente', f.x, f.y, zf, f.w, f.h, tf, { x: 2, y: 2 }), hinge });
      add('bisagra', hingesFor(f.h));
      if (hp !== 'none') {
        const hingeLeft = hinge === 'izq';
        if (p.handleOrient === 'horizontal') { // puerta: horizontal del lado opuesto a la bisagra
          const hy = handleY(f, 12, 50, 40);
          decors.push(decor('manija', hingeLeft ? f.x + f.w - 40 - 128 : f.x + 40, hy, zf + tf, 128, 12, 25));
        } else {
          const hx = hingeLeft ? f.x + f.w - 46 : f.x + 34;
          decors.push(decor('manija', hx, handleY(f, 128, 40, 40), zf + tf, 12, 128, 25));
        }
        add('manija', 1);
      }
    }
    for (let i = n0; i < parts.length; i++) parts[i].front = k;
    for (let i = d0; i < decors.length; i++) decors[i].front = k;
  });

  // Perfiles gola (aluminio): canal arriba / abajo y, si corresponde, entre cajones. Los laterales
  // llevan el rebaje donde encastra el perfil.
  if (gola) {
    const prof = (yb) => {
      decors.push({ ...decor('aparato', 0, yb, D - gD, W, gH, 2), finish: 'inox' }); // fondo del canal
      decors.push({ ...decor('aparato', 0, yb, D - gD, W, 2, gD), finish: 'inox' }); // ala
      add('perfil_gola', Math.round(W / 10) / 100);
    };
    if (gola === 'inferior') prof(zone.y0 - gH);
    else prof(zone.y1 + G / 2);
    if (gola === 'superior_medio') {
      const ds = fronts.filter((f) => f.kind === 'drawer').sort((a, b) => b.y - a.y);
      for (let j = 0; j < ds.length - 1; j++) prof(ds[j + 1].y + ds[j + 1].h);
    }
    for (const pt of parts) if (pt.name === 'Lateral') pt.name = 'Lateral (rebaje gola)';
  }

  // Mesada (se compra aparte: va al presupuesto por m², no al plan de corte)
  if (p.mesada === 'si') {
    const md = D + tf + p.mesadaOver;
    for (const r of splitAround({ x0: 0, z0: 0, x1: W, z1: md }, holes)) decors.push(decor('mesada', r.x0, H, r.z0, r.x1 - r.x0, p.mesadaT, r.z1 - r.z0));
    add('mesada', Math.round((W * md) / 1e4) / 100);
    add('calado', holes.length);
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

  // Agregados de terminación
  if (aggs?.cajones_int && n === 1 && nDoors > 0) { // cajones internos detrás de las puertas, abajo
    const q = Math.max(1, Math.min(4, Math.round(aggs.cajones_int.qty || 1)));
    const ch = 130, L = slideFor(D - zInt - dFront - 30), bw = iw - 2 * R.slideGap, bx = t + R.slideGap, bz = zf - dFront - L - 20;
    for (let j = 0; j < q; j++) {
      const by = yIn0 + 10 + j * (ch + 20);
      if (by + ch > yIn1 - 50) break;
      parts.push(part('Frente cajón interno', 'cajon', bx, by, bz + L - tc, bw, ch, tc, { x: 1 }));
      parts.push(part('Lateral cajón', 'cajon', bx, by, bz, tc, ch - 20, L - tc, { z: 1 }));
      parts.push(part('Lateral cajón', 'cajon', bx + bw - tc, by, bz, tc, ch - 20, L - tc, { z: 1 }));
      parts.push(part('Trasero cajón', 'cajon', bx + tc, by, bz, bw - 2 * tc, ch - 20, tc, { x: 1 }));
      parts.push(part('Fondo cajón', 'fondo', bx, by - tb, bz, bw, tb, L));
      add('corredera', 1);
    }
  }
  const top = H + (aggs?.tapa ? t : 0);
  if (aggs?.tapa) parts.push(part('Tapa', 'cuerpo', 0, H, 0, W, t, D + tf, { x: 2, z: 1 }));
  if (aggs?.cierre) parts.push(part('Cierre de tapa', 'frente', 0, H - 40, D + tf, W, 40, tf, { x: 2 }));
  const marcoH = aggs?.marco ? 60 : 0;
  if (aggs?.marco) {
    parts.push(part('Marco superior', 'frente', 0, top, D + tf - t, W, marcoH, t, { x: 2 }));
    parts.push(part('Marco superior', 'frente', 0, top, 0, t, marcoH, D + tf - t, { z: 1 }));
    parts.push(part('Marco superior', 'frente', W - t, top, 0, t, marcoH, D + tf - t, { z: 1 }));
  }
  if (aggs?.cornisa) parts.push(part('Cornisa', 'frente', -30, top + marcoH, 0, W + 60, 30, D + tf + 30, { x: 2, z: 1 }));
  if (aggs?.vistas) {
    const side = aggs.vistas.side || 'ambas';
    if (side !== 'der') parts.push(part('Vista', 'frente', -tf, 0, 0, tf, top, D + tf, { y: 2, z: 1 }));
    if (side !== 'izq') parts.push(part('Vista', 'frente', W, 0, 0, tf, top, D + tf, { y: 2, z: 1 }));
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

// Tapa / mesada de piedra (se compra aparte: va al presupuesto por m², no al despiece),
// con 0, 1 o 2 huecos de bacha.
function buildTapa(raw, { holes = [] } = {}) {
  const p = sanitize(raw);
  const W = p.width, D = p.depth, T = p.mesadaT;
  const decors = [];
  const own = []; // huecos de sus propias bachas
  const nb = Math.round(p.bachas || 0);
  for (let i = 0; i < nb; i++) {
    const bw = Math.min(500, (W - 100 * (nb + 1)) / nb), bd = Math.min(400, D - 160);
    if (bw < 200 || bd < 200) break;
    const cx = (W * (i + 1)) / (nb + 1);
    own.push({ x0: cx - bw / 2, z0: (D - bd) / 2, x1: cx + bw / 2, z1: (D + bd) / 2 });
    for (const [x, z, sx, sz] of [[cx - bw / 2, (D - bd) / 2, bw, 2], [cx - bw / 2, (D + bd) / 2 - 2, bw, 2], [cx - bw / 2, (D - bd) / 2, 2, bd], [cx + bw / 2 - 2, (D - bd) / 2, 2, bd]]) decors.push(decor('bacha', x, -180, z, sx, 180 + T, sz));
    decors.push(decor('bacha', cx - bw / 2, -180, (D - bd) / 2, bw, 2, bd));
  }
  for (const r of splitAround({ x0: 0, z0: 0, x1: W, z1: D }, [...own, ...holes])) decors.push(decor('mesada', r.x0, 0, r.z0, r.x1 - r.x0, T, r.z1 - r.z0));
  return { parts: [], decors, hardware: { mesada: Math.round((W * D) / 1e4) / 100, ...(nb ? { bacha: nb } : {}), ...(own.length + holes.length ? { calado: own.length + holes.length } : {}) } };
}

// Vista: panel lateral suelto del material de los frentes.
function buildVista(raw, { tf }) {
  const p = sanitize(raw);
  return { parts: [part('Vista', 'frente', 0, 0, 0, tf, p.height, p.depth, { y: 2, z: 1 })], decors: [], hardware: {} };
}

// Estante suelto (de pared): una placa con canto al frente y dos soportes.
function buildEstante(raw, { t }) {
  const p = sanitize(raw);
  return { parts: [part('Estante', 'cuerpo', 0, 0, 0, p.width, t, p.depth, { x: 1 })], decors: [], hardware: { soporte_estante: 2 } };
}

// Esquinero bajo (L u oblicuo). Se arma con la esquina atrás-izquierda (fondos contra las
// paredes z = 0 y x = 0) y se espeja para "Derecha". L: dos frentes en el ángulo interior
// (2P: dos puertas; 1P: una puerta y un frente fijo). Oblicuo: frente a 45° (1 o 2 puertas).
// El piso y el techo del oblicuo se cortan como dos rectángulos (el triángulo queda adentro).
function buildEsquinero(raw, { t, tf, tb = 3, rules = {} }) {
  const p = sanitize(raw);
  const R = { ...DEFAULT_RULES, ...rules };
  const G = R.gap;
  const W = p.width, D = p.depth, H = p.height, A = Math.min(p.armD, W - 100, D - 100);
  const P = R.base === 'ninguna' ? 0 : Math.min(p.plinth || 0, H - 4 * t);
  const parts = [], decors = [], hw = {};
  const add = (c, n) => { if (n > 0) hw[c] = (hw[c] || 0) + n; };
  const bodyH = H - P;
  // Fondos contra las dos paredes
  parts.push(part('Fondo', 'fondo', 0, P, 0, W, bodyH, tb));
  parts.push(part('Fondo', 'fondo', 0, P, tb, tb, bodyH, D - tb));
  // Laterales en las puntas de los brazos
  parts.push(part('Lateral', 'cuerpo', W - t, P, tb, t, bodyH, A - tb, { y: 1 }));
  parts.push(part('Lateral', 'cuerpo', tb, P, D - t, A - tb, bodyH, t, { y: 1 }));
  // Piso y techo en L (dos rectángulos cada uno)
  for (const [name, y] of [['Piso', P], ['Techo', H - t]]) {
    parts.push(part(name, 'cuerpo', tb, y, tb, W - t - tb, t, A - tb, { x: 1 }));
    parts.push(part(name, 'cuerpo', tb, y, A, A - tb, t, D - t - A, { z: 1 }));
  }
  // Zócalo en las caras interiores
  if (P > 0) {
    const s = R.plinthSetback;
    parts.push(part('Zócalo', 'cuerpo', A - s - t, 0, A - s - t, W - A + s, P, t, { x: 1 }));
    parts.push(part('Zócalo', 'cuerpo', A - s - t, 0, A - s, t, P, D - A + s, { z: 1 }));
    if (R.base === 'patas_zocalo') add('pata', 6);
  }
  const fy = P + G / 2, fh = H - G / 2 - fy;
  const hp = p.handlePos;
  const handleY = (h) => (hp === 'top' ? fy + h - 168 : hp === 'bottom' ? fy + 40 : fy + h / 2 - 64);
  const nDoors = Math.max(1, Math.min(2, Math.round(p.doors || 1)));
  if (p.shape === 'oblicuo') {
    // Frente a 45° entre (W, A) y (A, D)
    const ax = W, az = A, bx = A, bz = D;
    const L = Math.hypot(bx - ax, bz - az);
    const ux = (bx - ax) / L, uz = (bz - az) / L, nx = uz, nz = -ux; // n: hacia afuera
    const ry = Math.atan2(-uz, ux);
    const dw = (L - G * (nDoors + 1)) / nDoors;
    for (let i = 0; i < nDoors; i++) {
      const s = G + dw / 2 + i * (dw + G);
      const cx = ax + ux * s + (nx * tf) / 2, cz = az + uz * s + (nz * tf) / 2;
      parts.push({ ...part('Puerta', 'frente', cx - dw / 2, fy, cz - tf / 2, dw, fh, tf, { x: 2, y: 2 }), ry });
      add('bisagra', hingesFor(fh));
      if (hp !== 'none') {
        const hs = nDoors === 1 ? s + dw / 2 - 40 : i === 0 ? s + dw / 2 - 40 : s - dw / 2 + 40;
        decors.push({ ...decor('manija', ax + ux * hs + nx * (tf + 12) - 6, handleY(fh), az + uz * hs + nz * (tf + 12) - 12, 12, 128, 25), ry });
        add('manija', 1);
      }
    }
  } else {
    // L: frente sobre el brazo x (plano z = A) y sobre el brazo z (plano x = A)
    const wA = W - A - G, wB = D - A - tf - G;
    parts.push(part('Puerta', 'frente', A + G / 2, fy, A, wA, fh, tf, { x: 2, y: 2 }));
    add('bisagra', hingesFor(fh));
    parts.push(part(nDoors === 2 ? 'Puerta' : 'Frente fijo', 'frente', A, fy, A + tf + G / 2, tf, fh, wB, { z: 2, y: 2 }));
    if (nDoors === 2) add('bisagra', hingesFor(fh));
    if (hp !== 'none') {
      decors.push(decor('manija', W - G / 2 - 46, handleY(fh), A + tf, 12, 128, 25));
      add('manija', 1);
      if (nDoors === 2) { decors.push(decor('manija', A + tf, handleY(fh), D - G / 2 - 46, 25, 128, 12)); add('manija', 1); }
    }
  }
  // Mesada en L (y la franja a 45° del oblicuo)
  if (p.mesada === 'si') {
    const o = tf + p.mesadaOver, T = p.mesadaT;
    decors.push(decor('mesada', 0, H, 0, W, T, A + o));
    decors.push(decor('mesada', 0, H, A + o, A + o, T, D - A - o));
    let area = W * (A + o) + (A + o) * (D - A - o);
    if (p.shape === 'oblicuo') {
      const leg = Math.min(W, D) - A;
      const L = Math.hypot(leg, leg), ry = Math.atan2(-Math.SQRT1_2, -Math.SQRT1_2);
      const cx = (W + A) / 2 + (o / 2) * Math.SQRT1_2, cz = (A + D) / 2 + (o / 2) * Math.SQRT1_2;
      decors.push({ ...decor('mesada', cx - L / 2, H, cz - o / 2, L, T, o), ry });
      // cuadrado a 45° que tapa el triángulo interior (diagonal desde la esquina interior
      // hasta el medio del frente): lado = leg / 2, centro en (A + leg/4, A + leg/4)
      const s2 = leg / 2, c2 = A + leg / 4;
      decors.push({ ...decor('mesada', c2 - s2 / 2, H, c2 - s2 / 2, s2, T, s2), ry: Math.PI / 4 });
      area += (leg * leg) / 2;
    }
    add('mesada', Math.round(area / 1e4) / 100);
  }
  add('kit_armado', 1);
  if (p.side === 'der') {
    const flip = (o) => ({ ...o, x: W - o.x - o.sx, ...(o.ry ? { ry: -o.ry } : {}) });
    return { parts: parts.map(flip), decors: decors.map(flip), hardware: hw };
  }
  return { parts, decors, hardware: hw };
}

// Frente / panel suelto: una placa (ancho × alto, espesor = profundidad) de frente.
function buildPanel(raw, { tf }) {
  const p = sanitize(raw);
  return { parts: [part('Panel', 'frente', 0, 0, 0, p.width, p.height, tf, { x: 2, y: 2 })], decors: [], hardware: {} };
}

const BUILDERS = { esquinero: buildEsquinero, escritorio: buildEscritorio, tapa: buildTapa, vista: buildVista, estante: buildEstante, panel: buildPanel };

export function buildModule(mod, ctx) {
  const def = MODULE_TYPES[mod.type];
  if (!def) return { parts: [], decors: [], hardware: {} };
  if (def.kind === 'aparato') return buildAparato(def.ap, { ...def.defaults, ...mod.params, y: mod.y ?? def.y ?? 0 }, mod.name || def.label);
  return (BUILDERS[def.kind] || buildCaja)(mod.params, { ...ctx, aggs: mod.aggs || null, holes: ctx.holes || [] });
}

// ---- Ubicación en el ambiente ----

// Nombre que se muestra: el del ítem del catálogo (p. ej. "Tapa p/ 2 bachas") o el del tipo.
export const moduleName = (m) => m.name || MODULE_TYPES[m.type]?.label || m.type;

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
export function newModule(type, project, params = null, y = null) {
  const def = MODULE_TYPES[type];
  const { room } = project;
  const b = room.nodes?.length ? bounds(room) : { minX: 0, minZ: 0, maxX: room.w, maxZ: room.d };
  const m = { id: uid(), type, params: { ...def.defaults, ...(params || {}) }, x: b.minX, z: b.minZ, y: y ?? def.y ?? 0, rot: 0, mats: {}, ...(def.rest ? { rest: true } : {}) };
  const high = m.y >= 1000;
  const row = project.modules.filter((o) => (o.rot || 0) === 0 && o.z <= b.minZ + 10 && (o.y >= 1000) === high);
  const x = row.reduce((acc, o) => Math.max(acc, o.x + footprint(o).fw), b.minX);
  if (x + m.params.width <= b.maxX) m.x = x;
  else { m.x = b.minX; m.z = Math.round((b.minZ + b.maxZ) / 2 - m.params.depth / 2); }
  return m;
}
