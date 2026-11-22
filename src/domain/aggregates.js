// Agregados (como Promob): ítems opcionales de un módulo. Se tildan y el (+) muestra sus
// opciones. Algunos editan parámetros que el módulo ya tiene (estantes, divisiones, barral);
// los de base (pies, zócalo, zócalo trasero, ruedas) reemplazan para ese módulo la regla
// "Base" del proyecto; "Fondo" reemplaza el tipo de fondo.
import { MODULE_TYPES, baseOf } from './modules.js';

export { baseOf };

export const AGG_TYPES = [
  { id: 'pies', label: 'Pies', group: 'Base', base: true },
  { id: 'zocalo', label: 'Zócalo', group: 'Base', base: true },
  { id: 'zocalo_tras', label: 'Zócalo trasero', group: 'Base', base: true },
  { id: 'ruedas', label: 'Ruedas', group: 'Base', base: true },
  { id: 'fondo', label: 'Fondo', group: 'Estructura' },
  { id: 'estantes', label: 'Estantes', group: 'Estructura', qty: { min: 1, max: 10 } },
  { id: 'divisiones', label: 'Divisiones', group: 'Estructura', qty: { min: 1, max: 7 } },
  { id: 'barral', label: 'Barral', group: 'Estructura' },
  { id: 'cajones_int', label: 'Cajones internos', group: 'Estructura', qty: { min: 1, max: 4 }, extra: true },
  { id: 'tapa', label: 'Tapa', group: 'Terminación', extra: true },
  { id: 'cierre', label: 'Cierre de tapa', group: 'Terminación', extra: true },
  { id: 'marco', label: 'Marco superior', group: 'Terminación', extra: true },
  { id: 'cornisa', label: 'Cornisa', group: 'Terminación', extra: true },
  { id: 'vistas', label: 'Vistas', group: 'Terminación', extra: true, side: [['ambas', 'Ambos lados'], ['izq', 'Izquierda'], ['der', 'Derecha']] },
];
const EXTRA_IDS = ['cajones_int', 'tapa', 'cierre', 'marco', 'cornisa', 'vistas'];

const BASE_IDS = AGG_TYPES.filter((a) => a.base).map((a) => a.id);

export const aggsApply = (mod) => MODULE_TYPES[mod.type]?.kind === 'caja';

// Estado de cada agregado para el panel: { on, qty? }.
export function aggState(mod, rules = {}) {
  const p = mod.params;
  const base = baseOf(mod, rules);
  const back = mod.aggs?.fondo ? mod.aggs.fondo.on : (rules.backType || 'clavado') !== 'sin';
  return {
    ...Object.fromEntries(BASE_IDS.map((id) => [id, { on: base[id] }])),
    fondo: { on: back },
    estantes: { on: (p.shelves || 0) > 0, qty: Math.max(1, p.shelves || 0) },
    divisiones: { on: (p.dividers || 1) > 1, qty: Math.max(1, (p.dividers || 1) - 1) },
    barral: { on: p.interior === 'barral' || p.interior === 'mixto' },
    ...Object.fromEntries(EXTRA_IDS.map((id) => {
      const a = mod.aggs?.[id];
      return [id, { on: !!a, qty: a?.qty || 1, side: a?.side || 'ambas' }];
    })),
  };
}

// Tildar / destildar con su opción (cantidad, o lado en las vistas). Devuelve el módulo nuevo.
export function setAgg(mod, rules, id, on, qty = null) {
  const p = mod.params;
  if (EXTRA_IDS.includes(id)) {
    const aggs = { ...(mod.aggs || {}) };
    if (!on) delete aggs[id];
    else aggs[id] = id === 'vistas' ? { side: typeof qty === 'string' ? qty : aggs.vistas?.side || 'ambas' } : id === 'cajones_int' ? { qty: qty ?? aggs.cajones_int?.qty ?? 1 } : {};
    return { ...mod, aggs };
  }
  if (id === 'estantes') return { ...mod, params: { ...p, shelves: on ? (qty ?? Math.max(1, p.shelves || 0)) : 0 } };
  if (id === 'divisiones') return { ...mod, params: { ...p, dividers: on ? (qty ?? Math.max(1, (p.dividers || 1) - 1)) + 1 : 1 } };
  if (id === 'barral') return { ...mod, params: { ...p, interior: on ? ((p.dividers || 1) > 1 ? 'mixto' : 'barral') : 'estantes' } };
  if (id === 'fondo') return { ...mod, aggs: { ...(mod.aggs || {}), fondo: { on } } };
  // base: se copia la base efectiva y se cambia el tildado
  const base = { ...baseOf(mod, rules), [id]: on };
  return { ...mod, aggs: { ...(mod.aggs || {}), baseCustom: true, ...Object.fromEntries(BASE_IDS.map((b) => [b, base[b] || undefined])) } };
}
