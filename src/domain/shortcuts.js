// Configurar atajos (Promob): cada acción tiene su combinación por defecto y el usuario puede
// cambiarla. El visor sigue atendiendo las combinaciones por defecto: una combinación propia se
// traduce a la de su acción, y la de por defecto de una acción reasignada deja de funcionar.

export const SHORTCUT_ACTIONS = [
  ['select', 'Seleccionar / mover', 'M'], ['pan', 'Pan', 'P'], ['zoom', 'Zoom', 'Z'], ['zoomWin', 'Zoom ventana', 'W'],
  ['walk', 'Caminar', 'C'], ['hotpoint', 'HotPoint (curvar paredes)', 'H'], ['zoomAll', 'Zoom total', 'F6'], ['zoomSel', 'Zoom selección', 'F7'],
  ['ortho', 'Ortogonal / perspectiva', 'F8'], ['fill', 'Modo de relleno siguiente', 'F10'],
  ['collision', 'Colisión', 'B'], ['props', 'Propiedades', 'E'], ['aggs', 'Agregados', 'A'], ['movement', 'Movimiento', 'Ctrl+Shift+M'],
  ['hidden', 'Visible / oculto', 'O'], ['selectAll', 'Seleccionar todo', 'Ctrl+T'], ['group', 'Agrupar', 'U'], ['ungroup', 'Desagrupar', 'Ctrl+U'],
  ['duplicate', 'Duplicar', 'Ctrl+D'], ['copy', 'Copiar', 'Ctrl+C'], ['cut', 'Cortar', 'Ctrl+X'], ['paste', 'Pegar', 'Ctrl+V'],
  ['replace', 'Sustitución rápida', 'S'], ['quickFind', 'Localizar rápido', 'Ctrl+L'], ['locate', 'Ubicar en el catálogo', 'Ctrl+Shift+L'],
  ['drawWalls', 'Construir paredes', 'Ctrl+Shift+P'], ['annotate', 'Cota / distancia', 'D'], ['lockX', 'Bloquear eje X', 'X'], ['lockY', 'Bloquear eje Y', 'Y'],
];

const KEYS = { ' ': 'Space', escape: 'Esc', delete: 'Supr', arrowup: '↑', arrowdown: '↓', arrowleft: '←', arrowright: '→' };

// "Ctrl+Shift+P" ⇄ evento. Las letras van en mayúscula; las teclas de función como F6.
export function normalizeCombo(s) {
  const parts = String(s || '').split('+').map((x) => x.trim()).filter(Boolean);
  if (!parts.length) return '';
  const mods = new Set(parts.slice(0, -1).map((m) => m.toLowerCase()));
  let key = parts.at(-1);
  key = key.length === 1 ? key.toUpperCase() : key[0].toUpperCase() + key.slice(1);
  return [mods.has('ctrl') && 'Ctrl', mods.has('alt') && 'Alt', mods.has('shift') && 'Shift', key].filter(Boolean).join('+');
}

export function comboOfEvent(e) {
  const k = String(e.key || '');
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(k)) return '';
  const key = KEYS[k.toLowerCase()] || (k.length === 1 ? k.toUpperCase() : k);
  return [(e.ctrlKey || e.metaKey) && 'Ctrl', e.altKey && 'Alt', e.shiftKey && 'Shift', key].filter(Boolean).join('+');
}

export function comboToEventInit(combo) {
  const parts = normalizeCombo(combo).split('+');
  const key = parts.at(-1);
  return { key: key.length === 1 ? key.toLowerCase() : key, ctrlKey: parts.includes('Ctrl'), metaKey: false, altKey: parts.includes('Alt'), shiftKey: parts.includes('Shift') };
}

export function shortcutsOf(custom = {}) {
  return SHORTCUT_ACTIONS.map(([id, label, def]) => ({ id, label, def, combo: normalizeCombo(custom[id] || def) }));
}

// Acciones con la misma combinación.
export function conflicts(custom = {}) {
  const by = new Map();
  for (const s of shortcutsOf(custom)) by.set(s.combo, [...(by.get(s.combo) || []), s.id]);
  return [...by.values()].filter((ids) => ids.length > 1);
}

// Qué hacer con un evento: seguir igual, bloquearlo o tratarlo como la combinación por defecto de otra acción.
export function remapEvent(e, custom = {}) {
  if (!custom || !Object.keys(custom).length) return { kind: 'pass' };
  const combo = comboOfEvent(e);
  if (!combo) return { kind: 'pass' };
  const list = shortcutsOf(custom);
  const mine = list.find((s) => s.combo === combo && s.combo !== normalizeCombo(s.def));
  if (mine) return { kind: 'as', init: comboToEventInit(mine.def) };
  const taken = list.find((s) => normalizeCombo(s.def) === combo && s.combo !== combo);
  if (taken) return { kind: 'block' };
  return { kind: 'pass' };
}
