import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHistory, push, undo, redo, begin, commit, canUndo, canRedo, HISTORY_LIMIT } from '../src/domain/history.js';

const apply = (h, ...states) => states.reduce((acc, s) => push(acc, s), h);

test('historial nuevo: sin deshacer ni rehacer', () => {
  const h = createHistory('a');
  assert.equal(h.present, 'a');
  assert.equal(canUndo(h), false);
  assert.equal(canRedo(h), false);
});

test('push registra pasos y undo/redo los recorre en orden', () => {
  let h = apply(createHistory('a'), 'b', 'c');
  assert.equal(h.present, 'c');
  h = undo(h); assert.equal(h.present, 'b');
  h = undo(h); assert.equal(h.present, 'a');
  assert.equal(canUndo(h), false);
  h = redo(h); assert.equal(h.present, 'b');
  h = redo(h); assert.equal(h.present, 'c');
  assert.equal(canRedo(h), false);
});

test('undo/redo sin pasos devuelve el mismo historial', () => {
  const h = createHistory('a');
  assert.equal(undo(h), h);
  assert.equal(redo(h), h);
});

test('push con el mismo estado no crea un paso', () => {
  const s = { x: 1 };
  const h = push(createHistory(s), s);
  assert.equal(canUndo(h), false);
});

test('un cambio después de deshacer vacía rehacer', () => {
  let h = apply(createHistory('a'), 'b', 'c');
  h = undo(h);
  h = push(h, 'd');
  assert.equal(canRedo(h), false);
  assert.equal(h.present, 'd');
  assert.equal(undo(h).present, 'b');
});

test('al superar el límite se descartan los pasos más viejos', () => {
  let h = createHistory(0, 3);
  for (let i = 1; i <= 5; i++) h = push(h, i);
  assert.equal(h.past.length, 3);
  h = undo(undo(undo(h)));
  assert.equal(h.present, 2);
  assert.equal(canUndo(h), false);
});

test('límite por defecto de 100 pasos', () => {
  assert.equal(HISTORY_LIMIT, 100);
  let h = createHistory(0);
  for (let i = 1; i <= 150; i++) h = push(h, i);
  assert.equal(h.past.length, 100);
});

test('transacción: un arrastre con muchos cambios es un solo paso', () => {
  let h = begin(createHistory('inicio'));
  h = apply(h, 'm1', 'm2', 'm3');
  assert.equal(h.present, 'm3');
  assert.equal(h.past.length, 0, 'durante el arrastre no se registran pasos');
  h = commit(h);
  assert.equal(h.past.length, 1);
  assert.equal(undo(h).present, 'inicio');
});

test('transacción sin cambios no crea paso', () => {
  const h = commit(begin(createHistory('a')));
  assert.equal(canUndo(h), false);
});

test('transacción después de deshacer vacía rehacer al confirmar', () => {
  let h = undo(apply(createHistory('a'), 'b'));
  h = commit(push(begin(h), 'x'));
  assert.equal(canRedo(h), false);
  assert.equal(undo(h).present, 'a');
});

test('commit sin begin no cambia nada', () => {
  const h = push(createHistory('a'), 'b');
  assert.equal(commit(h), h);
});

test('undo durante una transacción abierta la confirma y deshace el arrastre entero', () => {
  let h = apply(begin(push(createHistory('a'), 'b')), 'm1', 'm2');
  h = undo(h);
  assert.equal(h.present, 'b');
  assert.equal(h.pending, null);
  assert.equal(redo(h).present, 'm2');
});
