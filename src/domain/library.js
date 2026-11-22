// Biblioteca del catálogo, en 3 niveles como la barra de modulación de Promob:
// biblioteca (Cocinas, Dormitorios…) → familia (Inferiores, Altos…) → subfamilia (Cajoneros…).
// Un ítem es un tipo de módulo con medidas propias: el mismo tipo da varios ítems.
import { MODULE_TYPES } from './modules.js';

const it = (id, type, label, params) => ({ id, type, label: label ?? MODULE_TYPES[type].label, ...(params ? { params } : {}) });

export const LIBRARY = [
  {
    id: 'cocinas', label: 'Cocinas', groups: [
      { id: 'inferiores', label: 'Inferiores', subgroups: [
        { id: 'puertas', label: 'Puertas', items: [it('coc-inf-2p', 'bajo')] },
        { id: 'cajoneros', label: 'Cajoneros', items: [it('coc-inf-caj', 'bajo_cajones')] },
        { id: 'especiales', label: 'Especiales', items: [it('coc-inf-mixto', 'bajo_mixto')] },
        { id: 'lavaplatos', label: 'Lavaplatos', items: [it('coc-inf-bacha', 'bajo_bacha')] },
      ] },
      { id: 'altos', label: 'Altos', subgroups: [
        { id: 'alacenas', label: 'Alacenas', items: [it('coc-alt-2p', 'alacena'), it('coc-alt-1p', 'alacena_1p')] },
      ] },
      { id: 'columnas', label: 'Columnas', subgroups: [
        { id: 'torres', label: 'Torres', items: [it('coc-col-torre', 'columna')] },
      ] },
    ],
  },
  {
    id: 'dormitorios', label: 'Dormitorios', groups: [
      { id: 'placares', label: 'Placares', subgroups: [
        { id: 'batientes', label: 'Batientes', items: [it('dor-pla-bat', 'placard_bat')] },
        { id: 'corredizos', label: 'Corredizos', items: [it('dor-pla-corr', 'placard_corr')] },
        { id: 'vestidores', label: 'Vestidores', items: [it('dor-pla-vest', 'vestidor')] },
      ] },
      { id: 'componentes', label: 'Componentes', subgroups: [
        { id: 'cajoneras', label: 'Cajoneras', items: [it('dor-com-caj', 'cajonera_placard')] },
      ] },
    ],
  },
  {
    id: 'banos', label: 'Baños', groups: [
      { id: 'inferiores', label: 'Inferiores', subgroups: [
        { id: 'vanitory', label: 'Vanitory', items: [it('ban-inf-van', 'vanitory'), it('ban-inf-vancaj', 'vanitory_cajones')] },
      ] },
      { id: 'altos', label: 'Altos', subgroups: [
        { id: 'botiquines', label: 'Botiquines', items: [it('ban-alt-bot', 'botiquin')] },
      ] },
      { id: 'columnas', label: 'Columnas', subgroups: [
        { id: 'columnas', label: 'Columnas', items: [it('ban-col', 'columna_bano')] },
      ] },
    ],
  },
  {
    id: 'oficinas', label: 'Oficinas', groups: [
      { id: 'escritorios', label: 'Escritorios', subgroups: [
        { id: 'escritorios', label: 'Escritorios', items: [it('ofi-esc', 'escritorio'), it('ofi-esc-caj', 'cajonera')] },
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
