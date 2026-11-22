import { buildModule, moduleName, DEFAULT_RULES } from './modules.js';
import { matById } from './catalog.js';

const clean = (o) => Object.fromEntries(Object.entries(o || {}).filter(([, v]) => v !== undefined && v !== ''));

export function resolveMats(mod, project, settings) {
  const ids = { ...clean(project.defaults), ...clean(mod.mats) };
  return {
    cuerpo: matById(settings, ids.cuerpo),
    frente: matById(settings, ids.frente),
    fondo: matById(settings, ids.fondo),
    cajon: matById(settings, ids.cajon || ids.cuerpo),
  };
}

export function resolveRules(mod, project) {
  return { ...DEFAULT_RULES, ...clean(project.rules), ...clean(mod.rules) };
}

export function buildAll(project, settings) {
  return project.modules.map((mod, i) => {
    const mats = resolveMats(mod, project, settings);
    const b = buildModule(mod, { t: mats.cuerpo.t, tf: mats.frente.t, tb: mats.fondo.t, tc: mats.cajon.t, rules: resolveRules(mod, project) });
    return { id: mod.id, tag: `M${i + 1}`, label: moduleName(mod), mats, ...b };
  });
}

// Largo = mayor dimensión, ancho = media, espesor = menor.
export function partDims(p) {
  const axes = [['x', p.sx], ['y', p.sy], ['z', p.sz]].sort((a, b) => b[1] - a[1]);
  const [L, W, T] = axes;
  return {
    length: Math.round(L[1]),
    width: Math.round(W[1]),
    thick: Math.round(T[1]),
    edgesL: p.edge[L[0]] || 0,
    edgesW: p.edge[W[0]] || 0,
  };
}

export function computeCutList(built) {
  const map = new Map();
  const hardware = {};
  const edgeMeters = {};
  for (const b of built) {
    for (const [c, q] of Object.entries(b.hardware)) hardware[c] = (hardware[c] || 0) + q;
    for (const p of b.parts) {
      const mat = b.mats[p.role];
      const d = partDims(p);
      if (!mat.edge) { d.edgesL = 0; d.edgesW = 0; }
      const key = [mat.id, p.name, d.length, d.width, d.edgesL, d.edgesW].join('|');
      let r = map.get(key);
      if (!r) { r = { matId: mat.id, matName: mat.name, name: p.name, ...d, qty: 0, modules: [] }; map.set(key, r); }
      r.qty++;
      if (!r.modules.includes(b.tag)) r.modules.push(b.tag);
    }
  }
  const rows = [...map.values()].sort((a, b) => a.matName.localeCompare(b.matName) || b.length - a.length || b.width - a.width);
  rows.forEach((r, i) => {
    r.ref = `P${i + 1}`;
    const m = ((r.edgesL * r.length + r.edgesW * r.width) * r.qty) / 1000;
    if (m > 0) {
      edgeMeters[r.matId] = edgeMeters[r.matId] || { name: r.matName, m: 0 };
      edgeMeters[r.matId].m += m;
    }
  });
  return { rows, hardware, edgeMeters };
}
