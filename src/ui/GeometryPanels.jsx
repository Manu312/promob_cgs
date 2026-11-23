import { useState } from 'react';
import { GEOMETRY_KINDS, ALIGNS, CONVERT_TARGETS, geometryDims, polygonRadii } from '../domain/geometry.js';
import { roomMatById } from '../domain/roomMaterials.js';
import { NumField } from './fields.jsx';

// HUD de "Construir geometría": valores con precisión (Tab entre campos, Enter confirma).
export function GeometryHud({ tool, onTool, onEnter, onCancel, onFinish }) {
  const o = tool.opts;
  const set = (patch) => onTool({ ...tool, opts: { ...o, ...patch } });
  const kind = GEOMETRY_KINDS.find(([k]) => k === tool.kind)?.[1];
  const planeTxt = tool.plane.kind === 'wall' ? 'pared' : tool.plane.kind === 'module' ? 'módulo' : 'piso';
  const num = (label, key, unit = 'mm', min = 0, max = 20000, step = 10) => (
    <label key={key}>{label} <input className={`gh-${key}`} type="number" value={o[key] ?? ''} min={min} max={max} step={step}
      onChange={(e) => set({ [key]: e.target.value === '' ? null : +e.target.value })}
      onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') onEnter(); if (e.key === 'Escape') onCancel(); }} /> {unit}</label>
  );
  const hint = {
    libre: tool.pts.length ? 'Clic en cada vértice (o largo + Enter); clic en el primero o clic derecho cierra' : 'Clic derecho en una pared o un módulo para usarlo como plano; clic para empezar',
    lineal: tool.pts.length ? 'Clic en cada punto (o largo + Enter); clic derecho termina' : 'Clic derecho en una pared o un módulo para usarlo como plano; clic para empezar',
    rect: tool.pts.length ? 'Clic en la esquina opuesta (o ancho y profundidad + Enter)' : 'Clic en una esquina',
    circ: tool.pts.length ? 'Clic para el radio (o radio + Enter)' : 'Clic en el centro',
    poly: tool.pts.length ? 'Clic para el tamaño (o radio + Enter)' : 'Clic en el centro',
  }[tool.kind];
  return (
    <div className="draw-hud geo-hud">
      <b>Geometría {kind}</b> <span className="hint-inline">plano: {planeTxt}</span>
      {(tool.kind === 'libre' || tool.kind === 'lineal') && <>{num('Largo', 'len')}{num('Ángulo', 'ang', '°', -360, 360, 5)}</>}
      {tool.kind === 'rect' && <>{num('Ancho', 'w')}{num('Profundidad', 'd')}</>}
      {tool.kind === 'circ' && <>{num('Radio', 'r')}{num('Ángulo base', 'base', '°', 0, 360, 5)}{num('Ángulo arco', 'arc', '°', 1, 360, 5)}</>}
      {tool.kind === 'poly' && <>{num('Lados', 'sides', '', 3, 64, 1)}{num('Radio', 'r')}</>}
      {num('Altura', 'height')}{num('Afastamiento', 'offset')}
      {tool.kind === 'lineal' && num('Espesor', 'thickness')}
      {(tool.kind === 'libre' || tool.kind === 'lineal') && <>{num('Incr. lineal', 'incL', 'mm', 1, 1000, 5)}{num('Incr. angular', 'incA', '°', 1, 90, 1)}</>}
      <label className="check"><input type="checkbox" checked={!!o.asDefault} onChange={(e) => set({ asDefault: e.target.checked })} /> Usar valores como padrón</label>
      {(tool.kind === 'libre' || tool.kind === 'lineal') && tool.pts.length >= 2 && <button onClick={onFinish}>Terminar</button>}
      <button onClick={onCancel}>Cancelar</button>
      <span className="hint-inline">{hint} · Esc cancela</span>
    </div>
  );
}

