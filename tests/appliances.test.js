import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MODULE_TYPES, buildModule, fieldsFor } from '../src/domain/modules.js';
import { burnerSpots } from '../src/domain/appliances.js';
import { findItem, itemParams } from '../src/domain/library.js';
import { mergeSettings } from '../src/domain/catalog.js';
import { buildAll, computeCutList } from '../src/domain/cutlist.js';
import { computeBudget } from '../src/domain/budget.js';
import { nestAll } from '../src/domain/nesting.js';
import { normalizeProject, sampleProject } from '../src/domain/project.js';

const APARATOS = Object.entries(MODULE_TYPES).filter(([, d]) => d.kind === 'aparato').map(([k]) => k);
const build = (type, params = {}) => buildModule({ type, params: { ...MODULE_TYPES[type].defaults, ...params } }, { t: 18, tf: 18 });

test('los aparatos se dibujan con piezas decorativas y no van al despiece', () => {
  assert.ok(APARATOS.length >= 4);
  for (const t of APARATOS) {
    const b = build(t);
    assert.equal(b.parts.length, 0, t);
    assert.ok(b.decors.length > 3, t);
    for (const d of b.decors) assert.ok(d.sx > 0 && d.sy > 0 && d.sz > 0 && d.finish, `${t}: ${JSON.stringify(d)}`);
  }
});

test('hornallas: 4, 5 (con una grande al centro) y 6; una perilla por hornalla + horno', () => {
  assert.deepEqual([4, 5, 6].map((n) => burnerSpots(n).length), [4, 5, 6]);
  assert.ok(burnerSpots(5).some(([fx, fz]) => fx === 0.5 && fz === 0.5));
  const knobs = (b) => b.decors.filter((d) => d.shape === 'cyl' && d.axis === 'z').length;
  assert.equal(knobs(build('cocina')), 5);
  assert.equal(knobs(build('cocina', { hornallas: 5 })), 6);
});

test('medidas de fichas públicas en el catálogo', () => {
  assert.deepEqual(['width', 'height', 'depth'].map((k) => itemParams(findItem('ele-cocina-76').item)[k]), [765, 905, 675]);
  assert.deepEqual([MODULE_TYPES.anafe.cut.w, MODULE_TYPES.anafe.cut.d], [560, 490]);
  assert.deepEqual(['width', 'height', 'depth'].map((k) => MODULE_TYPES.horno.defaults[k]), [595, 595, 575]);
  assert.equal(MODULE_TYPES.anafe.rest, true, 'el anafe se apoya sobre la mesada');
  assert.ok(fieldsFor('cocina').includes('hornallas'));
});

test('con precio, el aparato va al presupuesto (Electrodomésticos); sin precio, no', () => {
  const settings = mergeSettings({});
  const p = normalizeProject(sampleProject());
  p.modules = [
    { id: 'c1', type: 'cocina', name: 'Cocina 56 cm', params: { ...MODULE_TYPES.cocina.defaults, price: 450000 }, x: 0, z: 0, y: 0, rot: 0 },
    { id: 'c2', type: 'campana', params: { ...MODULE_TYPES.campana.defaults }, x: 0, z: 0, y: 1650, rot: 0 },
  ];
  const cut = computeCutList(buildAll(p, settings));
  assert.equal(cut.rows.length, 0);
  const b = computeBudget(cut, nestAll(cut.rows, settings), settings);
  const e = b.lines.filter((l) => l.group === 'Electrodomésticos');
  assert.deepEqual(e.map((l) => [l.desc, l.qty, l.total]), [['Cocina 56 cm', 1, 450000]]);
});
