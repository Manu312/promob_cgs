// Biblioteca del catálogo, en 3 niveles como la barra de modulación de Promob:
// biblioteca (Cocinas, Dormitorios…) → familia (Inferiores, Altos…) → subfamilia (Cajoneros…).
// Un ítem es un tipo de módulo con medidas propias: el mismo tipo da varios ítems.
import { MODULE_TYPES } from './modules.js';
import { restingHeight } from './movement.js';

// `extra`: { y } altura de inserción propia (p. ej. superiores bajos más arriba).
const it = (id, type, label, params, variants, extra) => ({ id, type, label: label ?? MODULE_TYPES[type].label, ...(params ? { params } : {}), ...(variants ? { variants } : {}), ...(extra || {}) });
// Desplegable de medidas (anchos de fábrica habituales).
const W = (...values) => ({ param: 'width', values });
const W_BAJO = W(300, 350, 400, 450, 500, 600, 700, 800, 900, 1000);
const W_CAJ = W(300, 400, 450, 500, 600, 800);
const W_ALTO = W(300, 350, 400, 450, 500, 600, 700, 800, 900);

export const LIBRARY = [
  {
    id: 'cocinas', label: 'Cocinas', groups: [
      { id: 'inferiores', label: 'Inferiores', subgroups: [
        { id: 'puertas', label: 'Puertas', items: [
          it('coc-inf-2p', 'bajo', null, null, W_BAJO),
          it('coc-inf-1p', 'bajo', 'Bajo mesada 1 puerta', { width: 450, doors: 1 }, W(300, 350, 400, 450, 500, 600)),
        ] },
        { id: 'cajoneros', label: 'Cajoneros', items: [
          it('coc-inf-caj', 'bajo_cajones', null, null, W_CAJ),
          it('coc-inf-caj4', 'bajo_cajones', 'Cajonero 4 cajones', { drawers: 4 }, W_CAJ),
          it('coc-inf-arch', 'bajo_cajones', 'Archivero 3 cajones', { width: 450 }, W(300, 400, 450, 500)),
        ] },
        { id: 'especiales', label: 'Especiales', items: [
          it('coc-inf-mixto', 'bajo_mixto', null, null, W(600, 700, 800, 900, 1000)),
          it('coc-inf-1c1p', 'bajo_mixto', 'Bajo 1 cajón + 1 puerta', { width: 450, doors: 1, drawers: 1 }, W(400, 450, 500, 600)),
          it('coc-inf-2c1p', 'bajo_mixto', 'Bajo 2 cajones + 1 puerta', { width: 500, doors: 1, drawers: 2, drawerH: 150 }, W(400, 450, 500, 600)),
        ] },
        { id: 'electro', label: 'Módulos p/Electrodomésticos', items: [it('coc-inf-horno', 'bajo_horno')] },
        { id: 'esquineros', label: 'Esquineros', items: [
          it('coc-esq-l-izq', 'esq_l', 'Esquinero L Izq 950mm', { doors: 1, side: 'izq' }),
          it('coc-esq-l2p-izq', 'esq_l', 'Esquinero L 2P Izq', { doors: 2, side: 'izq' }),
          it('coc-esq-l-der', 'esq_l', 'Esquinero L Der 950mm', { doors: 1, side: 'der' }),
          it('coc-esq-l2p-der', 'esq_l', 'Esquinero L 2P Der', { doors: 2, side: 'der' }),
        ] },
        { id: 'diagonales', label: 'Módulos Diagonales', items: [
          it('coc-esq-obl1p', 'esq_oblicuo', 'Esquinero oblicuo 1P 900mm', { doors: 1 }),
          it('coc-esq-obl2p', 'esq_oblicuo', 'Esquinero oblicuo 2P 900mm', { doors: 2 }),
        ] },
        { id: 'lavaplatos', label: 'Lavaplatos', items: [it('coc-inf-bacha', 'bajo_bacha', null, null, W(600, 800, 900, 1000, 1200))] },
      ] },
      { id: 'altos', label: 'Altos', subgroups: [
        { id: 'torres', label: 'Torres', items: [it('coc-col-torre', 'columna', null, null, W(450, 500, 600, 700))] },
        { id: 'electro', label: 'Módulos p/Electrodomésticos', items: [it('coc-alt-horno', 'torre_horno'), it('coc-alt-heladera', 'torre_heladera', null, null, W(700, 800, 900, 1000))] },
      ] },
      { id: 'islas', label: 'Islas', subgroups: [
        { id: 'islas', label: 'Islas', items: [it('coc-isla', 'bajo', 'Isla con desayunador', { width: 1500, depth: 900, doors: 3, mesadaOver: 250 }, W(1200, 1500, 1800, 2100))] },
      ] },
      { id: 'sup-bajos', label: 'Superiores Bajos', subgroups: [
        { id: 'puertas', label: 'Puertas', items: [it('coc-sb-2p', 'alacena', 'Superior bajo 2 puertas', { height: 350, shelves: 0 }, W_ALTO, { y: 1800 })] },
      ] },
      { id: 'sup-medios', label: 'Sup Medios', subgroups: [
        { id: 'puertas', label: 'Puertas', items: [it('coc-alt-2p', 'alacena', null, null, W_ALTO), it('coc-alt-1p', 'alacena_1p', null, null, W(300, 350, 400, 450, 500))] },
        { id: 'electro', label: 'Módulos p/Electrodomésticos', items: [it('coc-alt-micro', 'alacena_micro')] },
      ] },
      { id: 'sup-altos', label: 'Superiores Altos', subgroups: [
        { id: 'puertas', label: 'Puertas', items: [it('coc-sa-2p', 'alacena', 'Superior alto 2 puertas', { height: 900, shelves: 2 }, W_ALTO, { y: 1250 })] },
      ] },
      { id: 'tapas', label: 'Tapas/Estantes', subgroups: [
        { id: 'tapas', label: 'Tapas', items: [
          it('coc-tapa', 'tapa', null, null, W(600, 900, 1200, 1500, 1800, 2400)),
          it('coc-tapa-bacha', 'tapa', 'Tapa p/ bacha', { bachas: 1 }, W(800, 1000, 1200, 1500)),
          it('coc-tapa-2bachas', 'tapa', 'Tapa p/ 2 bachas', { width: 1800, bachas: 2 }, W(1500, 1800, 2100, 2400)),
        ] },
        { id: 'estantes', label: 'Estantes', items: [it('coc-estante', 'estante', null, null, W(400, 600, 800, 1000, 1200))] },
      ] },
      { id: 'componentes', label: 'Componentes', subgroups: [
        { id: 'vistas', label: 'Vistas', items: [
          it('coc-vista-bajo', 'vista', 'Vista bajo mesada'),
          it('coc-vista-alacena', 'vista', 'Vista alacena', { height: 700, depth: 350 }, null, { y: 1450 }),
          it('coc-vista-torre', 'vista', 'Vista torre', { height: 2150, depth: 580 }),
        ] },
      ] },
    ],
  },
  {
    id: 'electro', label: 'Electrodomésticos', groups: [
      { id: 'coccion', label: 'Cocción', subgroups: [
        { id: 'cocinas', label: 'Cocinas', items: [
          it('ele-cocina-50', 'cocina', 'Cocina 50 cm', { width: 500, height: 850, depth: 550 }),
          it('ele-cocina-56', 'cocina', 'Cocina 56 cm'),
          it('ele-cocina-60', 'cocina', 'Cocina 60 cm', { width: 600, height: 850, depth: 600 }),
          it('ele-cocina-76', 'cocina', 'Cocina 76 cm 5 hornallas', { width: 765, height: 905, depth: 675, hornallas: 5 }),
          it('ele-cocina-90', 'cocina', 'Cocina 90 cm 5 hornallas', { width: 900, height: 900, depth: 600, hornallas: 5 }),
        ] },
        { id: 'anafes', label: 'Anafes', items: [
          it('ele-anafe-60', 'anafe', 'Anafe 60 cm 4 hornallas'),
          it('ele-anafe-75', 'anafe', 'Anafe 75 cm 5 hornallas', { width: 750, depth: 520, hornallas: 5 }),
          it('ele-anafe-90', 'anafe', 'Anafe 90 cm 5 hornallas', { width: 860, height: 40, depth: 510, hornallas: 5, finish: 'inox' }),
        ] },
        { id: 'hornos', label: 'Hornos', items: [it('ele-horno-60', 'horno', 'Horno empotrable 60 cm')] },
        { id: 'campanas', label: 'Campanas', items: [
          it('ele-campana-60', 'campana', 'Campana 60 cm'),
          it('ele-campana-90', 'campana', 'Campana 90 cm', { width: 900, depth: 500 }),
        ] },
      ] },
      { id: 'refrigeracion', label: 'Refrigeración', subgroups: [
        { id: 'heladeras', label: 'Heladeras', items: [
          it('ele-heladera-simple', 'heladera', 'Heladera simple 215 L', { width: 550, height: 1410, depth: 570, tipo: 'simple', finish: 'blanco' }),
          it('ele-heladera-nf', 'heladera', 'Heladera no frost'),
          it('ele-heladera-side', 'heladera', 'Heladera side by side', { width: 912, height: 1780, depth: 716, tipo: 'side' }),
        ] },
      ] },
      { id: 'microondas', label: 'Microondas', subgroups: [
        { id: 'microondas', label: 'Microondas', items: [
          it('ele-micro-20', 'microondas', 'Microondas 20 L'),
          it('ele-micro-28', 'microondas', 'Microondas 28 L', { width: 490, height: 290, depth: 400 }),
          it('ele-micro-emp', 'microondas', 'Microondas empotrable', { width: 595, height: 389, depth: 321 }, null, { y: 1450, rest: false }),
        ] },
      ] },
      { id: 'lavado', label: 'Lavado', subgroups: [
        { id: 'lavavajillas', label: 'Lavavajillas', items: [
          it('ele-lavav-60', 'lavavajillas', 'Lavavajillas 60 cm'),
          it('ele-lavav-45', 'lavavajillas', 'Lavavajillas 45 cm', { width: 450, height: 850, depth: 590 }),
        ] },
        { id: 'lavarropas', label: 'Lavarropas', items: [
          it('ele-lavarropas-frontal', 'lavarropas', 'Lavarropas carga frontal'),
          it('ele-lavarropas-superior', 'lavarropas', 'Lavarropas carga superior', { width: 600, height: 950, depth: 620, carga: 'superior' }),
        ] },
      ] },
    ],
  },
  {
    id: 'accesorios', label: 'Accesorios', groups: [
      { id: 'bachas', label: 'Bachas', subgroups: [
        { id: 'apoyo', label: 'De apoyo', items: [
          it('acc-bacha-simple', 'bacha', 'Bacha simple con escurridor'),
          it('acc-bacha-doble', 'bacha', 'Bacha doble', { width: 780, depth: 435, bowls: 2 }),
        ] },
        { id: 'bajo', label: 'Bajo mesada', items: [
          it('acc-bacha-bajo', 'bacha', 'Bacha bajo mesada', { width: 500, depth: 400, montaje: 'bajo' }),
          it('acc-bacha-bajo-doble', 'bacha', 'Bacha doble bajo mesada', { width: 780, depth: 420, bowls: 2, montaje: 'bajo' }),
        ] },
      ] },
      { id: 'griferias', label: 'Griferías', subgroups: [
        { id: 'cocina', label: 'Cocina', items: [
          it('acc-grif-alto', 'griferia', 'Monocomando caño alto'),
          it('acc-grif-bajo', 'griferia', 'Monocomando caño bajo', { height: 230, reach: 210, canio: 'bajo' }),
          it('acc-grif-extraible', 'griferia', 'Monocomando extraíble', { height: 400, reach: 220, canio: 'extraible' }),
        ] },
      ] },
    ],
  },
  {
    id: 'dormitorios', label: 'Dormitorios', groups: [
      { id: 'placares', label: 'Placares', subgroups: [
        { id: 'batientes', label: 'Batientes', items: [it('dor-pla-bat', 'placard_bat', null, null, W(900, 1200, 1500, 1800, 2100, 2400))] },
        { id: 'corredizos', label: 'Corredizos', items: [it('dor-pla-corr', 'placard_corr', null, null, W(1200, 1500, 1800, 2100, 2400))] },
        { id: 'vestidores', label: 'Vestidores', items: [it('dor-pla-vest', 'vestidor')] },
      ] },
      { id: 'componentes', label: 'Componentes', subgroups: [
        { id: 'cajoneras', label: 'Cajoneras', items: [it('dor-com-caj', 'cajonera_placard', null, null, W(400, 450, 500, 600, 800))] },
      ] },
    ],
  },
  {
    id: 'banos', label: 'Baños', groups: [
      { id: 'inferiores', label: 'Inferiores', subgroups: [
        { id: 'vanitory', label: 'Vanitory', items: [it('ban-inf-van', 'vanitory', null, null, W(500, 600, 700, 800, 1000, 1200)), it('ban-inf-vancaj', 'vanitory_cajones', null, null, W(500, 600, 800, 1000))] },
      ] },
      { id: 'altos', label: 'Altos', subgroups: [
        { id: 'botiquines', label: 'Botiquines', items: [it('ban-alt-bot', 'botiquin')] },
      ] },
      { id: 'columnas', label: 'Columnas', subgroups: [
        { id: 'columnas', label: 'Columnas', items: [it('ban-col', 'columna_bano')] },
      ] },
      { id: 'sanitarios', label: 'Sanitarios', subgroups: [
        { id: 'inodoros', label: 'Inodoros y bidets', items: [it('ban-inodoro', 'inodoro'), it('ban-bidet', 'bidet')] },
        { id: 'lavatorios', label: 'Lavatorios', items: [
          it('ban-lavatorio-pie', 'lavatorio', 'Lavatorio con pie'),
          it('ban-lavatorio-colgar', 'lavatorio', 'Lavatorio de colgar', { montaje: 'colgar' }, null, { y: 700 }),
        ] },
        { id: 'griferias', label: 'Griferías', items: [it('ban-grif', 'griferia_bano')] },
      ] },
    ],
  },
  {
    id: 'oficinas', label: 'Oficinas', groups: [
      { id: 'escritorios', label: 'Escritorios', subgroups: [
        { id: 'escritorios', label: 'Escritorios', items: [it('ofi-esc', 'escritorio', null, null, W(900, 1000, 1200, 1400, 1600)), it('ofi-esc-caj', 'cajonera')] },
      ] },
      { id: 'guardado', label: 'Guardado', subgroups: [
        { id: 'bibliotecas', label: 'Bibliotecas', items: [it('ofi-bib', 'biblioteca')] },
        { id: 'armarios', label: 'Armarios', items: [it('ofi-arm', 'armario')] },
      ] },
      { id: 'atencion', label: 'Atención', subgroups: [
        { id: 'mostradores', label: 'Mostradores', items: [it('ofi-most', 'mostrador')] },
      ] },
    ],
  },
];

