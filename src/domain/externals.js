// Importar archivo 3D (Promob): un modelo OBJ, STL o glTF (.glb / .gltf con todo adentro) que
// queda como "entidad externa" en el ambiente: posición, giro, escala y unidades del archivo.
// El contenido viaja dentro del proyecto (no se baja nada de internet); por eso hay un tope de tamaño.

export const EXTERNAL_FORMATS = [['obj', 'OBJ'], ['stl', 'STL'], ['glb', 'glTF binario (.glb)'], ['gltf', 'glTF (.gltf con todo adentro)']];
export const EXTERNAL_UNITS = [['mm', 'Milímetros', 1], ['cm', 'Centímetros', 10], ['m', 'Metros', 1000], ['in', 'Pulgadas', 25.4]];
export const MAX_EXTERNAL_BYTES = 3 * 1024 * 1024;

export const unitToMm = (u) => (EXTERNAL_UNITS.find(([k]) => k === u) || EXTERNAL_UNITS[2])[2];

export function formatOf(fileName) {
  const ext = String(fileName).toLowerCase().split('.').pop();
  return EXTERNAL_FORMATS.some(([k]) => k === ext) ? ext : null;
}

// ¿Un .gltf de texto pide archivos de afuera (buffers o imágenes por URL)? Esos no se aceptan.
export function gltfHasExternalRefs(text) {
  try {
    const j = JSON.parse(text);
    const uris = [...(j.buffers || []), ...(j.images || [])].map((b) => b.uri).filter(Boolean);
    return uris.some((u) => !/^data:/.test(u));
  } catch { return true; }
}

// Validación del archivo: formato, tamaño y, en glTF, sin referencias externas.
export function validateExternal({ name, size, text = null }) {
  const format = formatOf(name);
  if (!format) return { error: 'Formato no soportado: usá OBJ, STL, GLB o GLTF.' };
  if (size > MAX_EXTERNAL_BYTES) return { error: `El archivo pesa ${(size / 1048576).toFixed(1)} MB; el máximo es ${MAX_EXTERNAL_BYTES / 1048576} MB.` };
  if (format === 'gltf' && text != null && gltfHasExternalRefs(text)) return { error: 'El .gltf usa archivos aparte (.bin o texturas): exportalo como .glb.' };
  return { format };
}

let seq = 0;
export function addExternal(project, { name, format, data, units = 'm' }, id = `x${Date.now().toString(36)}${seq++}`) {
  const e = { id, name: String(name).slice(0, 80), format, data, units, x: 0, z: 0, y: 0, rot: 0, scale: 1, visible: true };
  return { ...project, externals: [...(project.externals || []), e] };
}
export const updateExternal = (project, id, patch) => ({ ...project, externals: (project.externals || []).map((e) => (e.id === id ? { ...e, ...patch } : e)) });
export const removeExternal = (project, id) => ({ ...project, externals: (project.externals || []).filter((e) => e.id !== id) });

export function normalizeExternals(list) {
  return (Array.isArray(list) ? list : []).filter((e) => e && typeof e.id === 'string' && EXTERNAL_FORMATS.some(([k]) => k === e.format) && typeof e.data === 'string' && e.data.length <= MAX_EXTERNAL_BYTES * 1.4)
    .map((e) => ({ ...e, scale: Number.isFinite(+e.scale) && +e.scale > 0 ? +e.scale : 1, units: EXTERNAL_UNITS.some(([k]) => k === e.units) ? e.units : 'm' }));
}
