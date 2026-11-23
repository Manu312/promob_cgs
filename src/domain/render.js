// Configuración del render (Fase 7), como el diálogo de Promob: calidad, dimensión, clima,
// fondo, marca de agua y 360°. Lógica pura: la UI arma la imagen con estos valores.

// Calidades: el rápido es rasterizado (al instante, para revisar luces y acabados); el final y
// el profesional son trazado de rayos. Muestras y rebotes son configurables por proyecto.
export const QUALITIES = [
  { id: 'rapido', label: 'Render rápido', pathTrace: false, hint: 'Para revisar luces y acabados: sale al instante, sombras menos suaves.' },
  { id: 'final', label: 'Render final', pathTrace: true, hint: 'Trazado de rayos: imagen realista.' },
  { id: 'profesional', label: 'Render profesional', pathTrace: true, hint: 'Más muestras y rebotes: calidad de foto, tarda bastante más.' },
];

// Tamaños preconfigurados (px).
export const SIZE_PRESETS = [
  { id: 'xga', label: '1024 × 768', width: 1024, height: 768 },
  { id: 'hd', label: 'HD 1280 × 720', width: 1280, height: 720 },
  { id: 'fhd', label: 'Full HD 1920 × 1080', width: 1920, height: 1080 },
  { id: 'qhd', label: '2K 2560 × 1440', width: 2560, height: 1440 },
  { id: 'uhd', label: '4K 3840 × 2160', width: 3840, height: 2160 },
  { id: 'cuadrado', label: 'Cuadrado 1080 × 1080', width: 1080, height: 1080 },
  { id: 'a4', label: 'A4 apaisado 300 dpi (3508 × 2480)', width: 3508, height: 2480 },
];

export const SIZE_MODES = [['ambiente', 'Ambiente 3D'], ['preset', 'Tamaños preconfigurados'], ['custom', 'Personalizada']];
export const MIN_SIDE = 64;
export const MAX_SIDE = 8192;

// --- Clima: sol y cielo (Fase 7.2) ---
// Presets como los de Promob. Las intensidades del diálogo multiplican las del preset (100 % = el preset).
// `alt`/`az` = posición del sol sugerida por el preset (amanecer y atardecer, sol bajo).
export const CLIMAS = [
  { id: 'blanca', label: 'Luz blanca', sun: '#ffffff', sunI: 1.6, top: '#ffffff', bottom: '#dcdad6', skyI: 1, alt: 50 },
  { id: 'nublado', label: 'Nublado', sun: '#dde4ec', sunI: 0.45, top: '#c7d1dc', bottom: '#9ea8b3', skyI: 1.05, alt: 60 },
  { id: 'amanecer', label: 'Amanecer', sun: '#ffd7aa', sunI: 1.3, top: '#ffe1c2', bottom: '#b4a3c4', skyI: 0.75, alt: 12, az: 80 },
  { id: 'neblina', label: 'Neblina', sun: '#eef0f1', sunI: 0.3, top: '#eceeef', bottom: '#cfd5d8', skyI: 1.15, alt: 40 },
  { id: 'soleado', label: 'Soleado', sun: '#fff3dc', sunI: 2.2, top: '#b9d5ff', bottom: '#ebe4d6', skyI: 0.95, alt: 55 },
  { id: 'atardecer', label: 'Atardecer', sun: '#ffa865', sunI: 1.4, top: '#ffc994', bottom: '#8c78a6', skyI: 0.65, alt: 10, az: 260 },
  { id: 'ninguno', label: 'No aplicar', sun: '#ffffff', sunI: 0, top: '#ffffff', bottom: '#ffffff', skyI: 0 },
];

export const DEFAULT_CLIMA = { preset: 'blanca', sun: true, sunIntensity: 100, skyIntensity: 100, azimuth: 135, altitude: 50, ambient: true };

const clamp = (v, a, b, d) => (Number.isFinite(+v) ? Math.min(b, Math.max(a, +v)) : d);
const wrap360 = (v) => ((Math.round(+v) % 360) + 360) % 360;

export function normalizeClima(c) {
  const s = c && typeof c === 'object' ? c : {};
  const d = DEFAULT_CLIMA;
  return {
    preset: CLIMAS.some((x) => x.id === s.preset) ? s.preset : d.preset,
    sun: s.sun !== false,
    sunIntensity: clamp(s.sunIntensity, 0, 300, d.sunIntensity),
    skyIntensity: clamp(s.skyIntensity, 0, 300, d.skyIntensity),
    azimuth: Number.isFinite(+s.azimuth) ? wrap360(s.azimuth) : d.azimuth,
    altitude: clamp(Math.round(+s.altitude), 0, 90, d.altitude),
    ambient: s.ambient !== false,
  };
}

// Elegir un preset: el sol se mueve a la posición sugerida (si la tiene).
export function applyClima(c, id) {
  const p = CLIMAS.find((x) => x.id === id);
  if (!p) return c;
  return { ...c, preset: id, ...(p.alt != null ? { altitude: p.alt } : {}), ...(p.az != null ? { azimuth: p.az } : {}) };
}

