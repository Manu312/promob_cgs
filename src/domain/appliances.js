// Electrodomésticos y accesorios paramétricos propios (Fase 6). Se arman con piezas
// decorativas: no van al despiece. Coordenadas locales como los módulos: x ancho, y alto,
// z profundidad (pared = 0, frente = D). Medidas de referencia: docs/MEDIDAS-ELECTRODOMESTICOS.md.

export const FINISHES = [['inox', 'Acero inoxidable'], ['blanco', 'Esmalte blanco'], ['negro', 'Negro'], ['vidrio', 'Vidrio templado negro']];
// Opciones propias de cada aparato (no se mezclan en un único "Tipo").
export const TIPOS = [['simple', 'Simple / cíclica'], ['nofrost', 'No frost (freezer arriba)'], ['side', 'Side by side']];
export const CARGAS = [['frontal', 'Carga frontal'], ['superior', 'Carga superior']];
export const CANIOS = [['alto', 'Caño alto'], ['bajo', 'Caño bajo'], ['extraible', 'Extraíble']];

// Pieza: caja o cilindro (eje vertical 'y' o hacia el frente 'z').
export const box = (x, y, z, sx, sy, sz, finish) => ({ decor: 'aparato', x, y, z, sx, sy, sz, finish });
export function cyl(cx, cy, cz, r, h, finish, axis = 'y') {
  return axis === 'y'
    ? { decor: 'aparato', shape: 'cyl', axis, x: cx - r, y: cy, z: cz - r, sx: 2 * r, sy: h, sz: 2 * r, finish }
    : { decor: 'aparato', shape: 'cyl', axis, x: cx - r, y: cy - r, z: cz, sx: 2 * r, sy: 2 * r, sz: h, finish };
}

// Lugar de cada hornalla (fracciones del área y radio): 4 = 2×2, 5 = 4 en las esquinas + una
// grande al centro, 6 = 3×2.
const LAYOUTS = {
  2: [[0.5, 0.28, 45], [0.5, 0.72, 55]],
  4: [[0.27, 0.28, 42], [0.73, 0.28, 42], [0.27, 0.72, 52], [0.73, 0.72, 42]],
  5: [[0.17, 0.27, 40], [0.83, 0.27, 40], [0.17, 0.73, 48], [0.83, 0.73, 40], [0.5, 0.5, 62]],
  6: [[1 / 6, 0.28, 40], [0.5, 0.28, 42], [5 / 6, 0.28, 40], [1 / 6, 0.72, 50], [0.5, 0.72, 42], [5 / 6, 0.72, 40]],
};
export const burnerSpots = (n) => LAYOUTS[n] || LAYOUTS[4];

// Hornallas sobre una superficie (x0..x1, z0..z1) a la altura y, con su rejilla.
function burners(out, n, x0, x1, z0, z1, y, cap = 'negro') {
  const W = x1 - x0, Dz = z1 - z0;
  for (const [fx, fz, r] of burnerSpots(n)) {
    const cx = x0 + W * fx, cz = z0 + Dz * fz;
    out.push(cyl(cx, y, cz, r + 20, 4, 'negro'));
    out.push(cyl(cx, y + 4, cz, r, 14, cap));
    out.push(box(cx - r - 30, y + 18, cz - 4, 2 * r + 60, 8, 8, 'negro')); // rejilla
    out.push(box(cx - 4, y + 18, cz - r - 30, 8, 8, 2 * r + 60, 'negro'));
  }
}

// Cocina de pie: tablero con hornallas, panel de perillas, puerta del horno con vidrio y cajón.
function cocina(p) {
  const { width: W, height: H, depth: D, hornallas: n = 4, finish = 'inox' } = p;
  const out = [];
  out.push(box(0, 60, 0, W, H - 60, D - 20, finish)); // cuerpo
  out.push(box(10, 0, 30, W - 20, 60, D - 70, 'negro')); // zócalo / patas
  out.push(box(0, H - 12, 0, W, 12, D, 'inox')); // mesa
  burners(out, n, 40, W - 40, 40, D - 140, H);
  const pz = D - 20;
  out.push(box(0, H - 130, pz, W, 118, 20, finish)); // panel de perillas
  const k = n + 1;
  for (let i = 0; i < k; i++) out.push(cyl(60 + ((W - 120) * (i + 0.5)) / k, H - 71, pz + 20, 18, 22, 'cromo', 'z'));
  out.push(box(15, 170, pz, W - 30, H - 330, 22, finish)); // puerta del horno
  out.push(box(55, 230, pz + 22, W - 110, H - 470, 2, 'vidrio'));
  out.push(box(70, H - 194, pz + 30, W - 140, 18, 18, 'cromo')); // manija de la puerta
  out.push(box(15, 70, pz, W - 30, 90, 20, finish)); // cajón
  return out;
}

