// Paredes curvas (Promob: "Flecha" de la pared, o "Ángulo do arco" en el Editor de Paredes, o
// arrastrar el hotpoint verde con Mover HotPoint). La flecha es la distancia del centro de la
// cuerda al arco: positiva = hacia afuera del ambiente (lado de la normal exterior n), negativa
// = hacia adentro. 0 = pared recta.

// Ángulo del arco (grados) para una cuerda y una flecha, y al revés.
export function arcAngleFromSagitta(chord, s) {
  if (!s) return 0;
  return Math.round(((4 * Math.atan((2 * Math.abs(s)) / chord) * 180) / Math.PI) * 10) / 10 * Math.sign(s);
}
export function sagittaFromArcAngle(chord, deg) {
  if (!deg) return 0;
  const t = Math.min(359, Math.abs(deg));
  return Math.round((chord / 2) * Math.tan((t * Math.PI) / 180 / 4)) * Math.sign(deg);
}

// Largo del arco.
export function arcLength(chord, s) {
  if (!s) return chord;
  const r = radius(chord, s);
  return Math.round(2 * r * Math.asin(Math.min(1, chord / (2 * r))) * (Math.abs(s) > chord / 2 ? -1 : 1) + (Math.abs(s) > chord / 2 ? 2 * Math.PI * r : 0));
}
const radius = (chord, s) => (chord * chord) / (8 * Math.abs(s)) + Math.abs(s) / 2;

// Puntos del arco de a a b con flecha s hacia `n` (incluye a y b).
export function arcPoints(a, b, n, s, segs = 24) {
  if (!s) return [a, b];
  const chord = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const r = radius(chord, s);
  const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const dir = Math.sign(s);
  // el centro está del lado opuesto a la panza, a (r - |s|) del medio de la cuerda
  const c = [mid[0] - n[0] * dir * (r - Math.abs(s)), mid[1] - n[1] * dir * (r - Math.abs(s))];
  const a0 = Math.atan2(a[1] - c[1], a[0] - c[0]);
  let a1 = Math.atan2(b[1] - c[1], b[0] - c[0]);
  const peak = Math.atan2(mid[1] + n[1] * s - c[1], mid[0] + n[0] * s - c[0]);
  // elegir el sentido que pasa por la panza
  let d = a1 - a0;
  const norm = (x) => Math.atan2(Math.sin(x), Math.cos(x));
  const through = (dd) => { const t = norm(peak - a0); return dd > 0 ? (t >= 0 ? t : t + 2 * Math.PI) <= dd : (t <= 0 ? t : t - 2 * Math.PI) >= dd; };
  if (!through(d)) d = d > 0 ? d - 2 * Math.PI : d + 2 * Math.PI;
  return Array.from({ length: segs + 1 }, (_, i) => {
    const t = a0 + (d * i) / segs;
    return [c[0] + r * Math.cos(t), c[1] + r * Math.sin(t)];
  });
}

// Flecha que deja un punto (el hotpoint arrastrado) en el medio del arco.
export function sagittaFromPoint(a, b, n, p) {
  const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  return Math.round((p[0] - mid[0]) * n[0] + (p[1] - mid[1]) * n[1]);
}

// Punto medio del arco (donde va el hotpoint).
export function arcMid(a, b, n, s) {
  return [(a[0] + b[0]) / 2 + n[0] * (s || 0), (a[1] + b[1]) / 2 + n[1] * (s || 0)];
}

// Normales (hacia afuera) en cada punto del arco, para darle espesor.
export function arcNormals(pts, n) {
  return pts.map((p, i) => {
    const q = pts[Math.min(pts.length - 1, i + 1)], o = pts[Math.max(0, i - 1)];
    const tx = q[0] - o[0], tz = q[1] - o[1];
    const l = Math.hypot(tx, tz) || 1;
    const m = [tz / l, -tx / l];
    return m[0] * n[0] + m[1] * n[1] >= 0 ? m : [-m[0], -m[1]];
  });
}
