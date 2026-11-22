import { useEffect, useState } from 'react';
import { SLOTS, libraryTree, pathLabel } from '../domain/catalog.js';
import { effectiveModel } from '../domain/models.js';
import { moduleName } from '../domain/modules.js';

export function Swatch({ m }) {
  if (!m) return null;
  const style = m.kind === 'piedra'
    ? { background: `radial-gradient(circle at 30% 30%, ${m.grain} 1px, transparent 1.5px) 0 0 / 5px 5px, ${m.color}` }
    : { background: m.wood ? `repeating-linear-gradient(90deg, ${m.color}, ${m.color} 3px, rgba(0,0,0,.12) 4px)` : m.color };
  return <span className="swatch" style={style} />;
}

// Menú en cascada por la biblioteca (Mostrar todos… · ‹ carpetas · materiales). Como el panel
// está pegado al borde derecho, los submenús se abren hacia la izquierda (igual que en Promob).
// Posición fija (calculada desde el botón) para que el panel con scroll no recorte los menús.
const anchorBelow = (el) => { const r = el.getBoundingClientRect(); return { right: window.innerWidth - r.right, top: r.bottom }; };
const anchorLeftOf = (el) => { const r = el.getBoundingClientRect(); return { right: window.innerWidth - r.left, top: r.top - 4 }; };

function CascadeMenu({ node, onPick, onShowAll, extra, anchor, depth = 0 }) {
  const [open, setOpen] = useState(null); // { name, anchor }
  const openFolder = (e, name) => setOpen({ name, anchor: anchorLeftOf(e.currentTarget) });
  return (
    <div className={`cascade${depth ? ' sub' : ''}`} style={{ right: anchor.right, top: anchor.top }} onPointerDown={(e) => e.stopPropagation()}>
      {depth === 0 && <button className="cm-item" onClick={onShowAll}>Mostrar todos…</button>}
      {depth === 0 && extra}
      {node.folders.map((f) => (
        <div key={f.name} className="cm-folder">
          <button className={`cm-item${open?.name === f.name ? ' on' : ''}`} onMouseEnter={(e) => openFolder(e, f.name)} onClick={(e) => openFolder(e, f.name)}><span className="cm-arrow">‹</span>{f.name}</button>
          {open?.name === f.name && <CascadeMenu node={f} onPick={onPick} anchor={open.anchor} depth={depth + 1} />}
        </div>
      ))}
      {node.items.map((m) => (
        <button key={m.id} className="cm-item" onMouseEnter={() => setOpen(null)} onClick={() => onPick(m.id)}>
          <Swatch m={m} /> {m.path?.at(-1) || m.name}
        </button>
      ))}
    </div>
  );
}

// "Mostrar todos…": la lista completa con búsqueda; elegir y Aplicar.
function ShowAll({ materials, current, onApply, onClose }) {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(current);
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const list = materials.filter((m) => norm(pathLabel(m) + ' ' + m.name).includes(norm(q)));
  return (
    <div className="menu-backdrop dim" onPointerDown={onClose}>
      <div className="quickfind showall" role="dialog" aria-label="Mostrar todos" onPointerDown={(e) => e.stopPropagation()}>
        <div className="qf-head"><b>Modelos</b><button className="link" onClick={onClose} aria-label="Cerrar">✕</button></div>
        <div className="qf-search"><label>Buscar: <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.stopPropagation()} /></label></div>
        <div className="qf-tree">
          {list.map((m) => (
            <div key={m.id} className={`qf-item${sel === m.id ? ' on' : ''}`} role="button" tabIndex={0} onClick={() => setSel(m.id)} onDoubleClick={() => onApply(m.id)}>
              <Swatch m={m} /><span>{pathLabel(m)}</span>
              <small>{m.kind === 'piedra' ? `$ ${m.priceM2.toLocaleString('es-AR')}/m²` : `${m.t} mm`}</small>
            </div>
          ))}
        </div>
        <div className="qf-foot row-btns"><button className="active" disabled={!sel} onClick={() => onApply(sel)}>Aplicar</button><button onClick={onClose}>Cancelar</button></div>
      </div>
    </div>
  );
}

// Herramientas · Modelos: ámbito Todos / Selección y una fila por tipo de pieza.
export default function ModelsPanel({ project, settings, selected, onApply, header }) {
  const [scope, setScope] = useState('todos');
  const [menu, setMenu] = useState(null); // slot con el menú abierto
  const [menuAt, setMenuAt] = useState(null);
  const [all, setAll] = useState(null); // slot con "Mostrar todos" abierto
  const sel = scope === 'seleccion' ? selected : null;
  useEffect(() => { if (!selected && scope === 'seleccion') setScope('todos'); }, [selected, scope]);
  useEffect(() => {
    if (!menu) return undefined;
    const close = () => setMenu(null);
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [menu]);
  const byId = new Map(settings.materials.map((m) => [m.id, m]));
  const apply = (slot, id) => { onApply(slot, id, scope); setMenu(null); setAll(null); };
  return (
    <aside className="inspector models">
      {header}
      <div className="mv-tabs">
        <button className={scope === 'todos' ? 'on' : ''} onClick={() => setScope('todos')}>Todos</button>
        <button className={scope === 'seleccion' ? 'on' : ''} disabled={!selected} title={selected ? '' : 'Seleccioná un módulo'} onClick={() => setScope('seleccion')}>Selección</button>
      </div>
      <div className="md-group">Muebles{sel ? ` · ${moduleName(sel)}` : ''}</div>
      {SLOTS.map((s) => {
        const eff = effectiveModel(project, s.id, sel);
        const m = byId.get(eff.id);
        return (
          <div key={s.id} className="md-row">
            <span className="md-label">{s.label}:</span>
            <button className={`md-value${eff.inherited ? ' inherited' : ''}`} title={eff.inherited ? 'Igual que Todos' : 'Clic para cambiar'}
              onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { setMenuAt(anchorBelow(e.currentTarget)); setMenu(menu === s.id ? null : s.id); }}>
              <Swatch m={m} /> {m ? pathLabel(m) : '—'}
            </button>
            {menu === s.id && (
              <CascadeMenu node={libraryTree(settings.materials, s.kind)} anchor={menuAt} onPick={(id) => apply(s.id, id)} onShowAll={() => { setAll(s.id); setMenu(null); }}
                extra={sel && !eff.inherited ? <button className="cm-item" onClick={() => apply(s.id, null)}>↺ Igual que Todos</button> : null} />
            )}
          </div>
        );
      })}
      <p className="hint">{scope === 'todos'
        ? 'Todos: cambia el modelo de todos los módulos del ambiente y de los que insertes después.'
        : 'Selección: cambia solo el módulo seleccionado. En gris, lo que sigue igual que Todos.'}</p>
      {all && (
        <ShowAll materials={settings.materials.filter((m) => (m.kind === 'piedra') === (SLOTS.find((s) => s.id === all).kind === 'piedra'))}
          current={effectiveModel(project, all, sel).id} onApply={(id) => apply(all, id)} onClose={() => setAll(null)} />
      )}
    </aside>
  );
}
