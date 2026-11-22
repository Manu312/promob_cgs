import { useState } from 'react';
import { frontsOf } from '../domain/fronts.js';
import { moduleName } from '../domain/modules.js';

// Diagrama del frente: puertas (rosa) y cajones (celeste), con la bisagra marcada. Clic elige
// el frente; doble clic lo abre o lo cierra.
function FrontDiagram({ fronts, W, H, open, sel, onSel, onToggle }) {
  const k = 240 / Math.max(W, H);
  return (
    <svg className="ap-diagram" viewBox={`-4 -4 ${W * k + 8} ${H * k + 8}`} width={W * k + 8} height={H * k + 8}>
      <rect x="0" y="0" width={W * k} height={H * k} fill="#f8fafc" stroke="#94a3b8" />
      {fronts.map((f) => {
        const x = f.x * k, y = (H - f.y - f.h) * k, w = f.w * k, h = f.h * k;
        const isOpen = open?.[f.k];
        return (
          <g key={f.k} className="ap-front" onClick={() => onSel(f.k)} onDoubleClick={() => onToggle(f.k)}>
            <rect x={x} y={y} width={w} height={h} fill={f.kind === 'door' ? '#fbcfe8' : '#bfdbfe'} fillOpacity={isOpen ? 0.35 : 1}
              stroke={sel === f.k ? '#2563eb' : '#64748b'} strokeWidth={sel === f.k ? 2.5 : 1} strokeDasharray={isOpen ? '4 3' : undefined} />
            {f.kind === 'door' && <line x1={f.hinge === 'der' ? x + w - 2 : x + 2} x2={f.hinge === 'der' ? x + w - 2 : x + 2} y1={y + 3} y2={y + h - 3} stroke="#be185d" strokeWidth="3" />}
            <text x={x + w / 2} y={y + h / 2 + 4} textAnchor="middle" fontSize="10" fill="#334155">{f.kind === 'door' ? 'Puerta' : 'Cajón'}</text>
          </g>
        );
      })}
    </svg>
  );
}

// Herramientas · Aperturas (como Promob): abrir y cerrar puertas y cajones, en cascada,
// e invertir el lado de la bisagra de la puerta elegida.
export default function AperturasPanel({ selected, built, state, onState, onAll, onInvert }) {
  const [sel, setSel] = useState(null);
  const fronts = frontsOf(built);
  const st = (selected && state[selected.id]) || {};
  const setOpen = (open, cascade = false) => onState(selected.id, { open, cascade });
  const allOpen = Object.fromEntries(fronts.map((f) => [f.k, true]));
  const selFront = fronts.find((f) => f.k === sel);
  const btn = (label, onClick, disabled, title) => <button key={label} onClick={onClick} disabled={disabled} title={title}>{label}</button>;
  return (
    <aside className="inspector aperturas">
      <div className="row-btns ap-tools">
        {btn('Abrir', () => setOpen(allOpen), !selected || !fronts.length, 'Abre puertas y cajones del módulo seleccionado')}
        {btn('Cerrar', () => setOpen({}), !selected, 'Cierra el módulo seleccionado')}
        {btn('Abrir todos', () => onAll(true), false, 'Abre todos los módulos del ambiente')}
        {btn('Cerrar todos', () => onAll(false), false, 'Cierra todos los módulos del ambiente')}
        {btn('Abrir cascada', () => setOpen({}, true), !selected || !fronts.some((f) => f.kind === 'drawer'), 'Abre los cajones escalonados')}
        {btn('Invertir seleccionado', () => onInvert(sel), !selFront || selFront.kind !== 'door', 'Cambia el lado de la bisagra de la puerta elegida en el diagrama')}
      </div>
      {selected ? (
        <>
          <div className="md-group">{moduleName(selected)}</div>
          {fronts.length ? (
            <FrontDiagram fronts={fronts} W={selected.params.width} H={selected.params.height} open={st.cascade ? Object.fromEntries(fronts.filter((f) => f.kind === 'drawer').map((f) => [f.k, true])) : st.open}
              sel={sel} onSel={setSel} onToggle={(k) => setOpen({ ...(st.open || {}), [k]: !st.open?.[k] })} />
          ) : <p className="hint">Este módulo no tiene puertas batientes ni cajones.</p>}
          <p className="hint">Clic en el diagrama elige el frente; doble clic lo abre o lo cierra (también con doble clic sobre el mueble en el 3D). La línea fuerte marca la bisagra.</p>
        </>
      ) : <p className="hint">Seleccioná un módulo, o usá Abrir todos / Cerrar todos.</p>}
    </aside>
  );
}
