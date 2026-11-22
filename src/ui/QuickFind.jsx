import { useEffect, useRef, useState } from 'react';
import { searchLibrary, itemSize } from '../domain/library.js';
import { ModelThumb, Silhouette } from './thumbnails.jsx';
import { IconSearch, IconFolder } from './fields.jsx';

// Localizar Rápido (Ctrl+L), como en Promob: "Buscar por" + Localizar; resultados
// agrupados por ruta de la biblioteca. Clic muestra el ítem en la barra; doble clic lo inserta.
export default function QuickFind({ onShow, onInsert, onClose, thumbCtx }) {
  const [q, setQ] = useState('');
  const [res, setRes] = useState(null); // { groups, ms }
  const [open, setOpen] = useState({});
  const [sel, setSel] = useState(null);
  const inRef = useRef(null);
  useEffect(() => { setTimeout(() => inRef.current?.focus(), 30); }, []);
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  const find = () => {
    const t0 = performance.now();
    const groups = searchLibrary(q);
    setRes({ groups, ms: performance.now() - t0 });
    setOpen(Object.fromEntries(groups.map((g) => [g.key, true])));
  };
  const all = (v) => setOpen(Object.fromEntries((res?.groups || []).map((g) => [g.key, v])));
  const n = res ? res.groups.reduce((a, g) => a + g.items.length, 0) : 0;
  return (
    <div className="menu-backdrop dim" onPointerDown={onClose}>
      <div className="quickfind" role="dialog" aria-label="Localizar Rápido" onPointerDown={(e) => e.stopPropagation()}>
        <div className="qf-head"><b>Localizar Rápido</b><button className="link" onClick={onClose} aria-label="Cerrar">✕</button></div>
        <div className="qf-search">
          <label>Buscar por: <input ref={inRef} value={q} onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') find(); if (e.key === 'Escape') onClose(); }} /></label>
          <button className="active" onClick={find}><IconSearch /> Localizar</button>
        </div>
        <div className="qf-tools">
          <span>Elementos</span>
          <button className="link" onClick={() => all(true)}>Expandir todo</button>
          <button className="link" onClick={() => all(false)}>Contraer todo</button>
        </div>
        <div className="qf-tree">
          {res?.groups.map((g) => (
            <div key={g.key} className="qf-group">
              <button className="qf-folder" onClick={() => setOpen((o) => ({ ...o, [g.key]: !o[g.key] }))}>
                {open[g.key] ? '⊟' : '⊞'} <IconFolder /> {g.key}
              </button>
              {open[g.key] && g.items.map((item) => (
                <div key={item.id} className={`qf-item${sel === item.id ? ' on' : ''}`} role="button" tabIndex={0} title="Clic: mostrar en la barra · Doble clic: insertar"
                  onClick={() => { setSel(item.id); onShow(g.path, item); }} onDoubleClick={() => { onInsert(item); onClose(); }}>
                  {thumbCtx ? <ModelThumb item={item} ctx={thumbCtx} /> : <Silhouette item={item} />}
                  <span>{item.label}</span><small>{itemSize(item)}</small>
                </div>
              ))}
            </div>
          ))}
          {res && !n && <p className="hint">No se encontró nada con "{q}".</p>}
        </div>
        <div className="qf-foot">{res ? `Se encontraron ${n} ítems en ${(res.ms / 1000).toFixed(2)} s.` : 'Escribí parte del nombre, la familia o la medida (p. ej. "cajonero 450").'}</div>
      </div>
    </div>
  );
}
