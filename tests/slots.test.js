import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeSettings, slotIds, slotOf } from '../src/domain/catalog.js';
import { buildAll, computeCutList } from '../src/domain/cutlist.js';
import { computeBudget } from '../src/domain/budget.js';
import { nestAll } from '../src/domain/nesting.js';
import { normalizeProject, sampleProject } from '../src/domain/project.js';
import { MODULE_TYPES } from '../src/domain/modules.js';

const settings = mergeSettings({});
const mod = (id, type, mats = {}) => ({ id, type, params: { ...MODULE_TYPES[type].defaults }, x: 0, z: 0, y: 0, rot: 0, mats });

test('tipo de cada pieza por rol y nombre', () => {
  assert.equal(slotOf({ role: 'cuerpo', name: 'Lateral' }), 'externo');
  assert.equal(slotOf({ role: 'cuerpo', name: 'Piso' }), 'cajas');
  assert.equal(slotOf({ role: 'frente', name: 'Puerta' }), 'puertas');
  assert.equal(slotOf({ role: 'frente', name: 'Puerta corrediza' }), 'puertas');
  assert.equal(slotOf({ role: 'frente', name: 'Frente cajón' }), 'frentes');
  assert.equal(slotOf({ role: 'fondo', name: 'Fondo' }), 'fondos');
  assert.equal(slotOf({ role: 'cajon', name: 'Lateral cajón' }), 'cajones');
});

test('proyectos viejos: cuerpo/frente/fondo/cajon pasan a tipos de pieza', () => {
  const { cajas, externo, puertas, frentes, fondos, cajones, tapas } = slotIds({ cuerpo: 'a', frente: 'b', fondo: 'c' }, { fill: true });
  assert.deepEqual({ cajas, externo, puertas, frentes, fondos, cajones, tapas }, { cajas: 'a', externo: 'a', puertas: 'b', frentes: 'b', fondos: 'c', cajones: 'a', tapas: 'gra_gris_mara' });
  assert.deepEqual(slotIds({ frente: 'x' }), { puertas: 'x', frentes: 'x' }, 'en el módulo lo demás se hereda');
  const p = normalizeProject({ ...sampleProject(), defaults: { cuerpo: 'mel18_negro', frente: 'mel18_nogal', fondo: 'fibro3_blanco', cajon: 'mel18_negro' } });
  assert.equal(p.defaults.puertas, 'mel18_nogal');
  assert.equal(p.defaults.externo, 'mel18_negro');
});

test('externo y puertas con materiales distintos: el despiece los separa', () => {
  const p = normalizeProject({ ...sampleProject(), modules: [mod('a', 'bajo')] });
  p.defaults = { ...p.defaults, externo: 'mel18_nogal', puertas: 'mel18_roble', frentes: 'mel18_negro' };
  const [b] = buildAll(p, settings);
  const lat = b.parts.filter((x) => x.name === 'Lateral');
  assert.ok(lat.every((x) => b.mats[x.slot].id === 'mel18_nogal'));
  const cut = computeCutList([b]);
  assert.ok(cut.rows.some((r) => r.matId === 'mel18_nogal' && r.name === 'Lateral'));
  assert.ok(cut.rows.some((r) => r.matId === 'mel18_roble' && r.name === 'Puerta'));
});

test('la mesada va al presupuesto por m² con el precio de su piedra', () => {
  const p = normalizeProject({ ...sampleProject(), modules: [mod('a', 'bajo'), mod('b', 'bajo', { tapas: 'gra_negro_absoluto' })] });
  const built = buildAll(p, settings);
  const cut = computeCutList(built);
  assert.deepEqual(Object.keys(cut.stones).sort(), ['gra_gris_mara', 'gra_negro_absoluto']);
  assert.equal(cut.hardware.mesada, undefined);
  const budget = computeBudget(cut, nestAll(cut.rows, settings), settings);
  const tapa = budget.lines.find((l) => l.desc === 'Tapa Granitos > Negro > Negro Absoluto');
  assert.ok(tapa && tapa.unit === 'm²' && tapa.unitPrice === 190000 && tapa.qty > 0);
  assert.ok(!settings.hardware.some((h) => h.code === 'mesada'));
});
