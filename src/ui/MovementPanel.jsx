import { useState } from 'react';
import { MOVE_AXES } from '../domain/movement.js';
import { NumField } from './fields.jsx';

// Botonera de la columna derecha, como el panel "Herramientas" de Promob.
// Modelos llega con la Fase 4; Serie quedó fuera de alcance.
export function ToolsNav({ tool, onTool }) {
  const item = (k, label, icon, disabled) => (
    <button key={k} className={`tools-item${tool === k ? ' on' : ''}`} disabled={disabled} onClick={() => onTool(k)}
      title={disabled ? 'Llega con la Fase 4 (materiales y estilos)' : undefined}>
      <span className="tools-ico">{icon}</span>{label}
    </button>
  );
  return (
    <nav className="tools-nav">
      <div className="tools-title">Herramientas · {{ movimiento: 'Movimiento', modelos: 'Modelos', agregados: 'Agregados' }[tool] || 'Propiedades'}</div>
      {item('agregados', 'Agregados', '⊕')}
      {item('modelos', 'Modelos', '▦')}
      {item('movimiento', 'Movimiento', '✥')}
      {item('propiedades', 'Propiedades', '☰')}
    </nav>
  );
}

// Panel Movimiento: pestañas Desplazamiento / Rotación; por eje, − a la izquierda y + a la
// derecha (rojo ancho, verde profundidad, azul alto); paso numérico y Posición relativa.
export function MovementPanel({ label, ui, setUi, onNudge, onRotate }) {
  const [tab, setTab] = useState('desp');
  const set = (patch) => setUi((u) => ({ ...u, ...patch }));
  const desp = tab === 'desp';
  const step = desp ? ui.moveStep ?? 10 : ui.rotStep ?? 90;
  const rows = desp ? MOVE_AXES : MOVE_AXES.filter((a) => a.axis === 'h');
  const act = (axis, sign) => (desp ? onNudge(axis, sign) : onRotate(sign));
  const arrow = (a, sign) => (
    <button key={a.axis + sign} className="mv-arrow" style={{ color: a.color }} disabled={!label}
      aria-label={`${a.label} ${sign > 0 ? '+' : '−'}`}
      title={desp ? `${sign > 0 ? 'Sumar' : 'Restar'} ${step} mm en ${a.label.toLowerCase()}` : `Girar ${sign > 0 ? '+' : '−'}${step}° sobre el eje vertical`}
      onClick={() => act(a.axis, sign)}>
      {sign > 0 ? '→+' : '−←'}
    </button>
  );
  return (
    <aside className="inspector movement">
      <div className="mv-tabs">
        <button className={desp ? 'on' : ''} onClick={() => setTab('desp')}>Desplazamiento</button>
        <button className={!desp ? 'on' : ''} onClick={() => setTab('rot')}>Rotación</button>
      </div>
      <div className="mv-grid">
        <div className="mv-col">{rows.map((a) => arrow(a, -1))}</div>
        <div className="mv-step">
          <NumField compact value={step} min={desp ? 1 : 0.5} max={desp ? 5000 : 360} step={desp ? 1 : 15} unit={desp ? 'mm' : '°'}
            onChange={(v) => set(desp ? { moveStep: v } : { rotStep: v })} />
        </div>
        <div className="mv-col">{rows.map((a) => arrow(a, 1))}</div>
      </div>
      {desp && (
        <label className="radio mv-rel"><input type="checkbox" checked={ui.relative !== false} onChange={(e) => set({ relative: e.target.checked })} /> Posición relativa</label>
      )}
      <p className="hint">{label ? <>Moviendo: <b>{label}</b></> : 'Seleccioná un módulo para moverlo.'}</p>
      <p className="hint">{desp
        ? 'Rojo: ancho · Verde: profundidad · Azul: alto. Con Posición relativa los ejes siguen el giro del módulo; sin ella, los del ambiente. Con Colisión activa no atraviesa paredes ni módulos.'
        : 'Gira sobre el eje vertical, alrededor del centro del módulo, de a cualquier ángulo. El imán solo actúa a 0, 90, 180 y 270°.'}</p>
      <p className="hint">Atajos: <b>E</b> Propiedades · <b>Ctrl+Shift+M</b> Movimiento · <b>X</b>/<b>Y</b> trabar eje al arrastrar · <b>RePág</b>/<b>AvPág</b> alto · <b>Ctrl+D</b> duplicar · <b>D</b> cota.</p>
    </aside>
  );
}