// Dirección hacia el sol (vector unitario, ejes de la escena: x derecha, y arriba, z hacia el frente).
// Azimut 0° = hacia el fondo de la planta (−z), 90° = derecha (+x), en sentido horario visto desde arriba.
export function sunDirection(azimuth, altitude) {
  const az = (azimuth * Math.PI) / 180;
  const al = (altitude * Math.PI) / 180;
  return [Math.sin(az) * Math.cos(al), Math.sin(al), -Math.cos(az) * Math.cos(al)];
}

// Luces que resultan de la configuración del clima.
export function lightRig(clima) {
  const c = normalizeClima(clima);
  const p = CLIMAS.find((x) => x.id === c.preset);
  const none = p.id === 'ninguno';
  const sunOn = c.sun && !none && c.altitude > 0;
  return {
    sun: { on: sunOn, color: p.sun, intensity: sunOn ? p.sunI * (c.sunIntensity / 100) : 0, dir: sunDirection(c.azimuth, c.altitude) },
    sky: { top: p.top, bottom: p.bottom, intensity: none ? 0 : p.skyI * (c.skyIntensity / 100) },
    ambient: c.ambient ? 1 : 0,
  };
}

// Brújula: ángulo (azimut) del punto (x, y) respecto del centro (cx, cy) de un control en pantalla
// (y hacia abajo); 0° arriba, sentido horario.
export function azimuthFromPoint(cx, cy, x, y) {
  return wrap360((Math.atan2(x - cx, cy - y) * 180) / Math.PI);
}

// Arco de altitud: cuarto de círculo con centro abajo a la izquierda; 0° = horizonte, 90° = cenit.
export function altitudeFromPoint(cx, cy, x, y) {
  const a = (Math.atan2(cy - y, x - cx) * 180) / Math.PI;
  return Math.round(Math.min(90, Math.max(0, a)));
}

// --- Fondo del render (Fase 7.3) ---
// Solo aparece en la imagen renderizada (no ilumina la escena): color, degradé (color principal arriba
// → color gradual abajo, como cielo → horizonte) o imagen, que cubre todo el cuadro sin deformarse.
export const BG_MODES = [['color', 'Color'], ['degrade', 'Degradé'], ['imagen', 'Imagen']];
export const DEFAULT_BACKGROUND = { mode: 'color', color: '#e7e3dc', color2: '#ffffff', image: null };
export const BG_IMAGE_MAX = 2048; // px del lado mayor al cargar la imagen (se guarda con el proyecto)

const isHex = (c) => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c);
export function normalizeBackground(b) {
  const s = b && typeof b === 'object' ? b : {};
  const d = DEFAULT_BACKGROUND;
  return {
    mode: BG_MODES.some(([k]) => k === s.mode) ? s.mode : d.mode,
    color: isHex(s.color) ? s.color : d.color,
    color2: isHex(s.color2) ? s.color2 : d.color2,
    image: typeof s.image === 'string' && s.image.startsWith('data:image/') ? s.image : null,
  };
}

// Rectángulo donde se dibuja una imagen para cubrir todo el cuadro W × H (centrada, se recorta lo que sobra).
export function coverRect(iw, ih, W, H) {
  const s = Math.max(W / iw, H / ih);
  const w = iw * s;
  const h = ih * s;
  return { x: (W - w) / 2, y: (H - h) / 2, w, h };
}

// Tamaño reducido para que el lado mayor no pase de `max` (no agranda).
export function shrinkSize(w, h, max) {
  const s = Math.min(1, max / Math.max(w, h));
  return { width: Math.max(1, Math.round(w * s)), height: Math.max(1, Math.round(h * s)) };
}

// --- Marca de agua (Fase 7.4) ---
// Como en Promob: imagen a su tamaño (se achica solo si no entra), 9 posiciones, transparencia
// (más alta = menos visible) y distancia al borde en px, medida desde los bordes de la posición elegida.
// Se guarda aparte del proyecto para reutilizarla en todos los renders.
export const WM_POSITIONS = [
  ['sup-izq', 'Superior izquierda'], ['sup-centro', 'Superior centro'], ['sup-der', 'Superior derecha'],
  ['centro-izq', 'Centro izquierda'], ['centro', 'Centro'], ['centro-der', 'Centro derecha'],
  ['inf-izq', 'Inferior izquierda'], ['inf-centro', 'Inferior centro'], ['inf-der', 'Inferior derecha'],
];
export const DEFAULT_WATERMARK = { use: false, image: null, position: 'centro', transparency: 50, offset: 20 };
export const WM_IMAGE_MAX = 1024;

export function normalizeWatermark(w) {
  const s = w && typeof w === 'object' ? w : {};
  const d = DEFAULT_WATERMARK;
  return {
    use: s.use === true,
    image: typeof s.image === 'string' && s.image.startsWith('data:image/') ? s.image : null,
    position: WM_POSITIONS.some(([k]) => k === s.position) ? s.position : d.position,
    transparency: Number.isFinite(+s.transparency) ? Math.min(100, Math.max(0, Math.round(+s.transparency))) : d.transparency,
    offset: Number.isFinite(+s.offset) ? Math.min(2000, Math.max(0, Math.round(+s.offset))) : d.offset,
  };
}