// Anafe: cubierta (vidrio o inox) apoyada en la mesada y el cuerpo que entra en el calado.
function anafe(p) {
  const { width: W, depth: D, hornallas: n = 4, finish = 'vidrio' } = p;
  const out = [];
  out.push(box(30, -45, 30, W - 60, 45, D - 60, 'negro')); // cuerpo (dentro del calado)
  out.push(box(0, 0, 0, W, 8, D, finish === 'vidrio' ? 'vidrio' : 'inox'));
  burners(out, n, 30, W - 30, 30, D - 110, 8);
  for (let i = 0; i < n; i++) out.push(cyl(W - 60 - i * 55, 8, D - 50, 16, 20, 'cromo'));
  return out;
}

// Horno empotrable: frente con vidrio, marco, manija y panel de perillas.
function horno(p) {
  const { width: W, height: H, depth: D, finish = 'inox' } = p;
  const out = [];
  out.push(box(10, 10, 0, W - 20, H - 20, D - 22, 'negro'));
  out.push(box(0, 0, D - 22, W, H, 4, finish)); // marco frontal
  out.push(box(25, 25, D - 18, W - 50, H - 150, 18, 'vidrio')); // puerta
  out.push(box(60, H - 175, D, W - 120, 16, 22, 'cromo')); // manija
  for (const x of [70, W - 70]) out.push(cyl(x, H - 62, D - 18, 18, 22, 'cromo', 'z'));
  out.push(box(W / 2 - 60, H - 80, D - 17, 120, 36, 2, 'vidrio')); // reloj
  return out;
}

// Campana de pared con chimenea hasta arriba (chimneyH).
function campana(p) {
  const { width: W, height: H, depth: D, chimneyH: C = 600, finish = 'inox' } = p;
  const out = [];
  out.push(box(0, 0, 0, W, 60, D, finish)); // cuerpo inferior
  out.push(box((W - 300) / 2, 60, 0, 300, H - 60, 260, finish)); // pirámide/caja de motor
  out.push(box((W - 260) / 2, H, 0, 260, C, 220, finish)); // chimenea
  out.push(box(30, -2, 30, W - 60, 2, D - 60, 'negro')); // filtros
  for (let i = 0; i < 3; i++) out.push(box(W / 2 - 75 + i * 55, 20, D, 40, 14, 4, 'negro')); // botonera
  return out;
}

// Heladera: 'simple' (freezer chico arriba dentro de la puerta), 'nofrost' (freezer arriba con
// puerta propia), 'side' (side by side: dos puertas verticales y dispenser).
function heladera(p) {
  const { width: W, height: H, depth: D, tipo = 'nofrost', finish = 'inox' } = p;
  const out = [box(0, 0, 0, W, H, D - 40, finish)];
  const fz = D - 40, handle = (x, y, h) => out.push(box(x, y, fz + 40, 22, h, 24, 'cromo'));
  if (tipo === 'side') {
    const w = (W - 6) / 2;
    out.push(box(0, 20, fz, w, H - 20, 40, finish), box(w + 6, 20, fz, w, H - 20, 40, finish));
    out.push(box(70, H * 0.48, fz + 40, w - 140, 300, 4, 'negro')); // dispenser
    handle(w - 40, H * 0.35, H * 0.4); handle(w + 24, H * 0.35, H * 0.4);
  } else if (tipo === 'simple') {
    out.push(box(0, 20, fz, W, H - 20, 40, finish));
    handle(W - 60, H * 0.55, 300);
  } else {
    const fh = Math.round(H * 0.3);
    out.push(box(0, H - fh, fz, W, fh, 40, finish), box(0, 20, fz, W, H - fh - 26, 40, finish));
    handle(W - 60, H - fh + 40, fh * 0.6); handle(W - 60, H - fh - 420, 360);
  }
  out.push(box(20, 0, 40, W - 40, 20, D - 80, 'negro')); // zócalo
  return out;
}

