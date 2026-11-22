const r2 = (v) => Math.round(v * 100) / 100;

export function computeBudget(cut, nesting, settings) {
  const lines = [];
  for (const n of nesting) {
    if (!n.sheets.length) continue;
    lines.push({ group: 'Placas', desc: `${n.mat.name} (${n.mat.L}×${n.mat.W})`, qty: n.sheets.length, unit: 'placa', unitPrice: n.mat.price, total: n.sheets.length * n.mat.price });
  }
  for (const e of Object.values(cut.edgeMeters)) {
    const m = r2(e.m * (1 + settings.edgeWaste));
    const pr = e.price ?? settings.edgePerM;
    lines.push({ group: 'Tapacantos', desc: `Tapacanto ${e.name}`, qty: m, unit: 'm', unitPrice: pr, total: m * pr });
  }
  for (const s of Object.values(cut.stones || {})) {
    const m2 = r2(s.m2);
    lines.push({ group: 'Tapas', desc: `Tapa ${s.name}`, qty: m2, unit: 'm²', unitPrice: s.priceM2, total: m2 * s.priceM2 });
  }
  for (const a of Object.values(cut.accItems || {})) {
    const q = r2(a.qty);
    lines.push({ group: 'Herrajes', desc: a.name, qty: q, unit: a.unit, unitPrice: a.price, total: q * a.price });
  }
  for (const [code, qty] of Object.entries(cut.hardware)) {
    const h = settings.hardware.find((x) => x.code === code);
    if (!h) continue;
    const q = r2(qty);
    lines.push({ group: 'Herrajes', desc: h.name, qty: q, unit: h.unit, unitPrice: h.price, total: q * h.price });
  }
  const materiales = lines.reduce((a, l) => a + l.total, 0);
  const labor = (materiales * settings.laborPct) / 100;
  const costo = materiales + labor;
  const margen = (costo * settings.marginPct) / 100;
  const neto = costo + margen;
  const iva = (neto * settings.ivaPct) / 100;
  return { lines, materiales, labor, costo, margen, neto, iva, total: neto + iva };
}
