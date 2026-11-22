import { OPENING_TYPES, roomWalls, rid, rebuildFromShape, setWallDefaults } from '../domain/room.js';
import { useState } from 'react';
import { NumField, SelField } from './fields.jsx';
import { TEMPLATES, applyTemplate } from '../domain/drawWalls.js';

const SHAPES = [['rect', 'Rectangular'], ['L', 'En L'], ['libre', 'Libre (puntos)']];

// Editor numérico del ambiente. Las formas regeneran las paredes conservando sus ids
// (las aberturas siguen en su pared). Se reemplaza por la edición interactiva de la Fase 1.
export default function RoomEditor({ room, onChange, onSelectWall, onDrawWalls }) {
  const [tpl, setTpl] = useState({ kind: 'dos', w: 3600, d: 3000 });
  const set = (patch) => onChange({ ...room, ...patch });
  const rebuild = (patch) => onChange(rebuildFromShape(room, patch));
  const walls = roomWalls(room);
  const wallOpts = walls.map((w) => [w.id, `Pared ${w.i + 1} (${w.len} mm)`]);
  const points = room.points || [];

  const setShape = (shape) => rebuild({ shape, ...(shape === 'libre' ? { points: points.map((p) => [...p]) } : {}) });
  const setPoint = (i, k, v) => rebuild({ points: points.map((p, j) => (j === i ? (k === 0 ? [v, p[1]] : [p[0], v]) : p)) });
  const addPoint = (i) => {
    const a = points[i], b = points[(i + 1) % points.length];
    const pts = [...points];
    pts.splice(i + 1, 0, [Math.round((a[0] + b[0]) / 2), Math.round((a[1] + b[1]) / 2)]);
    rebuild({ points: pts });
  };
  const delPoint = (i) => points.length > 3 && rebuild({ points: points.filter((_, j) => j !== i) });

  const setOpening = (id, patch) => set({ openings: room.openings.map((o) => (o.id === id ? { ...o, ...patch } : o)) });
  const addOpening = (type) => {
    const d = OPENING_TYPES[type];
    const w = walls[0];
    if (!w) return;
    set({ openings: [...room.openings, { id: rid('o'), type, wallId: w.id, offset: Math.max(0, (w.len - d.width) / 2), width: d.width, height: d.height, sill: d.sill }] });
  };
  const setColumn = (id, patch) => set({ columns: room.columns.map((c) => (c.id === id ? { ...c, ...patch } : c)) });

  return (
    <div className="room-editor">
      {onDrawWalls && (
        <div className="row-btns">
          <button className="active-soft" onClick={onDrawWalls} title="Dibujar paredes con clics y medidas (Ctrl+Shift+P)">✏ Construir paredes</button>
        </div>
      )}
      <div className="sub-card">
        <div className="sub-head"><b>Nuevo ambiente</b></div>
        <SelField label="Plantilla" value={tpl.kind} options={TEMPLATES} onChange={(kind) => setTpl({ ...tpl, kind })} />
        <NumField label="Ancho" unit="mm" value={tpl.w} min={500} max={20000} step={50} onChange={(w) => setTpl({ ...tpl, w })} />
        <NumField label="Profundidad" unit="mm" value={tpl.d} min={500} max={20000} step={50} onChange={(d) => setTpl({ ...tpl, d })} />
        <div className="row-btns">
          <button onClick={() => onChange(applyTemplate(room, tpl.kind, { w: tpl.w, d: tpl.d }))} title="Reemplaza las paredes (se puede deshacer)">Aplicar plantilla</button>
        </div>
      </div>
      <SelField label="Forma" value={room.shape} options={SHAPES} onChange={setShape} />
      {room.shape !== 'libre' && (
        <>
          <NumField label="Ancho" unit="mm" value={room.w} min={1000} max={20000} step={50} onChange={(v) => rebuild({ w: v })} />
          <NumField label="Profundidad" unit="mm" value={room.d} min={1000} max={20000} step={50} onChange={(v) => rebuild({ d: v })} />
        </>
      )}
      {room.shape === 'L' && (
        <>
          <NumField label="Recorte ancho" unit="mm" value={room.cutW} min={100} max={room.w - 100} step={50} onChange={(v) => rebuild({ cutW: v })} />
          <NumField label="Recorte prof." unit="mm" value={room.cutD} min={100} max={room.d - 100} step={50} onChange={(v) => rebuild({ cutD: v })} />
        </>
      )}
      {room.shape === 'libre' && (
        <div className="pts">
          <div className="pts-head"><span>#</span><span>X</span><span>Z</span><span /></div>
          {points.map((p, i) => (
            <div key={i} className="pts-row">
              <span>{i + 1}</span>
              <NumField compact value={p[0]} min={0} max={30000} step={10} onChange={(v) => setPoint(i, 0, v)} />
              <NumField compact value={p[1]} min={0} max={30000} step={10} onChange={(v) => setPoint(i, 1, v)} />
              <span className="pts-btns">
                <button className="small" title="Agregar punto después" onClick={() => addPoint(i)}>+</button>
                <button className="small danger" title="Quitar punto" disabled={points.length <= 3} onClick={() => delPoint(i)}>✕</button>
              </span>
            </div>
          ))}
          <p className="hint">Puntos en mm, recorridos en orden. La pared N va del punto N al siguiente.</p>
        </div>
      )}
      <NumField label="Alto" unit="mm" value={room.h} min={2000} max={5000} step={50} onChange={(v) => onChange(setWallDefaults(room, { h: v }))} />
      <NumField label="Espesor paredes" unit="mm" value={room.t} min={50} max={400} step={10} onChange={(v) => onChange(setWallDefaults(room, { t: v }))} />

      {onSelectWall && (
        <>
          <h4>Paredes</h4>
          <div className="wall-list">
            {walls.map((w) => (
              <button key={w.id} className={`small${w.wall.visible ? '' : ' muted'}`} onClick={() => onSelectWall(w.id)} title="Ver propiedades de la pared">
                P{w.i + 1} · {w.len}{w.wall.visible ? '' : ' (oculta)'}
              </button>
            ))}
          </div>
        </>
      )}

      <h4>Aberturas</h4>
      {room.openings.map((o) => (
        <div key={o.id} className="sub-card">
          <div className="sub-head">
            <b>{OPENING_TYPES[o.type]?.label || o.type}</b>
            <button className="small danger" onClick={() => set({ openings: room.openings.filter((x) => x.id !== o.id) })}>Quitar</button>
          </div>
          <SelField label="Pared" value={o.wallId} options={wallOpts} onChange={(v) => setOpening(o.id, { wallId: v })} />
          <NumField label="Desde inicio de pared" unit="mm" value={Math.round(o.offset)} min={0} max={30000} step={10} onChange={(v) => setOpening(o.id, { offset: v })} />
          <NumField label="Ancho" unit="mm" value={o.width} min={100} max={10000} step={10} onChange={(v) => setOpening(o.id, { width: v })} />
          <NumField label="Alto" unit="mm" value={o.height} min={100} max={5000} step={10} onChange={(v) => setOpening(o.id, { height: v })} />
          {o.type === 'ventana' && <NumField label="Antepecho" unit="mm" value={o.sill} min={0} max={3000} step={10} onChange={(v) => setOpening(o.id, { sill: v })} />}
        </div>
      ))}
      <div className="row-btns">
        {Object.entries(OPENING_TYPES).map(([k, d]) => <button key={k} onClick={() => addOpening(k)}>+ {d.label}</button>)}
      </div>

      <h4>Columnas / salientes</h4>
      {room.columns.map((c, i) => (
        <div key={c.id} className="sub-card">
          <div className="sub-head">
            <b>Columna {i + 1}</b>
            <button className="small danger" onClick={() => set({ columns: room.columns.filter((x) => x.id !== c.id) })}>Quitar</button>
          </div>
          <NumField label="X" unit="mm" value={c.x} min={0} max={30000} step={10} onChange={(v) => setColumn(c.id, { x: v })} />
          <NumField label="Z" unit="mm" value={c.z} min={0} max={30000} step={10} onChange={(v) => setColumn(c.id, { z: v })} />
          <NumField label="Ancho" unit="mm" value={c.w} min={50} max={3000} step={10} onChange={(v) => setColumn(c.id, { w: v })} />
          <NumField label="Profundidad" unit="mm" value={c.d} min={50} max={3000} step={10} onChange={(v) => setColumn(c.id, { d: v })} />
        </div>
      ))}
      <div className="row-btns">
        <button onClick={() => set({ columns: [...room.columns, { id: rid('c'), x: 0, z: 0, w: 300, d: 300 }] })}>+ Columna</button>
      </div>
    </div>
  );
}
