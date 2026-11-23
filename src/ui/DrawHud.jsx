// Barra de la herramienta "Construir paredes": largo y ángulo por teclado (como el
// panel Construcción de paredes de Promob). Enter en Largo pasa a Ángulo; Enter en
// Ángulo confirma el tramo. Vacío = usar lo que marca el mouse.
import { useState } from 'react';

export default function DrawHud({ draw, len, setLen, ang, setAng, lenRef, angRef, onCommit, onCancel, onClose, lock, onLock, walls = [], onReference }) {
  const [ref, setRef] = useState({ wallId: '', dist: '' });
  const first = draw.fromNodeId == null;
  const started = draw.start != null || draw.fromNodeId != null;
  const key = (next) => (e) => {
    e.stopPropagation();
    if (e.key === 'Escape') onCancel();
    else if (e.key === 'Enter') next();
  };
  if (draw.confirmClose) {
    return (
      <div className="draw-hud">
        <b>¿Cerrar el ambiente?</b>
        <button className="active" onClick={() => onClose(true)}>Sí</button>
        <button onClick={() => onClose(false)}>No</button>
      </div>
    );
  }
  return (
    <div className="draw-hud">
      <b>Construir paredes</b>
      {!started && <span className="hint-inline">Hacé clic en el piso para empezar (o en una esquina libre para continuarla).</span>}
      <label>Largo <input ref={lenRef} value={len} onChange={(e) => setLen(e.target.value)} onKeyDown={key(() => angRef.current?.focus())} inputMode="decimal" /> mm</label>
      <label>Ángulo {first ? 'absoluto' : 'relativo'} <input ref={angRef} value={ang} onChange={(e) => setAng(e.target.value)} onKeyDown={key(onCommit)} inputMode="decimal" />°</label>
      {onLock && <label className="radio"><input type="checkbox" checked={!!lock} onChange={(e) => onLock(e.target.checked)} /> Bloquear ángulo</label>}
      {!started && onReference && walls.length > 0 && (
        <span className="dh-ref">
          Referencia: <select value={ref.wallId} onChange={(e) => setRef({ ...ref, wallId: e.target.value })}>
            <option value="">pared…</option>{walls.map((w) => <option key={w.id} value={w.id}>P{w.i + 1}</option>)}
          </select>
          <input value={ref.dist} placeholder="distancia" onChange={(e) => setRef({ ...ref, dist: e.target.value })} onKeyDown={(e) => e.stopPropagation()} inputMode="decimal" /> mm
          <button disabled={!ref.wallId || !(+ref.dist >= 0) || ref.dist === ''} onClick={() => onReference(ref.wallId, +ref.dist)}>Empezar ahí</button>
        </span>
      )}
      <button onClick={onCancel}>Terminar</button>
      <span className="hint-inline">Enter confirma · Shift ortogonal · clic derecho o Esc termina{first ? '' : ' · 90° = dobla a la derecha'}</span>
    </div>
  );
}
