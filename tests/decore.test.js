import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MODULE_TYPES, buildModule, fieldsFor } from '../src/domain/modules.js';
import { LIBRARY } from '../src/domain/library.js';
import { applyDecoreMaterialToType } from '../src/domain/decore.js';
import { computeCutList, buildAll } from '../src/domain/cutlist.js';
import { DEFAULT_SETTINGS, mergeSettings } from '../src/domain/catalog.js';
import { emptyProject } from '../src/domain/project.js';

const mod = (type, params = {}) => ({ id: type, type, params: { ...MODULE_TYPES[type].defaults, ...params }, x: 0, z: 0, y: MODULE_TYPES[type].y, rot: 0, mats: {} });

test('Decore: cada objeto se dibuja con su material y no va al despiece', () => {
  for (const t of ['mesa', 'silla', 'banqueta', 'sofa', 'planta', 'cuadro', 'frutero', 'ollas', 'alfombra']) {
    const b = buildModule(mod(t), {});
    assert.ok(b.decors.length > 0 && b.parts.length === 0, t);
    assert.ok(fieldsFor(t).includes('material'), t);
  }
  const cut = computeCutList(buildAll({ ...emptyProject(), modules: [mod('mesa'), mod('sofa')] }, mergeSettings(DEFAULT_SETTINGS)));
  assert.equal(cut.rows.length, 0);
  assert.ok(buildModule(mod('mesa', { material: 'madera_osc' }), {}).decors.every((d) => d.finish === 'madera_osc'));
  assert.ok(buildModule(mod('mesa', { forma: 'redonda' }), {}).decors.some((d) => d.shape === 'cyl'));
});

test('biblioteca Decore con sus grupos', () => {
  const d = LIBRARY.find((l) => l.id === 'decore');
  assert.deepEqual(d.groups.map((g) => g.label), ['Mesas | Sillas', 'Estofados', 'Plantas', 'Cuadros', 'Utensilios', 'Alfombras']);
});

test('material en todos de este tipo', () => {
  const p = applyDecoreMaterialToType({ modules: [mod('silla'), { ...mod('silla'), id: 's2' }, mod('mesa')] }, 'silla', 'negro');
  assert.deepEqual(p.modules.map((m) => m.params.material), ['negro', 'negro', 'madera']);
});
