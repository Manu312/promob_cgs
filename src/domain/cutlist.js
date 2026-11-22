import { buildModule, moduleName, DEFAULT_RULES } from './modules.js';
import { matById, stoneById, slotIds, slotOf, SLOTS, pathLabel, ACC_FAMILIES, accById } from './catalog.js';

const clean = (o) => Object.fromEntries(Object.entries(o || {}).filter(([, v]) => v !== undefined && v !== ''));

// Material de cada tipo de pieza: el del módulo (Selección) o el del proyecto (Todos).
export function resolveMats(mod, project, settings) {
  const ids = { ...slotIds(project.defaults, { fill: true }), ...slotIds(mod.mats) };
  return Object.fromEntries(SLOTS.map((s) => [s.id, s.kind === 'piedra' ? stoneById(settings, ids[s.id]) : matById(settings, ids[s.id])]));
}

// Accesorios elegidos (tirador, bisagra, corredera, pata, acabado) del módulo o del proyecto.
export function resolveAcc(mod, project, settings) {
  const ids = { ...slotIds(project.defaults, { fill: true }), ...slotIds(mod.mats) };
  return Object.fromEntries(ACC_FAMILIES.map((f) => [f.id, accById(settings, f.id, ids[f.id])]));
}

// Los tiradores se dibujan según su modelo: barral del largo del modelo, botón o nada.
export function styleHandles(decors, model) {
  if (!model) return decors;
  if (model.shape === 'sin') return decors.filter((d) => d.decor !== 'manija');
  return decors.map((d) => {
    if (d.decor !== 'manija') return d;
    const axis = d.sx >= d.sy && d.sx >= d.sz ? 'x' : d.sy >= d.sz ? 'y' : 'z'; // eje largo del barral
    const k = 's' + axis, c = d[axis] + d[k] / 2;
    if (model.shape === 'boton') {
      const out = { ...d };
      for (const a of ['x', 'y', 'z']) { const cc = d[a] + d['s' + a] / 2; out['s' + a] = 22; out[a] = cc - 11; } // perilla de 22 mm
      return out;
    }
    const len = model.len || d[k];
    return { ...d, [k]: len, [axis]: c - len / 2 };
  });
}

export function resolveRules(mod, project) {
  return { ...DEFAULT_RULES, ...clean(project.rules), ...clean(mod.rules) };
}

export function buildAll(project, settings) {
  return project.modules.map((mod, i) => {
    const mats = resolveMats(mod, project, settings);
    const b = buildModule(mod, { t: mats.cajas.t, tf: mats.puertas.t, tb: mats.fondos.t, tc: mats.cajones.t, rules: resolveRules(mod, project) });
    const parts = b.parts.map((p) => ({ ...p, slot: slotOf(p) }));
    const acc = resolveAcc(mod, project, settings);
    return { id: mod.id, tag: `M${i + 1}`, label: moduleName(mod), mats, acc, ...b, parts, decors: styleHandles(b.decors, acc.tiradores) };
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
  const stones = {};
  const accItems = {};
  const extras = {}; // electrodomésticos con precio (no van al despiece)
  for (const b of built) {
    if (b.extra) { const k = `${b.extra.name}|${b.extra.price}`; extras[k] = extras[k] || { ...b.extra, qty: 0 }; extras[k].qty++; }
    for (const [c, q] of Object.entries(b.hardware)) {
      const fam = ACC_FAMILIES.find((f) => f.code === c);
      if (c === 'mesada') { // tapas: m² por piedra
        const st = b.mats.tapas;
        stones[st.id] = stones[st.id] || { name: pathLabel(st), m2: 0, priceM2: st.priceM2 };
        stones[st.id].m2 += q;
      } else if (fam && b.acc?.[fam.id]) { // herraje con modelo elegido
        const a = b.acc[fam.id];
        accItems[a.id] = accItems[a.id] || { name: `${fam.one} ${pathLabel(a)}`, unit: fam.unit, price: a.price, qty: 0 };
        accItems[a.id].qty += q;
      } else hardware[c] = (hardware[c] || 0) + q;
    }
    for (const p of b.parts) {
      const mat = b.mats[p.slot || slotOf(p)];
      const d = partDims(p);
      if (!mat.edge) { d.edgesL = 0; d.edgesW = 0; }
      const ac = b.acc?.acabado;
      const key = [mat.id, p.name, d.length, d.width, d.edgesL, d.edgesW, ac?.id].join('|');
      let r = map.get(key);
      if (!r) { r = { matId: mat.id, matName: mat.name, name: p.name, ...d, qty: 0, modules: [], acabado: ac ? { id: ac.id, name: pathLabel(ac), price: ac.price } : null }; map.set(key, r); }
      r.qty++;
      if (!r.modules.includes(b.tag)) r.modules.push(b.tag);
    }
  }
  const rows = [...map.values()].sort((a, b) => a.matName.localeCompare(b.matName) || b.length - a.length || b.width - a.width);
  rows.forEach((r, i) => {
    r.ref = `P${i + 1}`;
    const m = ((r.edgesL * r.length + r.edgesW * r.width) * r.qty) / 1000;
    if (m > 0) { // tapacanto por material y acabado (con su precio por metro)
      const k = `${r.matId}|${r.acabado?.id || ''}`;
      edgeMeters[k] = edgeMeters[k] || { name: r.acabado ? `${r.acabado.name} · ${r.matName}` : r.matName, m: 0, price: r.acabado?.price };
      edgeMeters[k].m += m;
    }
  });
  return { rows, hardware, edgeMeters, stones, accItems, extras };
}
