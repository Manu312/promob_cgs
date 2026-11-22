// Barra de la herramienta "Construir paredes": largo y ángulo por teclado (como el
// panel Construcción de paredes de Promob). Enter en Largo pasa a Ángulo; Enter en
// Ángulo confirma el tramo. Vacío = usar lo que marca el mouse.
export default function DrawHud({ draw, len, setLen, ang, setAng, lenRef, angRef, onCommit, onCancel, onClose }) {
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
      <button onClick={onCancel}>Terminar</button>
      <span className="hint-inline">Enter confirma · Shift ortogonal · clic derecho o Esc termina{first ? '' : ' · 90° = dobla a la derecha'}</span>
    </div>
  );
}
