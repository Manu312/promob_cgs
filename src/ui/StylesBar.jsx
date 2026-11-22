import { useEffect, useState } from 'react';
import { saveStyle, renameStyle, removeStyle, currentModels } from '../domain/styles.js';

function Dialog({ title, onClose, children, foot }) {
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="menu-backdrop dim" onPointerDown={onClose}>
      <div className="quickfind style-dialog" role="dialog" aria-label={title} onPointerDown={(e) => e.stopPropagation()}>
        <div className="qf-head"><b>{title}</b><button className="link" onClick={onClose} aria-label="Cerrar">✕</button></div>
        <div className="qf-tree">{children}</div>
        <div className="qf-foot row-btns">{foot}</div>
      </div>
    </div>
  );
}

// "Guardar nuevo estilo": nombre + qué modelos incluye (todos tildados de entrada).
function SaveDialog({ rows, styles, onSave, onClose }) {
  const [name, setName] = useState('');
  const [inc, setInc] = useState(() => Object.fromEntries(rows.map((r) => [r.id, true])));
  const exists = styles.some((s) => s.name.trim().toLowerCase() === name.trim().toLowerCase());
  const save = () => { if (name.trim()) onSave(name, rows.filter((r) => inc[r.id]).map((r) => r.id)); };
  return (
    <Dialog title="Guardar nuevo estilo" onClose={onClose}
      foot={<><button className="active" disabled={!name.trim()} onClick={save}>{exists ? 'Actualizar' : 'Guardar'}</button><button onClick={onClose}>Cancelar</button></>}>
      <label className="sd-name">Nombre: <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') save(); }} /></label>
      {exists && <p className="hint">Ya hay un estilo con ese nombre: se actualiza.</p>}
      <p className="hint">Modelos que guarda el estilo:</p>
      {rows.map((r) => (
        <label key={r.id} className="radio sd-check"><input type="checkbox" checked={!!inc[r.id]} onChange={(e) => setInc((o) => ({ ...o, [r.id]: e.target.checked }))} /> {r.label}</label>
      ))}
    </Dialog>
  );
}

// "Editar estilos": renombrar y borrar.
function EditDialog({ styles, onStyles, onClose }) {
  const [names, setNames] = useState(() => Object.fromEntries(styles.map((s) => [s.id, s.name])));
  return (
    <Dialog title="Editar estilos" onClose={onClose} foot={<button onClick={onClose}>Cerrar</button>}>
      {styles.map((s) => (
        <div key={s.id} className="sd-row">
          <input value={names[s.id] ?? s.name} onChange={(e) => setNames((n) => ({ ...n, [s.id]: e.target.value }))} onKeyDown={(e) => e.stopPropagation()} />
          <button disabled={(names[s.id] ?? s.name) === s.name} onClick={() => onStyles(renameStyle(styles, s.id, names[s.id]))}>Renombrar</button>
          <button className="danger" onClick={() => onStyles(removeStyle(styles, s.id))}>Borrar</button>
        </div>
      ))}
      {!styles.length && <p className="hint">No hay estilos guardados.</p>}
    </Dialog>
  );
}

// Estilos del panel Modelos (como Promob): Aplicar estilo · Guardar nuevo · Editar.
export default function StylesBar({ styles, rows, project, selected, scope, onStyles, onApplyStyle }) {
  const [open, setOpen] = useState(null); // 'apply' | 'save' | 'edit'
  useEffect(() => {
    if (open !== 'apply') return undefined;
    const close = () => setOpen(null);
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [open]);
  return (
    <div className="styles-bar">
      <span className="sb-title">Estilos</span>
      <span className="sb-apply" onPointerDown={(e) => e.stopPropagation()}>
        <button className="link" onClick={() => setOpen(open === 'apply' ? null : 'apply')}>Aplicar estilo ▾</button>
        {open === 'apply' && (
          <div className="style-menu">
            {styles.map((s) => <button key={s.id} className="cm-item" onClick={() => { onApplyStyle(s, scope); setOpen(null); }}>{s.name}</button>)}
            {!styles.length && <span className="hint">No hay estilos.</span>}
          </div>
        )}
      </span>
      <button className="icon-btn" title="Guardar nuevo estilo" aria-label="Guardar nuevo estilo" onClick={() => setOpen('save')}>＋</button>
      <button className="icon-btn" title="Editar estilos" aria-label="Editar estilos" onClick={() => setOpen('edit')}>✎</button>
      {open === 'save' && (
        <SaveDialog rows={rows} styles={styles} onClose={() => setOpen(null)}
          onSave={(name, include) => { onStyles(saveStyle(styles, name, currentModels(project, scope === 'seleccion' ? selected : null), include)); setOpen(null); }} />
      )}
      {open === 'edit' && <EditDialog styles={styles} onStyles={onStyles} onClose={() => setOpen(null)} />}
    </div>
  );
}
