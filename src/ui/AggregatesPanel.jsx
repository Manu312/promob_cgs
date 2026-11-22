import { useState } from 'react';
import { AGG_TYPES, aggState, aggsApply } from '../domain/aggregates.js';
import { moduleName } from '../domain/modules.js';
import { NumField } from './fields.jsx';

// Herramientas · Agregados (como Promob): tildar el agregado; el (+) muestra sus opciones.
export default function AggregatesPanel({ selected, rules, onAgg }) {
  const [open, setOpen] = useState({});
  if (!selected || !aggsApply(selected)) {
    return (
      <aside className="inspector aggregates">
        <p className="hint">{selected ? 'Este módulo no lleva agregados.' : 'Seleccioná un módulo para ver y cambiar sus agregados.'}</p>
      </aside>
    );
  }
  const st = aggState(selected, rules);
  const groups = [...new Set(AGG_TYPES.map((a) => a.group))];
  return (
    <aside className="inspector aggregates">
      <div className="md-group">{moduleName(selected)}</div>
      {groups.map((g) => (
        <div key={g}>
          <div className="ag-group">{g}</div>
          {AGG_TYPES.filter((a) => a.group === g).map((a) => (
            <div key={a.id} className="ag-row">
              <label className="radio">
                <input type="checkbox" checked={st[a.id].on} onChange={(e) => onAgg(a.id, e.target.checked, a.qty ? st[a.id].qty : null)} /> {a.label}
              </label>
              {a.qty && (
                <button className="ag-plus" aria-label={`Opciones de ${a.label}`} title="Opciones" onClick={() => setOpen((o) => ({ ...o, [a.id]: !o[a.id] }))}>{open[a.id] ? '−' : '+'}</button>
              )}
              {a.qty && open[a.id] && (
                <div className="ag-opts">
                  <NumField label="Cantidad" value={st[a.id].qty} min={a.qty.min} max={a.qty.max} step={1} onChange={(v) => onAgg(a.id, true, v)} />
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
      <p className="hint">Los agregados entran al despiece y al presupuesto. Los de <b>Base</b> reemplazan, para este módulo, la regla de base del proyecto.</p>
    </aside>
  );
}
