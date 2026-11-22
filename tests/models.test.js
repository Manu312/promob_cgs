import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyModel, effectiveModel } from '../src/domain/models.js';
import { normalizeProject, sampleProject } from '../src/domain/project.js';

const base = () => {
  const p = normalizeProject(sampleProject());
  p.modules[1] = { ...p.modules[1], mats: { puertas: 'mel18_negro' } };
  return p;
};

test('Todos: cambia el del proyecto y quita lo propio de cada módulo en ese tipo de pieza', () => {
  const p = applyModel(base(), 'puertas', 'mel18_nogal', 'todos');
  assert.equal(p.defaults.puertas, 'mel18_nogal');
  assert.equal(p.modules[1].mats.puertas, undefined);
  assert.deepEqual(effectiveModel(p, 'puertas', p.modules[1]), { id: 'mel18_nogal', inherited: true });
});

test('Todos en un tipo de pieza no toca los otros', () => {
  const p = applyModel(base(), 'frentes', 'mel18_gris', 'todos');
  assert.equal(p.modules[1].mats.puertas, 'mel18_negro');
});

test('Selección: solo los módulos elegidos; null vuelve a "igual que Todos"', () => {
  const p0 = base();
  const id0 = p0.modules[0].id;
  const p = applyModel(p0, 'tapas', 'cua_blanco_estelar', 'seleccion', [id0]);
  assert.equal(p.modules[0].mats.tapas, 'cua_blanco_estelar');
  assert.equal(p.modules[2].mats?.tapas, undefined);
  assert.equal(p.defaults.tapas, p0.defaults.tapas);
  assert.deepEqual(effectiveModel(p, 'tapas', p.modules[0]), { id: 'cua_blanco_estelar', inherited: false });
  const back = applyModel(p, 'tapas', null, 'seleccion', [id0]);
  assert.equal(back.modules[0].mats.tapas, undefined);
});
