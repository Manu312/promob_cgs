// Grilla de la vista Planta, en mm del ambiente (alineada a múltiplos del paso,
// no al centro del visor).

// Líneas que cubren la caja `b` + `margin`. Si serían más de `maxLines` por eje,
// se duplica el paso visible (sigue siendo múltiplo del paso pedido).
export function gridLines(b, step, margin = 1000, maxLines = 400) {
  let s = step;
  const span = (lo, hi, k) => [Math.floor((lo - margin) / k) * k, Math.ceil((hi + margin) / k) * k];
  let [x0, x1] = span(b.minX, b.maxX, s), [z0, z1] = span(b.minZ, b.maxZ, s);
  while ((x1 - x0) / s + 1 > maxLines || (z1 - z0) / s + 1 > maxLines) {
    s *= 2;
    [x0, x1] = span(b.minX, b.maxX, s);
    [z0, z1] = span(b.minZ, b.maxZ, s);
  }
  const lines = (a0, a1) => {
    const out = [];
    for (let v = a0; v <= a1; v += s) out.push({ v, major: v % 1000 === 0 });
    return out;
  };
  return { step: s, xs: lines(x0, x1), zs: lines(z0, z1), range: { x0, x1, z0, z1 } };
}

// Zoom de la cámara ortográfica (px por metro) para que entre el ambiente con margen.
export function planFitZoom(b, widthPx, heightPx, marginM = 1) {
  const wm = (b.maxX - b.minX) / 1000 + marginM;
  const dm = (b.maxZ - b.minZ) / 1000 + marginM;
  return Math.min(widthPx / wm, heightPx / dm);
}
