// Plano de referencia (imagen) apoyado en el piso de la vista Planta, para dibujar las
// paredes encima (como "Importar planta baja" de Promob). No va al render ni a las exportaciones.
// { src: dataURL, wPx, hPx, x, z (esquina superior izquierda, mm), mmPerPx, opacity, visible }

export function placePlanImage(src, wPx, hPx, bounds) {
  const span = Math.max(1, bounds.maxX - bounds.minX) || 3600;
  return { src, wPx, hPx, x: bounds.minX, z: bounds.minZ, mmPerPx: span / wPx, opacity: 0.5, visible: true };
}

export const planImageSize = (img) => ({ w: img.wPx * img.mmPerPx, h: img.hPx * img.mmPerPx });

// Escala con 2 puntos marcados sobre la imagen (en mm del ambiente) y la medida real del
// tramo; el primer punto queda fijo.
export function scalePlanImage(img, p1, p2, realMm) {
  const measured = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
  if (!(measured > 0) || !(realMm > 0)) return img;
  const k = realMm / measured;
  return { ...img, mmPerPx: img.mmPerPx * k, x: p1[0] - (p1[0] - img.x) * k, z: p1[1] - (p1[1] - img.z) * k };
}

// Tamaño aproximado del archivo (base64 → bytes): más de 2 MB hace pesado el proyecto.
export const dataUrlTooBig = (dataUrl, limit = 2 * 1024 * 1024) => ((dataUrl.length - dataUrl.indexOf(',') - 1) * 3) / 4 > limit;