// Módulo recién insertado desde un ítem: guarda el nombre del ítem (si no es el del tipo) y,
// si se apoya (tapas), toma la altura de lo que tiene debajo (o queda a su altura si no hay nada).
export function withItem(mod, item, modules) {
  // se guarda de qué ítem salió (Ubicar en el catálogo, Sustitución rápida)
  let m = { ...(item.label !== MODULE_TYPES[item.type].label ? { ...mod, name: item.label } : mod), itemId: item.id };
  if (item.rest === false) { const { rest: _r, ...rest } = m; m = rest; } // eslint-disable-line no-unused-vars
  if (m.rest) { const y = restingHeight(m, modules); if (y > 0) m = { ...m, y }; }
  return m;
}

// Todos los ítems con su ruta [biblioteca, familia, subfamilia] (ids y nombres).
export function flatItems(lib = LIBRARY) {
  const out = [];
  for (const l of lib) for (const g of l.groups) for (const s of g.subgroups) {
    for (const item of s.items) out.push({ item, path: [l.id, g.id, s.id], names: [l.label, g.label, s.label] });
  }
  return out;
}

export const findItem = (id, lib = LIBRARY) => flatItems(lib).find((e) => e.item.id === id) || null;

// Medidas del ítem (con la variante elegida) sobre los valores por defecto del tipo.
export function itemParams(item, variant = null) {
  const p = { ...MODULE_TYPES[item.type].defaults, ...(item.params || {}) };
  if (variant != null && item.variants) p[item.variants.param] = variant;
  return p;
}

