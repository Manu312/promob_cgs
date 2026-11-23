import { useEffect, useMemo, useState } from 'react';
import { DXF_UNITS, dxfSegments, segsBounds } from '../domain/dxf.js';
import { EXTERNAL_UNITS } from '../domain/externals.js';
import { NumField } from './fields.jsx';

const useEsc = (fn) => useEffect(() => {
  const k = (e) => { if (e.key === 'Escape') fn(); };
  window.addEventListener('keydown', k);
  return () => window.removeEventListener('keydown', k);
}, [fn]);

// Importar planta DXF: capas, unidades, vista previa; como dibujo de referencia o en paredes.
export function DxfImportDialog({ dxf, fileName, onAccept, onClose }) {
  useEsc(onClose);
  const [layers, setLayers] = useState(dxf.layers);
  const [units, setUnits] = useState(dxf.units || 'mm');
  const [mode, setMode] = useState('ref');
  const segs = useMemo(() => dxfSegments(dxf, { layers, units }), [dxf, layers, units]);
  const b = segs.length ? segsBounds(segs) : null;
  const W = 420, H = 260;
  const k = b ? Math.min((W - 20) / Math.max(1, b.maxX - b.minX), (H - 20) / Math.max(1, b.maxZ - b.minZ)) : 1;
  return (
    <div className="menu-backdrop dim">
      <div className="wall-dialog dxf-dialog" role="dialog" aria-label="Importar planta DXF">
        <h3>Importar planta · {fileName}</h3>
        <div className="dxf-cols">
          <svg width={W} height={H} className="dxf-preview">
            {segs.slice(0, 6000).map((s, i) => <line key={i} x1={10 + (s.a[0] - b.minX) * k} y1={10 + (s.a[1] - b.minZ) * k} x2={10 + (s.b[0] - b.minX) * k} y2={10 + (s.b[1] - b.minZ) * k} />)}
          </svg>
          <div className="dxf-opts">
            <b>Capas</b>
            {dxf.layers.map((l) => (
              <label key={l} className="check"><input type="checkbox" checked={layers.includes(l)} onChange={(e) => setLayers((ls) => (e.target.checked ? [...ls, l] : ls.filter((x) => x !== l)))} /> {l}</label>
            ))}
            <label className="field"><span>Unidades</span><select value={units} onChange={(e) => setUnits(e.target.value)}>{DXF_UNITS.map(([kk, lb]) => <option key={kk} value={kk}>{lb}</option>)}</select></label>
            <p className="hint">{b ? `${Math.round(b.maxX - b.minX)} × ${Math.round(b.maxZ - b.minZ)} mm · ${segs.length} tramos` : 'Sin entidades en las capas elegidas.'}</p>
            <label className="radio"><input type="radio" name="dxfmode" checked={mode === 'ref'} onChange={() => setMode('ref')} /> Dibujo de referencia en el piso</label>
            <label className="radio"><input type="radio" name="dxfmode" checked={mode === 'walls'} onChange={() => setMode('walls')} /> Convertir las líneas en paredes</label>
          </div>
        </div>
        <div className="row-btns">
          <button onClick={onClose}>Cancelar</button>
          <button className="active" disabled={!segs.length} onClick={() => { onAccept({ segments: segs, mode }); onClose(); }}>Importar</button>
        </div>
      </div>
    </div>
  );
}

// Entidades externas (modelos 3D importados): posición, giro, escala, unidades, visible, quitar.
export function ExternalsPanel({ externals, planDxf, onChange, onRemove, onDxf, onClose }) {
  return (
    <div className="render-dialog externals-panel" role="dialog" aria-label="Importados">
      <header><h3>Importados</h3><button className="icon-btn" onClick={onClose} aria-label="Cerrar">✕</button></header>
      <div className="rd-body">
        {planDxf && (
          <fieldset className="ext-item">
            <legend>Planta DXF · {planDxf.segments.length} tramos</legend>
            <label className="check"><input type="checkbox" checked={planDxf.visible !== false} onChange={(e) => onDxf({ visible: e.target.checked })} /> Visible</label>
            <div className="ext-grid">
              <NumField label="X" unit="mm" value={planDxf.x || 0} step={10} onChange={(v) => onDxf({ x: v })} />
              <NumField label="Z" unit="mm" value={planDxf.z || 0} step={10} onChange={(v) => onDxf({ z: v })} />
            </div>
            <button className="danger" onClick={() => onDxf(null)}>Quitar planta</button>
          </fieldset>
        )}
        {externals.map((e) => (
          <fieldset key={e.id} className="ext-item" data-id={e.id}>
            <legend>{e.name} · {e.format.toUpperCase()}</legend>
            <label className="check"><input type="checkbox" checked={e.visible !== false} onChange={(ev) => onChange(e.id, { visible: ev.target.checked })} /> Visible</label>
            <div className="ext-grid">
              <NumField label="X" unit="mm" value={e.x} step={10} onChange={(v) => onChange(e.id, { x: v })} />
              <NumField label="Z" unit="mm" value={e.z} step={10} onChange={(v) => onChange(e.id, { z: v })} />
              <NumField label="Altura" unit="mm" value={e.y} min={0} step={10} onChange={(v) => onChange(e.id, { y: v })} />
              <NumField label="Giro" unit="°" value={e.rot} step={15} onChange={(v) => onChange(e.id, { rot: v })} />
              <NumField label="Escala" value={e.scale} min={0.01} max={100} step={0.1} onChange={(v) => onChange(e.id, { scale: v })} />
              <label className="field"><span>Unidades</span><select value={e.units} onChange={(ev) => onChange(e.id, { units: ev.target.value })}>{EXTERNAL_UNITS.map(([kk, lb]) => <option key={kk} value={kk}>{lb}</option>)}</select></label>
            </div>
            <button className="danger" onClick={() => onRemove(e.id)}>Quitar</button>
          </fieldset>
        ))}
        {!externals.length && !planDxf && <p className="hint">Importá una planta DXF o un modelo 3D (OBJ, STL, GLB) desde la barra.</p>}
      </div>
    </div>
  );
}
