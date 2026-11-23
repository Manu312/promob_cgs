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

export const DEFAULT_RENDER = {
  quality: 'final',
  samples: { final: 400, profesional: 1000 },
  bounces: { final: 6, profesional: 10 },
  size: { mode: 'ambiente', preset: 'fhd', width: 1920, height: 1080, lock: true },
  showArea: true,
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
