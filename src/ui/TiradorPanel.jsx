import { moduleName, fieldsFor } from '../domain/modules.js';
import { NumField } from './fields.jsx';

const PRESETS = [['top', 'Arriba'], ['middle', 'Medio'], ['bottom', 'Abajo'], ['custom', 'Personalizada'], ['none', 'Sin tirador']];

// Mini diagrama de una puerta con el tirador en esa posición (como los botones de Promob).
function PresetIcon({ pos, orient }) {
  const y = { top: 8, middle: 26, bottom: 44, custom: 16 }[pos];
  const horiz = orient === 'horizontal';
  return (
    <svg width="34" height="62" viewBox="0 0 34 62" aria-hidden="true">
      <rect x="2" y="2" width="30" height="58" rx="1.5" fill="#fbcfe8" stroke="#64748b" />
      {pos !== 'none' && (horiz ? <rect x="10" y={y + 4} width="16" height="3" fill="#334155" /> : <rect x="24" y={y} width="3" height="14" fill="#334155" />)}
      {pos === 'custom' && <path d="M8 2 V14" stroke="#2563eb" strokeDasharray="2 2" />}
    </svg>
  );
}

// Herramientas · Posición del Tirador: posición (arriba / medio / abajo / personalizada en mm),
// orientación, al módulo seleccionado o a todos los del ambiente.
export default function TiradorPanel({ selected, onSet, onSetAll }) {
  const ok = selected && fieldsFor(selected.type).includes('handlePos');
  if (!ok) {
    return <aside className="inspector tirador"><p className="hint">{selected ? 'Este módulo no lleva tiradores.' : 'Seleccioná un módulo para ubicar sus tiradores.'}</p></aside>;
  }
  const p = selected.params;
  const orient = p.handleOrient || 'auto';
  return (
    <aside className="inspector tirador">
      <div className="md-group">{moduleName(selected)}</div>
      <div className="tp-presets">
        {PRESETS.map(([k, label]) => (
          <button key={k} className={`tp-preset${p.handlePos === k ? ' on' : ''}`} onClick={() => onSet({ handlePos: k })} title={label}>
            <PresetIcon pos={k} orient={orient} /><span>{label}</span>
          </button>
        ))}
      </div>
      {p.handlePos === 'custom' && (
        <NumField label="Desde el borde de arriba" unit="mm" value={p.handleOffset ?? 40} min={0} max={2000} step={5} onChange={(v) => onSet({ handleOffset: v })} />
      )}
      <div className="tp-orient">
        <span>Orientación:</span>
        {[['auto', 'Automática'], ['vertical', 'Vertical'], ['horizontal', 'Horizontal']].map(([k, l]) => (
          <label key={k} className="radio"><input type="radio" name="tp-orient" checked={orient === k} onChange={() => onSet({ handleOrient: k })} /> {l}</label>
        ))}
      </div>
      <button onClick={() => onSetAll({ handlePos: p.handlePos, handleOffset: p.handleOffset ?? 40, handleOrient: orient })}>Aplicar a todos los módulos</button>
      <p className="hint">Automática: vertical en puertas, horizontal en cajones. El modelo del tirador se elige en Herramientas · Modelos → Accesorios.</p>
    </aside>
  );
}
