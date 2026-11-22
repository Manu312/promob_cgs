import { useState } from 'react';
import { AUTO_CATEGORIES } from '../domain/autoInsert.js';

// Inserción Automática (pestaña vertical a la izquierda, como Promob, foto 08).
// Inserción: lo tildado se agrega a cada módulo que se inserte. Ambiente: Insertar / Remover
// sobre los módulos que ya están (o solo en el seleccionado).
export default function AutoInsertPanel({ autoInsert = {}, onAutoInsert, onAmbiente, hasSelection }) {
  const [tab, setTab] = useState('insercion');
  const [amb, setAmb] = useState({}); // { [cat]: [ids] } tildados en Ambiente
  const [onlySel, setOnlySel] = useState(false);
  const [closed, setClosed] = useState({});
  const ins = tab === 'insercion';
  const checked = (cat, id) => (ins ? autoInsert[cat] : amb[cat])?.includes(id) || false;
  const toggle = (cat, id, on) => {
    const cur = (ins ? autoInsert[cat] : amb[cat]) || [];
    const next = on ? [...cur, id] : cur.filter((x) => x !== id);
    if (ins) onAutoInsert({ ...autoInsert, [cat]: next }); else setAmb((a) => ({ ...a, [cat]: next }));
  };
  const run = (on) => { for (const c of AUTO_CATEGORIES) if (amb[c.id]?.length) onAmbiente(c.id, amb[c.id], on, onlySel); };
  const buttons = !ins && (
    <div className="row-btns ai-btns">
      <button className="active" onClick={() => run(true)}>⇨ Insertar</button>
      <button className="danger" onClick={() => run(false)}>✕ Remover</button>
    </div>
  );
  return (
    <aside className="module-list auto-insert">
      <div className="ml-head"><b>Inserción Automática</b></div>
      <div className="mv-tabs">
        <button className={ins ? 'on' : ''} onClick={() => setTab('insercion')}>Inserción</button>
        <button className={!ins ? 'on' : ''} onClick={() => setTab('ambiente')}>Ambiente</button>
      </div>
      <p className="hint">{ins ? 'Lo tildado se agrega solo a cada módulo que insertes de esa categoría.' : 'Tildá y usá Insertar o Remover sobre los módulos que ya están.'}</p>
      {buttons}
      {AUTO_CATEGORIES.map((c) => (
        <div key={c.id} className="ai-cat">
          <button className="ml-plane-btn" onClick={() => setClosed((o) => ({ ...o, [c.id]: !o[c.id] }))}>{closed[c.id] ? '⊞' : '⊟'} {c.id}</button>
          {!closed[c.id] && c.items.map((i) => (
            <label key={i.id} className="radio ai-item">
              <input type="checkbox" checked={checked(c.id, i.id)} onChange={(e) => toggle(c.id, i.id, e.target.checked)} /> {i.label}
            </label>
          ))}
        </div>
      ))}
      {!ins && (
        <label className="radio ai-item ai-only">
          <input type="checkbox" checked={onlySel} disabled={!hasSelection} onChange={(e) => setOnlySel(e.target.checked)} /> Aplicar solamente en los ítems seleccionados
        </label>
      )}
      {buttons}
    </aside>
  );
}
