// Importar planta DXF (Promob, "Importar planta baixa"): lector propio de DXF ASCII con líneas,
// arcos, círculos y polilíneas (LWPOLYLINE y POLYLINE/VERTEX, con bulge), por capa; unidades
// del encabezado ($INSUNITS) o elegidas a mano. La planta queda como dibujo de referencia sobre el
// piso y, si se quiere, las líneas de las capas elegidas se convierten en paredes.

export const DXF_UNITS = [['mm', 'Milímetros', 1], ['cm', 'Centímetros', 10], ['m', 'Metros', 1000], ['in', 'Pulgadas', 25.4]];
const INSUNITS = { 1: 'in', 4: 'mm', 5: 'cm', 6: 'm' };
export const unitScale = (u) => (DXF_UNITS.find(([k]) => k === u) || DXF_UNITS[0])[2];

// Pares (código, valor) del archivo.
function pairs(text) {
  const lines = String(text).split(/\r?\n/);
  const out = [];
  for (let i = 0; i + 1 < lines.length; i += 2) out.push([parseInt(lines[i].trim(), 10), lines[i + 1].trim()]);
  return out;
}

export function parseDxf(text) {
  const P = pairs(text);
  let units = null;
  for (let i = 0; i < P.length; i++) if (P[i][0] === 9 && P[i][1] === '$INSUNITS' && P[i + 1]?.[0] === 70) units = INSUNITS[+P[i + 1][1]] || null;
  const start = P.findIndex(([c, v], i) => c === 0 && v === 'SECTION' && P[i + 1]?.[0] === 2 && P[i + 1][1] === 'ENTITIES');
  if (start < 0) return { error: 'El archivo no tiene una sección ENTITIES (¿es un DXF de texto?).' };
  const entities = [];
  let cur = null, poly = null;
  const flush = () => {
    if (!cur) return;
    if (cur.type === 'VERTEX' && poly) poly.pts.push({ x: cur.x, y: cur.y, bulge: cur.bulge || 0 });
    else if (cur.type === 'POLYLINE') poly = { type: 'POLYLINE', layer: cur.layer, closed: !!(cur.flags & 1), pts: [] };
    else if (cur.type === 'SEQEND' && poly) { entities.push({ ...poly, type: 'LWPOLYLINE' }); poly = null; }
    else if (['LINE', 'ARC', 'CIRCLE', 'LWPOLYLINE'].includes(cur.type)) entities.push(cur);
    cur = null;
  };
  for (let i = start + 2; i < P.length; i++) {
    const [c, v] = P[i];
    if (c === 0) {
      flush();
      if (v === 'ENDSEC') break;
      cur = { type: v, layer: '0', pts: [] };
      continue;
    }
    if (!cur) continue;
    const n = parseFloat(v);
    switch (c) {
      case 8: cur.layer = v; break;
      case 10: if (cur.type === 'LWPOLYLINE') cur.pts.push({ x: n, y: 0, bulge: 0 }); else cur.x = n; break;
      case 20: if (cur.type === 'LWPOLYLINE') cur.pts.at(-1).y = n; else cur.y = n; break;
      case 11: cur.x2 = n; break;
      case 21: cur.y2 = n; break;
      case 40: cur.r = n; break;
      case 42: if (cur.type === 'LWPOLYLINE' && cur.pts.length) cur.pts.at(-1).bulge = n; else cur.bulge = n; break;
      case 50: cur.a0 = n; break;
      case 51: cur.a1 = n; break;
      case 70: cur.flags = parseInt(v, 10); if (cur.type === 'LWPOLYLINE') cur.closed = !!(cur.flags & 1); break;
      default: break;
    }
  }
  flush();
  const layers = [...new Set(entities.map((e) => e.layer))];
  return { units, layers, entities };
}