// Texto de medida para la miniatura (ancho × alto × profundidad).
export const itemSize = (item, variant) => { const p = itemParams(item, variant); return `${p.width}×${p.height}×${p.depth}`; };

// Medidas para el desplegable: las de fábrica más la del ítem, ordenadas y sin repetir.
export function variantValues(item) {
  if (!item.variants) return [];
  const d = itemParams(item)[item.variants.param];
  return [...new Set([...item.variants.values, d])].sort((a, b) => a - b);
}

// Navegación: completa una ruta parcial con la primera familia / subfamilia.
export function resolvePath([libId, groupId, subId] = [], lib = LIBRARY) {
  const l = lib.find((x) => x.id === libId) || lib[0];
  const g = l.groups.find((x) => x.id === groupId) || l.groups[0];
  const s = g.subgroups.find((x) => x.id === subId) || g.subgroups[0];
  return { lib: l, group: g, sub: s, path: [l.id, g.id, s.id] };
}

// "Más usados" (como Promob): hasta 30 ítems, del más usado al menos usado.
export function mostUsed(counts = {}, n = 30, lib = LIBRARY) {
  return flatItems(lib).filter((e) => counts[e.item.id] > 0)
    .sort((a, b) => counts[b.item.id] - counts[a.item.id]).slice(0, n).map((e) => e.item);
}

// Página `page` de `items` con `size` por página (devuelve también la cantidad de páginas).
export function paginate(items, page, size) {
  const pages = Math.max(1, Math.ceil(items.length / Math.max(1, size)));
  const p = Math.min(Math.max(0, page), pages - 1);
  return { page: p, pages, items: items.slice(p * size, p * size + size) };
}

// Localizar Rápido (como Promob): busca en nombre, ruta y medida, sin importar mayúsculas
// ni acentos; todas las palabras tienen que aparecer. Resultados agrupados por ruta.
const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function searchLibrary(q, lib = LIBRARY) {
  const words = norm(q).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const hits = flatItems(lib).filter(({ item, names }) => {
    const hay = norm([item.label, ...names, itemSize(item), ...(item.variants ? variantValues(item) : [])].join(' '));
    return words.every((w) => hay.includes(w));
  });
  const groups = new Map();
  for (const h of hits) {
    const key = h.names.join('\\') + '\\';
    if (!groups.has(key)) groups.set(key, { key, path: h.path, items: [] });
    groups.get(key).items.push(h.item);
  }
  return [...groups.values()];
}
