import { useState } from 'react';
import { moduleTree, moduleRowLabel } from '../domain/moduleList.js';

const Bulb = ({ on }) => (
  <svg width="12" height="14" viewBox="0 0 12 16" aria-hidden="true">
    <path d="M6 1a4.5 4.5 0 0 0-2.6 8.2c.4.3.6.8.6 1.3V12h4v-1.5c0-.5.2-1 .6-1.3A4.5 4.5 0 0 0 6 1z" fill={on ? '#facc15' : '#e5e7eb'} stroke={on ? '#a16207' : '#9ca3af'} />
    <rect x="4" y="13" width="4" height="2" rx=".5" fill={on ? '#a16207' : '#9ca3af'} />
  </svg>
);

// Lista de Módulos (pestaña vertical a la izquierda, como Promob): por plano de inserción;
// clic selecciona (Ctrl+clic suma a la selección de la lista), lamparita = visible / oculto.
export default function ModuleList({ project, selectedId, onSelect, onToggleHidden, onRemove }) {
  const tree = moduleTree(project);
  const [closed, setClosed] = useState({});
  const [multi, setMulti] = useState([]);
  const sel = multi.length ? multi : selectedId ? [selectedId] : [];
  const byId = new Map(project.modules.map((m) => [m.id, m]));
  const click = (e, id) => {
    if (e.ctrlKey || e.metaKey) setMulti((xs) => { const base = xs.length ? xs : selectedId ? [selectedId] : []; return base.includes(id) ? base.filter((x) => x !== id) : [...base, id]; });
    else setMulti([]);
    onSelect(id);
  };
  return (
    <aside className="module-list">
      <div className="ml-head"><b>Lista de Módulos</b> <small>{project.modules.length}</small></div>
      <div className="row-btns ml-actions">
        <button disabled={!sel.length} onClick={() => { onRemove(sel); setMulti([]); }} title="Remover los módulos seleccionados (Ctrl+clic para varios)">Remover</button>
        <button disabled={!sel.length} onClick={() => onToggleHidden(sel)} title="Visibilidad (O)">Visibilidad</button>
      </div>
      <div className="ml-tree">
        {tree.map((pl) => (
          <div key={pl.id} className="ml-plane">
            <button className="ml-plane-btn" onClick={() => setClosed((c) => ({ ...c, [pl.id]: !c[pl.id] }))}>{closed[pl.id] ? '⊞' : '⊟'} {pl.label} <small>({pl.ids.length})</small></button>
            {!closed[pl.id] && pl.ids.map((id) => (
              <div key={id} className={`ml-row${sel.includes(id) ? ' on' : ''}${byId.get(id)?.hidden ? ' off' : ''}`} role="button" tabIndex={0} onClick={(e) => click(e, id)}>
                <button className="ml-bulb" title={byId.get(id)?.hidden ? 'Mostrar' : 'Ocultar'} aria-label="Visibilidad"
                  onClick={(e) => { e.stopPropagation(); onToggleHidden([id]); }}><Bulb on={!byId.get(id)?.hidden} /></button>
                <span>{moduleRowLabel(project, id)}</span>
              </div>
            ))}
          </div>
        ))}
        {!tree.length && <p className="hint">Todavía no hay módulos.</p>}
      </div>
    </aside>
  );
}
