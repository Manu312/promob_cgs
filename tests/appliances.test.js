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
    assert.ok(b.decors.length > (['Decore', 'Lumen'].includes(MODULE_TYPES[t].cat) ? 0 : 3), t); // un cuadro o una alfombra tienen pocas piezas
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

// Refrigeración, microondas y lavado (#92)
test('heladeras: simple, no frost (dos puertas) y side by side (dos puertas verticales)', () => {
  const doors = (tipo) => build('heladera', { tipo }).decors.filter((d) => d.sz === 40 && d.finish !== 'cromo').length;
  assert.equal(doors('simple'), 1);
  assert.equal(doors('nofrost'), 2);
  assert.equal(doors('side'), 2);
  assert.deepEqual(['width', 'height', 'depth'].map((k) => itemParams(findItem('ele-heladera-side').item)[k]), [912, 1780, 716]);
});

test('lavarropas frontal con ojo de buey; superior con tapa arriba', () => {
  assert.ok(build('lavarropas').decors.some((d) => d.shape === 'cyl' && d.finish === 'vidrio'));
  const sup = build('lavarropas', { carga: 'superior' });
  assert.ok(sup.decors.some((d) => d.y >= MODULE_TYPES.lavarropas.defaults.height));
  assert.ok(!sup.decors.some((d) => d.shape === 'cyl' && d.finish === 'vidrio'));
});

test('microondas de apoyo se apoya; el empotrable va alto', () => {
  assert.equal(MODULE_TYPES.microondas.rest, true);
  assert.equal(findItem('ele-micro-emp').item.y, 1450);
  assert.deepEqual(['width', 'height', 'depth'].map((k) => MODULE_TYPES.lavavajillas.defaults[k]), [600, 850, 600]);
});

// Sanitarios de baño (#94)
test('sanitarios: inodoro con mochila, bidet, lavatorio con pie hasta el piso o de colgar', () => {
  const ino = build('inodoro');
  assert.ok(ino.decors.some((d) => d.finish === 'ceramica' && d.y >= 400), 'mochila');
  const pie = buildModule({ type: 'lavatorio', params: { ...MODULE_TYPES.lavatorio.defaults }, y: 680 }, {});
  assert.ok(pie.decors.some((d) => d.y === -680), 'el pie llega al piso');
  const col = buildModule({ type: 'lavatorio', params: { ...MODULE_TYPES.lavatorio.defaults, montaje: 'colgar' }, y: 700 }, {});
  assert.ok(!col.decors.some((d) => d.y < 0));
  assert.deepEqual(['width', 'height', 'depth'].map((k) => MODULE_TYPES.bidet.defaults[k]), [352, 400, 500]);
  assert.equal(findItem('ban-lavatorio-colgar').path[1], 'sanitarios');
});

test('cada aparato tiene solo sus opciones: tipo (heladera), carga (lavarropas), caño (grifería)', () => {
  assert.ok(fieldsFor('heladera').includes('tipo'));
  assert.ok(fieldsFor('lavarropas').includes('carga') && !fieldsFor('lavarropas').includes('tipo'));
  assert.ok(fieldsFor('griferia').includes('canio') && !fieldsFor('griferia').includes('tipo'));
  const ext = build('griferia', { canio: 'extraible' }), alto = build('griferia');
  const head = (b) => b.decors.some((d) => d.shape === 'cyl' && d.sy === 100); // cabezal grueso de 100 mm
  assert.ok(head(ext), 'cabezal del extraíble');
  assert.ok(!head(alto));
});
