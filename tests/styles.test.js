import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_STYLES, MODEL_KEYS, currentModels, saveStyle, applyStyle, renameStyle, removeStyle, stylesOf } from '../src/domain/styles.js';
import { DEFAULT_MATERIALS, DEFAULT_ACCESSORIES, mergeSettings } from '../src/domain/catalog.js';
import { normalizeProject, sampleProject } from '../src/domain/project.js';

test('los estilos de fábrica usan materiales y accesorios que existen', () => {
  const ids = new Set([...DEFAULT_MATERIALS.map((m) => m.id), ...Object.values(DEFAULT_ACCESSORIES).flat().map((a) => a.id)]);
  for (const s of DEFAULT_STYLES) for (const [k, v] of Object.entries(s.models)) { assert.ok(MODEL_KEYS.includes(k), k); assert.ok(ids.has(v), `${s.name}: ${v}`); }
  assert.equal(stylesOf(mergeSettings({})).length, DEFAULT_STYLES.length);
  assert.deepEqual(stylesOf({ styles: [] }), [], 'si se borraron todos, no vuelven');
});

test('aplicar un estilo a Todos cambia solo lo que el estilo trae', () => {
  const p0 = normalizeProject(sampleProject());
  const nogal = DEFAULT_STYLES.find((s) => s.name === 'Nogal y gris');
  const p = applyStyle(p0, nogal, 'todos');
  assert.equal(p.defaults.puertas, 'mel18_nogal');
  assert.equal(p.defaults.tiradores, 'tir_barral_320');
  assert.equal(p.defaults.fondos, p0.defaults.fondos, 'fondos no está en el estilo');
});

test('aplicar a la Selección: solo el módulo elegido', () => {
  const p0 = normalizeProject(sampleProject());
  const id = p0.modules[2].id;
  const p = applyStyle(p0, DEFAULT_STYLES[3], 'seleccion', [id]);
  assert.equal(p.modules[2].mats.tiradores, 'tir_sin');
  assert.equal(p.modules[1].mats?.tiradores, undefined);
  assert.deepEqual(p.defaults, p0.defaults);
});

test('guardar nuevo estilo con los modelos tildados; mismo nombre lo actualiza', () => {
  const p = normalizeProject(sampleProject());
  const cur = currentModels(p);
  let styles = saveStyle([], 'Mi cocina', cur, ['puertas', 'tapas'], 'x1');
  assert.deepEqual(styles, [{ id: 'x1', name: 'Mi cocina', models: { puertas: cur.puertas, tapas: cur.tapas } }]);
  styles = saveStyle(styles, 'mi cocina ', { ...cur, puertas: 'mel18_negro' }, ['puertas']);
  assert.equal(styles.length, 1);
  assert.deepEqual(styles[0].models, { puertas: 'mel18_negro' });
});

test('renombrar (sin repetir nombres) y borrar', () => {
  const s = [{ id: 'a', name: 'Uno', models: {} }, { id: 'b', name: 'Dos', models: {} }];
  assert.equal(renameStyle(s, 'a', 'Tres')[0].name, 'Tres');
  assert.equal(renameStyle(s, 'a', 'dos'), s, 'no repite nombre');
  assert.deepEqual(removeStyle(s, 'a').map((x) => x.id), ['b']);
});