// Dónde va la marca (imagen iw × ih) en un render W × H. Opacidad = 1 − transparencia.
export function watermarkRect(iw, ih, W, H, position, offset) {
  const room = { w: Math.max(1, W - 2 * offset), h: Math.max(1, H - 2 * offset) };
  const s = Math.min(1, room.w / iw, room.h / ih);
  const w = iw * s;
  const h = ih * s;
  const [v, hz] = position === 'centro' ? ['centro', 'centro'] : position.split('-');
  const x = hz === 'izq' ? offset : hz === 'der' ? W - w - offset : (W - w) / 2;
  const y = v === 'sup' ? offset : v === 'inf' ? H - h - offset : (H - h) / 2;
  return { x, y, w, h };
}

export const DEFAULT_RENDER = {
  quality: 'final',
  samples: { final: 400, profesional: 1000 },
  bounces: { final: 6, profesional: 10 },
  size: { mode: 'ambiente', preset: 'fhd', width: 1920, height: 1080, lock: true },
  showArea: true,
  clima: DEFAULT_CLIMA,
  background: DEFAULT_BACKGROUND,
};

const clampSide = (v) => Math.min(MAX_SIDE, Math.max(MIN_SIDE, Math.round(+v || 0)));
const posInt = (v, d) => (Number.isFinite(+v) && +v >= 1 ? Math.round(+v) : d);

// Completa y valida la configuración guardada en el proyecto (proyectos viejos no la tienen).
export function normalizeRender(r) {
  const src = r && typeof r === 'object' ? r : {};
  const d = DEFAULT_RENDER;
  const size = { ...d.size, ...(src.size || {}) };
  return {
    ...d,
    ...src,
    quality: QUALITIES.some((q) => q.id === src.quality) ? src.quality : d.quality,
    samples: { final: posInt(src.samples?.final, d.samples.final), profesional: posInt(src.samples?.profesional, d.samples.profesional) },
    bounces: { final: posInt(src.bounces?.final, d.bounces.final), profesional: posInt(src.bounces?.profesional, d.bounces.profesional) },
    size: {
      mode: SIZE_MODES.some(([k]) => k === size.mode) ? size.mode : d.size.mode,
      preset: SIZE_PRESETS.some((p) => p.id === size.preset) ? size.preset : d.size.preset,
      width: clampSide(size.width), height: clampSide(size.height), lock: size.lock !== false,
    },
    showArea: src.showArea !== false,
    clima: normalizeClima(src.clima),
    background: normalizeBackground(src.background),
  };
}

// Calidad efectiva: rasterizado o trazado de rayos, con sus muestras y rebotes.
export function qualityOf(r) {
  const q = QUALITIES.find((x) => x.id === r.quality) || QUALITIES[1];
  if (!q.pathTrace) return { ...q, samples: 1, bounces: 0 };
  return { ...q, samples: r.samples[q.id], bounces: r.bounces[q.id] };
}

// Tamaño final de la imagen. `view` = tamaño de la vista 3D en px (Ambiente 3D).
export function renderSize(r, view) {
  const s = r.size;
  if (s.mode === 'preset') {
    const p = SIZE_PRESETS.find((x) => x.id === s.preset) || SIZE_PRESETS[2];
    return { width: p.width, height: p.height };
  }
  if (s.mode === 'custom') return { width: clampSide(s.width), height: clampSide(s.height) };
  const d = DEFAULT_RENDER.size;
  return { width: clampSide(view?.width || d.width), height: clampSide(view?.height || d.height) };
}

// Cambia el ancho o el alto de la medida personalizada; con la proporción trabada, el otro acompaña.
export function setCustomSide(size, key, value) {
  const v = clampSide(value);
  if (!size.lock) return { ...size, [key]: v };
  const ratio = size.width / size.height;
  if (key === 'width') return { ...size, width: v, height: clampSide(v / ratio) };
  return { ...size, height: v, width: clampSide(v * ratio) };
}

// Área que se renderiza dentro de la vista: el rectángulo más grande con la proporción de la
// imagen, centrado (como el recuadro claro de Promob).
export function fitRect(aspect, vw, vh) {
  let w = vw;
  let h = vw / aspect;
  if (h > vh) { h = vh; w = vh * aspect; }
  return { x: (vw - w) / 2, y: (vh - h) / 2, w, h };
}

// Campo de visión vertical (grados) de la cámara del render para que encuadre exactamente el área:
// la vista tiene `fov` vertical y el área ocupa la fracción `hFrac` de su alto.
export function renderFov(fov, hFrac) {
  const t = Math.tan(((fov * Math.PI) / 180) / 2) * hFrac;
  return (2 * Math.atan(t) * 180) / Math.PI;
}
