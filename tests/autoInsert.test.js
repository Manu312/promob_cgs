import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AUTO_CATEGORIES, categoryOf, applyAuto, withAutoInsert } from '../src/domain/autoInsert.js';
import { DEFAULT_RULES } from '../src/domain/modules.js';
import { normalizeProject, sampleProject } from '../src/domain/project.js';
import { aggState } from '../src/domain/aggregates.js';

const rulesOf = () => DEFAULT_RULES;

test('categorías como Promob: Cocinas, Dormitorios, Baños', () => {
  assert.deepEqual(AUTO_CATEGORIES.map((c) => c.id), ['Cocinas', 'Dormitorios', 'Baños']);
  const p = normalizeProject(sampleProject());
  assert.equal(categoryOf(p.modules[1]).id, 'Cocinas');
});

test('Ambiente · Insertar: marco solo en los superiores; Remover lo saca', () => {
  const p0 = normalizeProject(sampleProject());
  const p = applyAuto(p0, 'Cocinas', ['marco', 'bisagra'], true, rulesOf);
  const altas = p.modules.filter((m) => (m.y || 0) >= 1000), bajas = p.modules.filter((m) => (m.y || 0) < 1000);
  assert.ok(altas.every((m) => m.aggs?.marco));
  assert.ok(bajas.every((m) => !m.aggs?.marco));
  assert.ok(p.modules.every((m) => m.mats?.bisagras === 'bis_comun'));
  const back = applyAuto(p, 'Cocinas', ['marco', 'bisagra'], false, rulesOf);
  assert.ok(back.modules.every((m) => !m.aggs?.marco && !m.mats?.bisagras));
});

test('Aplicar solamente en los ítems seleccionados', () => {
  const p0 = normalizeProject(sampleProject());
  const id = p0.modules[2].id;
  const p = applyAuto(p0, 'Cocinas', ['tapas'], true, rulesOf, [id]);
  assert.deepEqual(p.modules.filter((m) => m.aggs?.tapa).map((m) => m.id), [id]);
});

test('Inserción: el módulo nuevo sale con lo tildado de su categoría', () => {
  const p = { ...normalizeProject(sampleProject()), autoInsert: { Cocinas: ['pies', 'zocalos'], Dormitorios: ['ruedas'] } };
  const bajo = withAutoInsert({ id: 'n', type: 'bajo', params: { width: 600, height: 870, depth: 560 }, y: 0 }, p, rulesOf);
  assert.equal(aggState(bajo, DEFAULT_RULES).pies.on, true);
  const placard = withAutoInsert({ id: 'q', type: 'placard_bat', params: { width: 1800, height: 2400, depth: 600 }, y: 0 }, p, rulesOf);
  assert.equal(placard.aggs.ruedas, true);
});
