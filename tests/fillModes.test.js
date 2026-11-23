import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FILL_MODES, fillMode, nextFillMode, DEFAULT_FILL } from '../src/domain/fillModes.js';

test('los 9 modos de relleno de Promob, Texturas por defecto', () => {
  assert.deepEqual(FILL_MODES.map((m) => m.label), ['Texturas con líneas', 'Texturas', 'Relleno con líneas', 'Relleno', 'Oculto', 'Oculto B/N', 'Sin relleno', 'Caja de contorno', 'Presentación']);
  assert.equal(fillMode(undefined).id, DEFAULT_FILL);
  assert.equal(fillMode('oculto-bn').bg, '#000000');
});

test('F10 pasa al siguiente y da la vuelta', () => {
  assert.equal(nextFillMode('texturas'), 'relleno-lineas');
  assert.equal(nextFillMode('presentacion'), 'texturas-lineas');
});