// Microondas: 'apoyo' (cuerpo con ventana y panel a la derecha) o 'empotrable' (frente con marco).
function microondas(p) {
  const { width: W, height: H, depth: D, finish = 'inox' } = p;
  const out = [box(0, 0, 0, W, H, D - 20, finish === 'inox' ? 'inox' : finish)];
  const panel = Math.max(90, W * 0.22);
  out.push(box(0, 0, D - 20, W - panel, H, 20, 'negro')); // puerta
  out.push(box(30, 30, D, W - panel - 60, H - 60, 2, 'vidrio')); // ventana
  out.push(box(W - panel, 0, D - 20, panel, H, 20, finish)); // panel
  out.push(box(W - panel + 15, H - 70, D, panel - 30, 30, 2, 'vidrio')); // display
  out.push(cyl(W - panel / 2, H / 2 - 20, D, 20, 18, 'cromo', 'z'));
  return out;
}

// Lavavajillas: frente con manija y panel de comandos arriba.
function lavavajillas(p) {
  const { width: W, height: H, depth: D, finish = 'inox' } = p;
  return [
    box(0, 0, 0, W, H, D - 20, finish),
    box(0, 90, D - 20, W, H - 190, 20, finish), // puerta
    box(0, H - 100, D - 20, W, 100, 20, 'negro'), // panel
    box(W * 0.3, H - 70, D, W * 0.4, 30, 2, 'vidrio'),
    box(60, H - 150, D, W - 120, 18, 22, 'cromo'), // manija
    box(20, 0, D - 60, W - 40, 90, 40, 'negro'), // zócalo
  ];
}

// Lavarropas: 'frontal' (ojo de buey) o 'superior' (tapa arriba y panel atrás).
function lavarropas(p) {
  const { width: W, height: H, depth: D, finish = 'blanco' } = p;
  const tipo = p.carga || p.tipo || 'frontal';
  const out = [box(0, 0, 0, W, H, D, finish)];
  if (tipo === 'superior') {
    out.push(box(20, H, 20, W - 40, 10, D * 0.62, finish)); // tapa
    out.push(box(0, H, D * 0.68, W, 120, D * 0.3, finish)); // panel trasero
    out.push(box(40, H + 40, D * 0.68 - 2, W - 80, 50, 2, 'vidrio'));
  } else {
    out.push(box(0, H - 110, D, W, 110, 2, finish === 'blanco' ? 'blanco' : 'negro')); // panel
    out.push(box(25, H - 85, D + 2, 150, 60, 2, 'negro')); // cajón de jabón
    out.push(cyl(W * 0.72, H - 55, D + 2, 26, 18, 'cromo', 'z'));
    out.push(cyl(W / 2, H * 0.47, D, Math.min(W, H) * 0.3, 24, 'cromo', 'z')); // aro de la puerta
    out.push(cyl(W / 2, H * 0.47, D + 24, Math.min(W, H) * 0.24, 6, 'vidrio', 'z')); // vidrio
  }
  return out;
}

