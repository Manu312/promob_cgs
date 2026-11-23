// Archivos pesados del proyecto en Supabase Storage (Fase 8 S3): al subir a la nube, las imágenes y
// modelos que viajan dentro del proyecto (plano de referencia, fondo del render, modelos 3D
// importados) se guardan como archivos aparte y el proyecto queda con una referencia `asset:<ruta>`.
// Al abrir se vuelven a poner. La copia local del navegador queda completa (funciona sin internet).
// El mismo contenido da la misma ruta: no se sube dos veces.

export const ASSET_PREFIX = 'asset:';
export const isAssetRef = (v) => typeof v === 'string' && v.startsWith(ASSET_PREFIX);
const MIN_CHARS = 2000; // lo chico queda adentro del proyecto

// Huella del contenido (FNV-1a de 32 bits + largo): suficiente para no repetir archivos.
export function contentHash(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return `${h.toString(16).padStart(8, '0')}${s.length.toString(16)}`;
}

const extOf = (s) => {
  const m = /^data:([a-z]+)\/([a-z0-9.+-]+)[;,]/i.exec(s);
  return m ? (m[2] === 'jpeg' ? 'jpg' : m[2].replace(/[^a-z0-9]/gi, '').slice(0, 8)) : 'txt';
};

// Lugares del proyecto donde puede haber archivos pesados: [obtener, poner].
function slots(p) {
  const out = [];
  if (p.planImage?.src) out.push([() => p.planImage.src, (v) => { p.planImage = { ...p.planImage, src: v }; }]);
  if (p.render?.background?.image) out.push([() => p.render.background.image, (v) => { p.render = { ...p.render, background: { ...p.render.background, image: v } }; }]);
  (p.externals || []).forEach((e, i) => {
    if (e?.data) out.push([() => p.externals[i].data, (v) => { p.externals = p.externals.map((x, k) => (k === i ? { ...x, data: v } : x)); }]);
  });
  return out;
}

// Saca los archivos del proyecto: devuelve el proyecto con referencias y la lista de archivos.
export function extractAssets(project, projectId) {
  const p = { ...project };
  const files = [];
  for (const [get, set] of slots(p)) {
    const v = get();
    if (typeof v !== 'string' || isAssetRef(v) || v.length < MIN_CHARS) continue;
    const path = `${projectId}/${contentHash(v)}.${extOf(v)}`;
    files.push({ path, content: v });
    set(`${ASSET_PREFIX}${path}`);
  }
  return { project: p, files };
}

export function assetRefs(project) {
  return slots({ ...project }).map(([get]) => get()).filter(isAssetRef).map((v) => v.slice(ASSET_PREFIX.length));
}

// Vuelve a poner los archivos (contents: ruta → contenido). Lo que no se pudo bajar queda vacío.
export function injectAssets(project, contents) {
  const p = { ...project };
  for (const [get, set] of slots(p)) {
    const v = get();
    if (isAssetRef(v)) set(contents.get(v.slice(ASSET_PREFIX.length)) ?? null);
  }
  return p;
}
