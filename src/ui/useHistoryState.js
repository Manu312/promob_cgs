import { useCallback, useEffect, useMemo, useState } from 'react';
import { createHistory, push, undo, redo, begin, commit, canUndo, canRedo } from '../domain/history.js';

// Estado persistido en localStorage con deshacer/rehacer. Solo se guarda `present`.
export function useHistoryState(key, init, migrate = (x) => x) {
  const [h, setH] = useState(() => {
    let v;
    try { const s = localStorage.getItem(key); if (s) v = migrate(JSON.parse(s)); } catch { /* sin storage o dato inválido */ }
    return createHistory(v ?? (typeof init === 'function' ? init() : init));
  });
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(h.present)); } catch { /* sin storage */ } }, [key, h.present]);

  const set = useCallback((u) => setH((x) => push(x, typeof u === 'function' ? u(x.present) : u)), []);
  const actions = useMemo(() => ({
    undo: () => setH(undo),
    redo: () => setH(redo),
    begin: () => setH(begin),
    commit: () => setH(commit),
  }), []);

  return [h.present, set, { ...actions, canUndo: canUndo(h), canRedo: canRedo(h) }];
}
