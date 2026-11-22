// Estilos de modelos (como Promob): una combinación con nombre de materiales y accesorios.
// "Guardar nuevo estilo" con un nombre que ya existe lo actualiza. Son globales (no del
// proyecto), así se usan en todos los trabajos.
import { SLOTS, ACC_FAMILIES } from './catalog.js';
import { applyModel, effectiveModel } from './models.js';

export const MODEL_KEYS = [...SLOTS.map((s) => s.id), ...ACC_FAMILIES.map((f) => f.id)];

const st = (id, name, models) => ({ id, name, models });
export const DEFAULT_STYLES = [
  st('est_blanco', 'Blanco clásico', { cajas: 'mel18_blanco', externo: 'mel18_blanco', puertas: 'mel18_blanco', frentes: 'mel18_blanco', cajones: 'mel18_blanco', tapas: 'gra_gris_mara', tiradores: 'tir_barral_128' }),
  st('est_roble', 'Roble y blanco', { cajas: 'mel18_blanco', externo: 'mel18_blanco', puertas: 'mel18_roble', frentes: 'mel18_roble', tapas: 'gra_negro_brasil', tiradores: 'tir_barral_192' }),
  st('est_nogal', 'Nogal y gris', { cajas: 'mel18_gris', externo: 'mel18_nogal', puertas: 'mel18_nogal', frentes: 'mel18_nogal', tapas: 'cua_gris_concreto', tiradores: 'tir_barral_320' }),
  st('est_negro', 'Negro sin tirador', { cajas: 'mel18_blanco', externo: 'mel18_negro', puertas: 'mel18_negro', frentes: 'mel18_negro', tapas: 'cua_blanco_estelar', tiradores: 'tir_sin', correderas: 'cor_push' }),
];

// Modelos actuales (de Todos o, con módulo, los efectivos de ese módulo).
export function currentModels(project, mod = null) {
  return Object.fromEntries(MODEL_KEYS.map((k) => [k, effectiveModel(project, k, mod).id]));
}

const same = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();

export function saveStyle(styles, name, models, include = MODEL_KEYS, id = null) {
  const picked = Object.fromEntries(include.filter((k) => models[k]).map((k) => [k, models[k]]));
  const old = styles.find((s) => same(s.name, name));
  if (old) return styles.map((s) => (s === old ? { ...s, name: name.trim(), models: picked } : s));
  return [...styles, { id: id || 'est_' + Math.random().toString(36).slice(2, 8), name: name.trim(), models: picked }];
}

export function applyStyle(project, style, scope = 'todos', moduleIds = []) {
  return Object.entries(style.models).reduce((p, [k, v]) => applyModel(p, k, v, scope, moduleIds), project);
}

export const renameStyle = (styles, id, name) => (name.trim() && !styles.some((s) => s.id !== id && same(s.name, name)) ? styles.map((s) => (s.id === id ? { ...s, name: name.trim() } : s)) : styles);
export const removeStyle = (styles, id) => styles.filter((s) => s.id !== id);

// Estilos guardados (si nunca se tocaron, los de fábrica).
export const stylesOf = (settings) => (Array.isArray(settings?.styles) ? settings.styles : DEFAULT_STYLES);
