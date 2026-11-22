import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeSettings, slotIds, ACC_FAMILIES, DEFAULT_ACCESSORIES } from '../src/domain/catalog.js';
import { buildAll, computeCutList, styleHandles } from '../src/domain/cutlist.js';
import { computeBudget } from '../src/domain/budget.js';
import { nestAll } from '../src/domain/nesting.js';
import { normalizeProject, sampleProject } from '../src/domain/project.js';
import { applyModel } from '../src/domain/models.js';

const settings = mergeSettings({});
const budgetOf = (p) => { const cut = computeCutList(buildAll(p, settings)); return { cut, b: computeBudget(cut, nestAll(cut.rows, settings), settings) }; };

test('cada familia de accesorios tiene modelos con precio y uno por defecto', () => {
  const ids = slotIds({}, { fill: true });
  for (const f of ACC_FAMILIES) {
    assert.ok(DEFAULT_ACCESSORIES[f.id].length >= 2, f.id);
    assert.ok(DEFAULT_ACCESSORIES[f.id].some((a) => a.id === ids[f.id]), f.id);
  }
  assert.ok(!settings.hardware.some((h) => ['manija', 'bisagra', 'corredera', 'pata'].includes(h.code)), 'los herrajes con modelo salen de la lista suelta');
});

test('el presupuesto cobra el modelo elegido (Todos) y separa el de un módulo (Selección)', () => {
  let p = normalizeProject(sampleProject());
  p = applyModel(p, 'bisagras', 'bis_comun', 'todos');
  p = applyModel(p, 'bisagras', 'bis_suave', 'seleccion', [p.modules[0].id]);
  const { b } = budgetOf(p);
  const comun = b.lines.find((l) => l.desc === 'Bisagra Cazoleta 35 mm > Común');
  const suave = b.lines.find((l) => l.desc === 'Bisagra Cazoleta 35 mm > Cierre suave');
  assert.ok(comun && comun.unitPrice === 1800 && comun.qty > 0);
  assert.ok(suave && suave.unitPrice === 3500 && suave.qty > 0);
});

test('el tapacanto se cobra con el precio del acabado elegido', () => {
  const p = applyModel(normalizeProject(sampleProject()), 'acabado', 'tc_abs2', 'todos');
  const { b } = budgetOf(p);
  const tc = b.lines.filter((l) => l.group === 'Tapacantos');
  assert.ok(tc.length > 0 && tc.every((l) => l.unitPrice === 900 && l.desc.startsWith('Tapacanto ABS > 2 mm')), tc.map((l) => l.desc).join(' | '));
});

test('el tirador se dibuja según su modelo', () => {
  const v = { decor: 'manija', x: 100, y: 500, z: 560, sx: 12, sy: 128, sz: 25 };
  const [b192] = styleHandles([v], { shape: 'barral', len: 192 });
  assert.deepEqual([b192.sy, b192.y + b192.sy / 2], [192, 564]);
  const [bt] = styleHandles([v], { shape: 'boton' });
  assert.deepEqual([bt.sx, bt.sy, bt.sz], [22, 22, 22]);
  assert.deepEqual(styleHandles([v, { decor: 'mesada' }], { shape: 'sin' }).map((d) => d.decor), ['mesada']);
});
