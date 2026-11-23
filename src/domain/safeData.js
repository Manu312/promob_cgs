// Datos que vienen de afuera (un .mueble.json importado, un archivo de favoritos): las imágenes
// solo se aceptan como data URL de imagen en base64 (nada de direcciones de internet, que harían
// que la app las vaya a buscar) y el CSS las recibe entre comillas.

const IMAGE_DATA_URL = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/;
export const MAX_IMAGE_CHARS = 8_000_000;

export function isSafeImageDataUrl(s, max = MAX_IMAGE_CHARS) {
  return typeof s === 'string' && s.length <= max && IMAGE_DATA_URL.test(s);
}

export const safeImageOrNull = (s, max) => (isSafeImageDataUrl(s, max) ? s : null);

// background-image seguro: solo data URL válidas y entre comillas.
export function cssImageUrl(s) {
  return isSafeImageDataUrl(s) ? `url("${s}")` : 'none';
}