// Bacha de acero: 1 o 2 cubetas; 'apoyo' (con borde sobre la mesada y escurridor) o 'bajo'
// mesada (sin borde a la vista). Las cubetas se dibujan como un hueco (paredes y fondo).
export function sinkBowls(p) {
  const { width: W, depth: D, bowls = 1, montaje = 'apoyo' } = p;
  const m = montaje === 'bajo' ? 0 : 40; // borde
  const esc = montaje === 'apoyo' && bowls === 1 && W >= 650 ? W * 0.42 : 0; // escurridor
  const bw = (W - 2 * m - esc - (bowls - 1) * 40) / bowls, bd = D - 2 * m;
  return Array.from({ length: bowls }, (_, i) => ({ x: m + i * (bw + 40), z: m, w: bw, d: bd }));
}
function bacha(p) {
  const { width: W, depth: D, montaje = 'apoyo', bowlDepth: B = 180 } = p;
  const out = [];
  const bowls = sinkBowls(p);
  if (montaje === 'apoyo') { // borde y escurridor sobre la mesada
    const last = bowls.at(-1);
    out.push(box(0, 0, 0, W, 3, bowls[0].z, 'inox'), box(0, 0, D - bowls[0].z, W, 3, bowls[0].z, 'inox'));
    out.push(box(0, 0, 0, bowls[0].x, 3, D, 'inox'), box(last.x + last.w, 0, 0, W - last.x - last.w, 3, D, 'inox'));
    for (let i = 0; i + 1 < bowls.length; i++) out.push(box(bowls[i].x + bowls[i].w, 0, 0, 40, 3, D, 'inox'));
    if (last.x + last.w + 60 < W) for (let k = 0; k < 6; k++) out.push(box(last.x + last.w + 40, 3, 70 + k * ((D - 140) / 6), W - last.x - last.w - 80, 1, 6, 'negro'));
  }
  for (const b of bowls) {
    out.push(box(b.x, -B, b.z, b.w, 2, b.d, 'inox')); // fondo
    out.push(box(b.x, -B, b.z, 2, B, b.d, 'inox'), box(b.x + b.w - 2, -B, b.z, 2, B, b.d, 'inox'));
    out.push(box(b.x, -B, b.z, b.w, B, 2, 'inox'), box(b.x, -B, b.z + b.d - 2, b.w, B, 2, 'inox'));
    out.push(cyl(b.x + b.w / 2, -B + 2, b.z + b.d / 2, 30, 2, 'cromo')); // desagüe
  }
  return out;
}

// Grifería monocomando: 'alto' (caño alto curvo), 'bajo' o 'extraible' (cabezal grueso).
function griferia(p) {
  const { height: H = 334, reach: R = 210, finish = 'cromo' } = p;
  const tipo = p.canio || p.tipo || 'alto';
  const out = [cyl(30, 0, 30, 28, 30, finish)]; // base
  const bodyH = tipo === 'bajo' ? H - 30 : 160;
  out.push(cyl(30, 30, 30, 22, bodyH, finish)); // cuerpo
  out.push(box(22, 30 + bodyH - 10, 30, 16, 14, 60, finish)); // palanca
  if (tipo === 'bajo') {
    out.push(box(22, H - 40, 30, 16, 16, R, finish)); // caño recto
  } else {
    out.push(cyl(30, 30 + bodyH, 30, 14, H - bodyH - 50, finish)); // caño que sube
    out.push(box(22, H - 30, 30, 16, 16, R, finish)); // cuello que avanza
    out.push(tipo === 'extraible' ? cyl(30, H - 120, 30 + R - 10, 22, 100, finish) : cyl(30, H - 70, 30 + R - 8, 10, 50, finish)); // salida
  }
  return out;
}