// Arco como polilínea (ángulos en grados, antihorario).
function arcPts(cx, cy, r, a0, a1, step = 10) {
  let sweep = a1 - a0;
  while (sweep <= 0) sweep += 360;
  const n = Math.max(2, Math.ceil(sweep / step));
  return Array.from({ length: n + 1 }, (_, i) => { const t = ((a0 + (sweep * i) / n) * Math.PI) / 180; return [cx + Math.cos(t) * r, cy + Math.sin(t) * r]; });
}
// Tramo de polilínea con bulge (tan(θ/4)) entre p y q.
function bulgePts(p, q, b) {
  if (!b) return [[p.x, p.y], [q.x, q.y]];
  const dx = q.x - p.x, dy = q.y - p.y, L = Math.hypot(dx, dy);
  const th = 4 * Math.atan(b), r = L / (2 * Math.sin(th / 2));
  const mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2;
  const h = r * Math.cos(th / 2) * Math.sign(b);
  const cx = mx - (dy / L) * h, cy = my + (dx / L) * h;
  const a0 = (Math.atan2(p.y - cy, p.x - cx) * 180) / Math.PI, a1 = (Math.atan2(q.y - cy, q.x - cx) * 180) / Math.PI;
  const pts = b > 0 ? arcPts(cx, cy, Math.abs(r), a0, a1) : arcPts(cx, cy, Math.abs(r), a1, a0).reverse();
  return pts;
}

// Segmentos en mm de planta (x, z): el eje y del DXF va hacia el fondo, así que se invierte.
export function dxfSegments(dxf, { layers = null, units = null } = {}) {
  const k = unitScale(units || dxf.units || 'mm');
  const keep = (e) => !layers || layers.includes(e.layer);
  const segs = [];
  const poly = (pts, layer) => { for (let i = 0; i + 1 < pts.length; i++) segs.push({ a: pts[i], b: pts[i + 1], layer }); };
  for (const e of dxf.entities) {
    if (!keep(e)) continue;
    if (e.type === 'LINE') poly([[e.x, e.y], [e.x2, e.y2]], e.layer);
    else if (e.type === 'CIRCLE') poly(arcPts(e.x, e.y, e.r, 0, 360), e.layer);
    else if (e.type === 'ARC') poly(arcPts(e.x, e.y, e.r, e.a0, e.a1), e.layer);
    else if (e.type === 'LWPOLYLINE' && e.pts.length > 1) {
      const pts = e.closed ? [...e.pts, e.pts[0]] : e.pts;
      for (let i = 0; i + 1 < pts.length; i++) poly(bulgePts(pts[i], pts[i + 1], pts[i].bulge), e.layer);
    }
  }
  if (!segs.length) return [];
  // a mm, con el origen en la esquina mínima y el eje y invertido (z hacia el frente)
  const xs = segs.flatMap((s) => [s.a[0], s.b[0]]), ys = segs.flatMap((s) => [s.a[1], s.b[1]]);
  const x0 = Math.min(...xs), y1 = Math.max(...ys);
  const T = ([x, y]) => [Math.round((x - x0) * k), Math.round((y1 - y) * k)];
  return segs.map((s) => ({ a: T(s.a), b: T(s.b), layer: s.layer })).filter((s) => s.a[0] !== s.b[0] || s.a[1] !== s.b[1]);
}

// Convertir en paredes: cada segmento recto es una pared; los extremos cercanos (tol) se unen.
export function segmentsToWalls(segs, { tol = 20, minLen = 100, id = (p, i) => `${p}${i}` } = {}) {
  const nodes = [], walls = [];
  const nodeAt = ([x, z]) => {
    let n = nodes.find((o) => Math.hypot(o.x - x, o.z - z) <= tol);
    if (!n) { n = { id: id('n', nodes.length), x, z }; nodes.push(n); }
    return n.id;
  };
  for (const s of segs) {
    if (Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]) < minLen) continue;
    const n0 = nodeAt(s.a), n1 = nodeAt(s.b);
    if (n0 === n1 || walls.some((w) => (w.n0 === n0 && w.n1 === n1) || (w.n0 === n1 && w.n1 === n0))) continue;
    walls.push({ id: id('w', walls.length), n0, n1 });
  }
  return { nodes, walls };
}

export function segsBounds(segs) {
  const xs = segs.flatMap((s) => [s.a[0], s.b[0]]), zs = segs.flatMap((s) => [s.a[1], s.b[1]]);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) };
}
