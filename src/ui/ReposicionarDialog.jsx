import { useEffect, useState } from 'react';
import { NumField } from './fields.jsx';

// Ventana "Reposicionar" de Duplicar (Ctrl+D), como Promob: dónde queda la copia respecto del
// original. Las siguientes copias usan el mismo desplazamiento sin volver a preguntar.
export default function ReposicionarDialog({ initial, onOk, onCancel }) {
  const [o, setO] = useState(initial);
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onCancel(); if (e.key === 'Enter' && e.target.tagName !== 'INPUT') onOk(o); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [o, onOk, onCancel]);
  return (
    <div className="menu-backdrop dim" onPointerDown={onCancel}>
      <div className="wall-dialog reposicionar" role="dialog" aria-label="Reposicionar" onPointerDown={(e) => e.stopPropagation()}>
        <h3>Reposicionar</h3>
        <p className="hint">Posición de la copia respecto del original. Las próximas copias usan el mismo desplazamiento.</p>
        <b className="rp-sub">Vista frontal</b>
        <NumField label="X (a lo ancho)" unit="mm" value={o.dx} step={10} onChange={(v) => setO({ ...o, dx: v })} />
        <NumField label="Altura" unit="mm" value={o.dy} step={10} onChange={(v) => setO({ ...o, dy: v })} />
        <b className="rp-sub">Planta</b>
        <NumField label="Profundidad" unit="mm" value={o.dz} step={10} onChange={(v) => setO({ ...o, dz: v })} />
        <div className="row-btns">
          <button onClick={onCancel}>Cancelar</button>
          <button className="active" onClick={() => onOk(o)}>Aceptar</button>
        </div>
      </div>
    </div>
  );
}
