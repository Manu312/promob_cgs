// Historial de deshacer/rehacer, inmutable y sin React.
// `pending` guarda el estado al iniciar una transacción (p. ej. un arrastre):
// mientras está abierta, los cambios reemplazan `present` sin crear pasos y
// `commit` los registra como uno solo.

export const HISTORY_LIMIT = 100;

export function createHistory(present, limit = HISTORY_LIMIT) {
  return { past: [], present, future: [], pending: null, limit };
}

export const canUndo = (h) => h.past.length > 0 || (h.pending !== null && h.pending !== h.present);
export const canRedo = (h) => h.future.length > 0;

const record = (h, prev, next) => ({
  ...h,
  past: [...h.past, prev].slice(-h.limit),
  present: next,
  future: [],
  pending: null,
});

export function push(h, next) {
  if (next === h.present) return h;
  if (h.pending !== null) return { ...h, present: next };
  return record(h, h.present, next);
}

export function begin(h) {
  return h.pending !== null ? h : { ...h, pending: h.present };
}

export function commit(h) {
  if (h.pending === null) return h;
  if (h.pending === h.present) return { ...h, pending: null };
  return record(h, h.pending, h.present);
}

export function undo(h0) {
  const h = commit(h0);
  if (!h.past.length) return h;
  return { ...h, past: h.past.slice(0, -1), present: h.past.at(-1), future: [h.present, ...h.future] };
}

export function redo(h0) {
  const h = commit(h0);
  if (!h.future.length) return h;
  return { ...h, past: [...h.past, h.present].slice(-h.limit), present: h.future[0], future: h.future.slice(1) };
}
