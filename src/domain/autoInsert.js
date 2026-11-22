// Inserción Automática (como Promob): agregados y accesorios que se ponen solos.
// Pestaña "Inserción": lo tildado se agrega a cada módulo que se inserte después.
// Pestaña "Ambiente": Insertar / Remover sobre los módulos que ya están (todos los de esa
// categoría, o solo los seleccionados).
import { MODULE_TYPES } from './modules.js';
import { setAgg } from './aggregates.js';

const agg = (id, label, aggId, opt = null, when = null) => ({ id, label, apply: (m, rules, on) => setAgg(m, rules, aggId, on, opt), when });
const accModel = (id, label, fam, model) => ({
  id, label,
  apply: (m, rules, on) => {
    const mats = { ...(m.mats || {}) };
    if (on) mats[fam] = model; else if (mats[fam] === model) delete mats[fam];
    return { ...m, mats };
  },
});
const upper = (m) => (m.y || 0) >= 1000; // "para Superior": solo módulos altos

export const AUTO_CATEGORIES = [
  {
    id: 'Cocinas', cat: 'Cocina', items: [
      agg('pies', 'Pies', 'pies'), agg('zocalos', 'Zócalos', 'zocalo'), agg('tapas', 'Tapas', 'tapa'),
      agg('cierre', 'Cierre para Tapas', 'cierre'), agg('marco', 'Marco para Superior', 'marco', null, upper),
      agg('cornisa', 'Cornisas sobre Marco', 'cornisa', null, upper), agg('vistas', 'Vistas', 'vistas', 'ambas'),
      accModel('corredera', 'Corredera Común', 'correderas', 'cor_tele'), accModel('bisagra', 'Bisagra Común', 'bisagras', 'bis_comun'),
    ],
  },
  {
    id: 'Dormitorios', cat: 'Placares', items: [
      agg('fondos', 'Fondos', 'fondo'), agg('zocalos', 'Zócalos', 'zocalo'), agg('zocalos_tras', 'Zócalos Traseros', 'zocalo_tras'),
      agg('pies', 'Pies', 'pies'), agg('ruedas', 'Ruedas', 'ruedas'), agg('tapas', 'Tapas', 'tapa'), agg('marcos', 'Marcos', 'marco'),
      agg('cornisas', 'Cornisas', 'cornisa'), accModel('corredera', 'Corredera Común', 'correderas', 'cor_tele'), accModel('bisagra', 'Bisagra Común', 'bisagras', 'bis_comun'),
    ],
  },
  {
    id: 'Baños', cat: 'Baño', items: [
      agg('pies', 'Pies', 'pies'), agg('zocalos', 'Zócalos', 'zocalo'), agg('tapas', 'Tapas', 'tapa'), agg('vistas', 'Vistas', 'vistas', 'ambas'),
      accModel('bisagra', 'Bisagra Común', 'bisagras', 'bis_comun'),
    ],
  },
];

export const categoryOf = (mod) => AUTO_CATEGORIES.find((c) => c.cat === MODULE_TYPES[mod.type]?.cat && MODULE_TYPES[mod.type]?.kind === 'caja') || null;

// Pone (on) o saca los ítems `itemIds` de la categoría `catId` en los módulos (todos los de esa
// categoría o solo `onlyIds`). `rulesOf(m)` da las reglas efectivas del módulo.
export function applyAuto(project, catId, itemIds, on, rulesOf, onlyIds = null) {
  const c = AUTO_CATEGORIES.find((x) => x.id === catId);
  if (!c) return project;
  const only = onlyIds ? new Set(onlyIds) : null;
  const items = c.items.filter((i) => itemIds.includes(i.id));
  return {
    ...project,
    modules: project.modules.map((m) => {
      if (categoryOf(m) !== c || (only && !only.has(m.id))) return m;
      return items.reduce((acc, i) => (i.when && !i.when(acc) ? acc : i.apply(acc, rulesOf(acc), on)), m);
    }),
  };
}

// Módulo recién insertado: se le agregan los ítems tildados en la pestaña "Inserción".
export function withAutoInsert(mod, project, rulesOf) {
  const c = categoryOf(mod);
  const ids = c && project.autoInsert?.[c.id];
  if (!ids?.length) return mod;
  return c.items.filter((i) => ids.includes(i.id)).reduce((acc, i) => (i.when && !i.when(acc) ? acc : i.apply(acc, rulesOf(acc), true)), mod);
}
