// Modos de relleno de Promob (Exibir > Preenchimento; F10 pasa al siguiente, Ctrl+F10 = Presentación).

export const FILL_MODES = [
  { id: 'texturas-lineas', label: 'Texturas con líneas', faces: 'textura', lines: true },
  { id: 'texturas', label: 'Texturas', faces: 'textura', lines: false },
  { id: 'relleno-lineas', label: 'Relleno con líneas', faces: 'color', lines: true },
  { id: 'relleno', label: 'Relleno', faces: 'color', lines: false },
  { id: 'oculto', label: 'Oculto', faces: 'blanco', lines: true, lineColor: '#1f2937' },
  { id: 'oculto-bn', label: 'Oculto B/N', faces: 'negro', lines: true, lineColor: '#ffffff', bg: '#000000' },
  { id: 'sin-relleno', label: 'Sin relleno', faces: 'ninguna', lines: true, lineColor: '#1f2937' },
  { id: 'caja', label: 'Caja de contorno', faces: 'ninguna', lines: false, box: true },
  { id: 'presentacion', label: 'Presentación', faces: 'textura', lines: false, presentation: true },
];
export const DEFAULT_FILL = 'texturas';

export function fillMode(id) {
  return FILL_MODES.find((m) => m.id === id) || FILL_MODES.find((m) => m.id === DEFAULT_FILL);
}

// F10: el siguiente modo (da la vuelta).
export function nextFillMode(id) {
  const i = FILL_MODES.findIndex((m) => m.id === fillMode(id).id);
  return FILL_MODES[(i + 1) % FILL_MODES.length].id;
}
