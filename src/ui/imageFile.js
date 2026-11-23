import { shrinkSize } from '../domain/render.js';

// Lee una imagen elegida por el usuario y la devuelve como data URL, achicada a `max` px del lado mayor.
// `type`: 'image/jpeg' para fotos (fondo) o 'image/png' para conservar la transparencia (marca de agua).
export function readImageFile(file, { max = 2048, type = 'image/jpeg', quality = 0.88 } = {}) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) { reject(new Error('El archivo no es una imagen')); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const { width, height } = shrinkSize(img.naturalWidth, img.naturalHeight, max);
      const c = document.createElement('canvas');
      c.width = width;
      c.height = height;
      c.getContext('2d').drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL(type, quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer la imagen')); };
    img.src = url;
  });
}

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