// Al terminar una lineal (Promob): finalizar, alineamiento, color, crear segmentos, convertir en ítem.
export function LinealDialog({ onOk, onCancel }) {
  const [align, setAlign] = useState('frente');
  const [color, setColor] = useState('#c9c4ba');
  const [segments, setSegments] = useState(false);
  const [convert, setConvert] = useState('');
  return (
    <div className="menu-backdrop dim">
      <div className="wall-dialog lineal-dialog" role="dialog" aria-label="Lineal">
        <h3>Geometría lineal</h3>
        <label className="field"><span>Alineamiento</span><select value={align} onChange={(e) => setAlign(e.target.value)}>{ALIGNS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        <label className="field"><span>Color</span><input type="color" value={color} onChange={(e) => setColor(e.target.value)} /></label>
        <label className="check"><input type="checkbox" checked={segments} onChange={(e) => setSegments(e.target.checked)} /> Crear segmentos (cada tramo editable aparte)</label>
        <label className="field"><span>Convertir en ítem de la modulación</span><select value={convert} onChange={(e) => setConvert(e.target.value)}>
          <option value="">No</option>{CONVERT_TARGETS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select></label>
        <div className="row-btns"><button onClick={onCancel}>Cancelar</button><button className="active" onClick={() => onOk({ align, color, segments, convert })}>Finalizar construcción</button></div>
      </div>
    </div>
  );
}

// Propiedades de una geometría (Promob: Dimensões, Posição, Material, Orçamento, Outras, Perfurante).
export function GeometryPanel({ g, onChange, onResize, onDelete, onConvert, onBack, children }) {
  const d = geometryDims(g);
  const [scale, setScale] = useState(false);
  const [target, setTarget] = useState('vista');
  const set = (patch) => onChange(patch);
  const b = g.budget || {};
  const m = g.finish && roomMatById(g.finish.mat);
  return (
    <aside className="inspector geometry-panel">
      <h3>Geometría {GEOMETRY_KINDS.find(([k]) => k === g.kind)?.[1]}</h3>
      <div className="row-btns">
        <button onClick={onBack}>← Proyecto</button>
        <button className="danger" onClick={onDelete}>Eliminar</button>
      </div>
      <h4>Dimensiones</h4>
      {g.kind !== 'circ' && <NumField label="Ancho" unit="mm" value={d.width} min={1} max={30000} onChange={(v) => onResize('width', v, scale)} />}
      {g.kind !== 'circ' && <NumField label="Profundidad" unit="mm" value={d.depth} min={1} max={30000} onChange={(v) => onResize('depth', v, scale)} />}
      {g.kind === 'circ' && <NumField label="Radio" unit="mm" value={Math.round(g.radius)} min={1} max={20000} onChange={(v) => set({ radius: v })} />}
      {g.kind === 'circ' && <NumField label="Ángulo base" unit="°" value={g.baseAngle || 0} min={0} max={360} onChange={(v) => set({ baseAngle: v })} />}
      {g.kind === 'circ' && <NumField label="Ángulo arco" unit="°" value={g.arc || 360} min={1} max={360} onChange={(v) => set({ arc: v })} />}
      {g.kind === 'poly' && g.sides && <p className="hint">Lados {g.sides} · Radio circunscrito {polygonRadii(g.sides, g.radius || 0).circ} · inscrito {polygonRadii(g.sides, g.radius || 0).insc} · lado {polygonRadii(g.sides, g.radius || 0).side}</p>}
      <NumField label="Altura" unit="mm" value={g.height} min={1} max={10000} onChange={(v) => set({ height: v })} />
      {g.kind === 'lineal' && <NumField label="Espesor" unit="mm" value={g.thickness} min={1} max={2000} onChange={(v) => set({ thickness: v })} />}
      {g.kind === 'lineal' && <label className="field"><span>Alineamiento</span><select value={g.align} onChange={(e) => set({ align: e.target.value })}>{ALIGNS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>}
      {g.kind !== 'circ' && <label className="check"><input type="checkbox" checked={scale} onChange={(e) => setScale(e.target.checked)} /> Escalar (mantener proporción)</label>}
      <p className="hint">Área: {(d.area / 1e6).toFixed(2)} m²</p>
      <h4>Posición</h4>
      <NumField label="Afastamiento" unit="mm" value={g.offset || 0} min={-5000} max={5000} onChange={(v) => set({ offset: v })} />
      <h4>Material</h4>
      {m ? <p className="finish-cur"><b>{m.label}</b> <button onClick={() => set({ finish: null })}>Quitar</button></p> : <label className="field"><span>Color</span><input type="color" value={g.color || '#c9c4ba'} onChange={(e) => set({ color: e.target.value })} /></label>}
      <p className="hint">También se le puede soltar un material de la pestaña Materiales.</p>
      <h4>Presupuesto</h4>
      <label className="check"><input type="checkbox" checked={!!b.on} onChange={(e) => set({ budget: { ...b, on: e.target.checked } })} /> Presupuestado</label>
      {b.on && <>
        <label className="field"><span>Descripción</span><input value={b.desc || ''} onChange={(e) => set({ budget: { ...b, desc: e.target.value } })} /></label>
        <label className="field"><span>Categoría</span><input value={b.category || ''} onChange={(e) => set({ budget: { ...b, category: e.target.value } })} /></label>
        <label className="field"><span>Grupo</span><input value={b.group || ''} onChange={(e) => set({ budget: { ...b, group: e.target.value } })} /></label>
        <label className="field"><span>Referencia</span><input value={b.ref || ''} onChange={(e) => set({ budget: { ...b, ref: e.target.value } })} /></label>
        <NumField label="Precio" unit="$" value={b.price || 0} min={0} max={1e9} step={100} onChange={(v) => set({ budget: { ...b, price: v } })} />
      </>}
      <h4>Otras</h4>
      <label className="check"><input type="checkbox" checked={g.visible !== false} onChange={(e) => set({ visible: e.target.checked })} /> Visible</label>
      <label className="check"><input type="checkbox" checked={g.movable !== false} onChange={(e) => set({ movable: e.target.checked })} /> Movible</label>
      <label className="field"><span>Observaciones</span><textarea rows={2} value={g.notes || ''} onChange={(e) => set({ notes: e.target.value })} /></label>
      {children}
      <h4>Convertir en</h4>
      <div className="row-btns">
        <select value={target} onChange={(e) => setTarget(e.target.value)}>{CONVERT_TARGETS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <button onClick={() => onConvert(target)}>Convertir</button>
      </div>
    </aside>
  );
}