// Sanitarios de baño (Fase 6.3), en cerámica blanca.
function inodoro(p) {
  const { width: W, height: H, depth: D } = p;
  const out = [];
  out.push(box(W * 0.22, 0, D * 0.25, W * 0.56, 330, D * 0.5, 'ceramica')); // pie
  out.push(cyl(W / 2, 330, D * 0.62, W / 2, 80, 'ceramica')); // taza
  out.push(cyl(W / 2, 410, D * 0.62, W / 2 - 8, 18, 'blanco')); // asiento
  out.push(box(W * 0.06, 410, D * 0.33, W * 0.88, 18, D * 0.12, 'blanco')); // bisagra del asiento
  out.push(box(0, 400, 0, W, H - 400, 190, 'ceramica')); // mochila
  out.push(box(W / 2 - 25, H, 60, 50, 8, 50, 'cromo')); // botón
  return out;
}
function bidet(p) {
  const { width: W, height: H, depth: D } = p;
  return [
    box(W * 0.2, 0, D * 0.2, W * 0.6, H - 90, D * 0.55, 'ceramica'),
    cyl(W / 2, H - 90, D * 0.55, W / 2, 90, 'ceramica'),
    box(W * 0.1, H - 90, 0, W * 0.8, 90, D * 0.3, 'ceramica'),
    cyl(W / 2, H - 10, D * 0.55, W / 2 - 25, 12, 'blanco'), // interior
    cyl(W / 2, H, 70, 18, 60, 'cromo'), // grifería
  ];
}
// Lavatorio: 'pie' (con columna hasta el piso) o 'colgar'. y = borde de abajo de la pileta.
function lavatorio(p) {
  const { width: W, height: H, depth: D, montaje = 'pie', y = 680 } = p;
  const out = [
    box(0, 0, 0, W, 30, D, 'ceramica'), // fondo
    box(0, 0, 0, 25, H, D, 'ceramica'), box(W - 25, 0, 0, 25, H, D, 'ceramica'),
    box(0, 0, 0, W, H, 25, 'ceramica'), box(0, 0, D - 25, W, H, 25, 'ceramica'),
    cyl(W / 2, 30, D * 0.55, 18, 2, 'cromo'), // desagüe
  ];
  if (montaje === 'pie') out.push(box(W * 0.33, -y, D * 0.3, W * 0.34, y, D * 0.35, 'ceramica'));
  return out;
}
function griferiaBano(p) {
  const { height: H = 160, reach: R = 120, finish = 'cromo' } = p;
  return [cyl(25, 0, 25, 22, 20, finish), cyl(25, 20, 25, 18, H - 40, finish), box(18, H - 30, 25, 14, 14, R, finish), box(18, H - 20, 0, 14, 10, 40, finish)];
}

export const APPLIANCE_BUILDERS = { cocina, anafe, horno, campana, heladera, microondas, lavavajillas, lavarropas, bacha, griferia, inodoro, bidet, lavatorio, griferiaBano };

// Rectángulo que cala la mesada, en coordenadas locales del aparato (null si no cala).
export function cutoutOf(type, p, def) {
  if (type === 'bacha') {
    const bs = sinkBowls(p);
    if (p.montaje === 'bajo') { const x0 = Math.min(...bs.map((b) => b.x)), x1 = Math.max(...bs.map((b) => b.x + b.w)); return { x0, z0: bs[0].z, x1, z1: bs[0].z + bs[0].d }; }
    return { x0: 20, z0: 20, x1: p.width - 20, z1: p.depth - 20 };
  }
  if (def?.cut) { const w = Math.min(def.cut.w, p.width - 10), d = Math.min(def.cut.d, p.depth - 10); return { x0: (p.width - w) / 2, z0: (p.depth - d) / 2, x1: (p.width + w) / 2, z1: (p.depth + d) / 2 }; }
  return null;
}

// Parte un rectángulo {x0,z0,x1,z1} alrededor de los huecos (la mesada calada).
export function splitAround(rect, holes) {
  let rects = [rect];
  for (const h of holes) {
    const next = [];
    for (const r of rects) {
      const ix0 = Math.max(r.x0, h.x0), ix1 = Math.min(r.x1, h.x1), iz0 = Math.max(r.z0, h.z0), iz1 = Math.min(r.z1, h.z1);
      if (ix0 >= ix1 || iz0 >= iz1) { next.push(r); continue; }
      if (r.z0 < iz0) next.push({ x0: r.x0, z0: r.z0, x1: r.x1, z1: iz0 });
      if (iz1 < r.z1) next.push({ x0: r.x0, z0: iz1, x1: r.x1, z1: r.z1 });
      if (r.x0 < ix0) next.push({ x0: r.x0, z0: iz0, x1: ix0, z1: iz1 });
      if (ix1 < r.x1) next.push({ x0: ix1, z0: iz0, x1: r.x1, z1: iz1 });
    }
    rects = next;
  }
  return rects;
}

// Construye un aparato: solo piezas decorativas (no van al despiece) y, si tiene precio, la
// línea para el presupuesto.
export function buildAparato(type, p, label) {
  const fn = APPLIANCE_BUILDERS[type];
  const decors = fn ? fn(p) : [];
  const extra = p.price > 0 ? { name: label, price: p.price } : null;
  return { parts: [], decors, hardware: {}, extra };
}
