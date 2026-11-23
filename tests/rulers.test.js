import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_RULER_GROUPS, rulerGroups, wallRulers, snapToRulers, addRulerGroup, updateRulerGroup, removeRulerGroup, addRuler, updateRuler, removeRuler } from '../src/domain/rulers.js';

test('grupos de reglas por defecto y los guardados', () => {
  assert.equal(rulerGroups(null), DEFAULT_RULER_GROUPS);
  assert.equal(rulerGroups([{ id: 'x', rulers: [] }])[0].id, 'x');
  assert.equal(wallRulers({ rulerGroup: 'cocina' }, DEFAULT_RULER_GROUPS).rulers[1].value, 870);
  assert.equal(wallRulers({}, DEFAULT_RULER_GROUPS), null);
});

test('atraer: el borde de abajo o de arriba se pega a la regla dentro del gap', () => {
  const g = DEFAULT_RULER_GROUPS[0];
  assert.equal(snapToRulers(1430, 700, g), 1450, 'abajo a 1450');
  assert.equal(snapToRulers(1470, 700, g), 1450, 'abajo a 1450 (de arriba)');
  assert.equal(snapToRulers(1500, 640, g), 1510, 'arriba a 2150');
  assert.equal(snapToRulers(1200, 100, g), 1200, 'lejos de todas');
  assert.equal(snapToRulers(1430, 700, { ...g, attract: false }), 1430);
});

test('editar grupos y reglas', () => {
  let gs = addRulerGroup([], 'Living');
  const id = gs[0].id;
  gs = addRuler(gs, id, 450, 'Rack');
  gs = updateRuler(gs, id, 0, { value: 500 });
  gs = updateRulerGroup(gs, id, { gap: 50 });
  assert.deepEqual([gs[0].name, gs[0].gap, gs[0].rulers[0].value], ['Living', 50, 500]);
  assert.equal(removeRuler(gs, id, 0)[0].rulers.length, 0);
  assert.equal(removeRulerGroup(gs, id).length, 0);
});
