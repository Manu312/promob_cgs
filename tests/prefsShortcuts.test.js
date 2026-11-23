import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCombo, comboOfEvent, comboToEventInit, shortcutsOf, conflicts, remapEvent } from '../src/domain/shortcuts.js';
import { prefsOf, applyPrefsToNewProject, DEFAULT_PREFS } from '../src/domain/prefs.js';
import { emptyProject } from '../src/domain/project.js';

const ev = (key, mods = {}) => ({ key, ctrlKey: false, shiftKey: false, altKey: false, metaKey: false, ...mods });

test('combinaciones: normalizar y leer del teclado', () => {
  assert.equal(normalizeCombo('shift+ctrl+p'), 'Ctrl+Shift+P');
  assert.equal(normalizeCombo('f6'), 'F6');
  assert.equal(comboOfEvent(ev('d', { ctrlKey: true })), 'Ctrl+D');
  assert.equal(comboOfEvent(ev('Shift', { shiftKey: true })), '');
  assert.deepEqual(comboToEventInit('Ctrl+Shift+P'), { key: 'p', ctrlKey: true, metaKey: false, altKey: false, shiftKey: true });
  assert.equal(comboToEventInit('F8').key, 'F8');
});

test('atajos propios: se traducen a la acción; la combinación vieja queda libre', () => {
  const custom = { duplicate: 'Ctrl+J' };
  assert.equal(shortcutsOf(custom).find((s) => s.id === 'duplicate').combo, 'Ctrl+J');
  const r = remapEvent(ev('j', { ctrlKey: true }), custom);
  assert.deepEqual([r.kind, r.init.key, r.init.ctrlKey], ['as', 'd', true]);
  assert.equal(remapEvent(ev('d', { ctrlKey: true }), custom).kind, 'block');
  assert.equal(remapEvent(ev('m'), custom).kind, 'pass');
  assert.equal(remapEvent(ev('j', { ctrlKey: true }), {}).kind, 'pass');
});

test('conflictos: dos acciones con la misma combinación', () => {
  assert.deepEqual(conflicts({}), []);
  assert.deepEqual(conflicts({ pan: 'Z' }), [['pan', 'zoom']]);
});

test('preferencias: valores por defecto, límites y proyecto nuevo', () => {
  assert.deepEqual(prefsOf({}), DEFAULT_PREFS);
  const p = prefsOf({ prefs: { wallT: 5, bg: 'rojo', light: 9 } });
  assert.deepEqual([p.wallT, p.bg, p.light], [50, DEFAULT_PREFS.bg, 3]);
  const n = applyPrefsToNewProject(emptyProject(), { ...DEFAULT_PREFS, wallT: 200, wallH: 2800, floorMat: 'piso-marmol', lowerH: 300 });
  assert.ok(n.room.walls.every((w) => w.t === 200 && w.h0 === 2800));
  assert.equal(n.room.finishes.floor.mat, 'piso-marmol');
  assert.equal(n.room.lowerH, 300);
});
