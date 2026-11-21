// Optimizador de corte "guillotina" (cortes de lado a lado, aptos para
// seccionadora/escuadradora). Heurística: mejor ajuste por lado corto (BSSF)
// y división por el eje sobrante más corto.

export function packGuillotine(items, sheetL, sheetW, { kerf = 4, trim = 10, allowRotate = true } = {}) {
  const UL = sheetL - 2 * trim + kerf;
  const UW = sheetW - 2 * trim + kerf;
  const sorted = [...items].sort((a, b) => Math.max(b.l, b.w) - Math.max(a.l, a.w) || b.l * b.w - a.l * a.w);
  const sheets = [];
  const unplaced = [];
  const newSheet = () => ({ free: [{ x: 0, y: 0, w: UL, h: UW }], placed: [] });

  const findIn = (sheet, it) => {
    let best = null;
    const opts = [[it.l + kerf, it.w + kerf, false]];
    if (allowRotate && it.l !== it.w) opts.push([it.w + kerf, it.l + kerf, true]);
    sheet.free.forEach((fr, fi) => {
      for (const [w, h, rot] of opts) {
        if (w <= fr.w && h <= fr.h) {
          const score = Math.min(fr.w - w, fr.h - h);
          const area = fr.w * fr.h;
          if (!best || score < best.score || (score === best.score && area < best.area)) best = { fi, w, h, rot, score, area };
        }
      }
    });
    return best;
  };

  const place = (sheet, it, b) => {
    const fr = sheet.free[b.fi];
    sheet.free.splice(b.fi, 1);
    sheet.placed.push({
      ...it,
      x: fr.x + trim,
      y: fr.y + trim,
      pl: b.rot ? it.w : it.l, // largo ocupado sobre el largo de la placa
      pw: b.rot ? it.l : it.w,
      rot: b.rot,
    });
    const rw = fr.w - b.w, rh = fr.h - b.h;
    const rects = rw < rh
      ? [{ x: fr.x + b.w, y: fr.y, w: rw, h: b.h }, { x: fr.x, y: fr.y + b.h, w: fr.w, h: rh }]
      : [{ x: fr.x + b.w, y: fr.y, w: rw, h: fr.h }, { x: fr.x, y: fr.y + b.h, w: b.w, h: rh }];
    for (const r of rects) if (r.w > kerf && r.h > kerf) sheet.free.push(r);
  };

  for (const it of sorted) {
    let target = null, best = null;
    for (const s of sheets) { const b = findIn(s, it); if (b && (!best || b.score < best.score)) { best = b; target = s; } }
    if (!best) {
      const s = newSheet();
      const b = findIn(s, it);
      if (!b) { unplaced.push(it); continue; }
      sheets.push(s); target = s; best = b;
    }
    place(target, it, best);
  }

  const sheetArea = sheetL * sheetW;
  for (const s of sheets) {
    s.usedArea = s.placed.reduce((a, p) => a + p.l * p.w, 0);
    s.yield = s.usedArea / sheetArea;
    delete s.free;
  }
  return { sheets, unplaced };
}

export function nestAll(rows, settings) {
  const byMat = new Map();
  for (const r of rows) {
    if (!byMat.has(r.matId)) byMat.set(r.matId, []);
    for (let i = 0; i < r.qty; i++) byMat.get(r.matId).push({ ref: r.ref, name: r.name, l: r.length, w: r.width });
  }
  const out = [];
  for (const [matId, items] of byMat) {
    const mat = settings.materials.find((m) => m.id === matId);
    if (!mat) continue;
    const res = packGuillotine(items, mat.L, mat.W, { kerf: settings.kerf, trim: settings.trim, allowRotate: !mat.wood });
    const used = res.sheets.reduce((a, s) => a + s.usedArea, 0);
    out.push({ mat, ...res, yield: res.sheets.length ? used / (res.sheets.length * mat.L * mat.W) : 0 });
  }
  return out;
}
