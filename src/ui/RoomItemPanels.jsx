import { OPENING_TYPES, roomWalls } from '../domain/room.js';
import { updateOpening, removeOpening, openingDims, setOpeningDim, updateColumn, removeColumn } from '../domain/openings.js';
import { NumField, SelField } from './fields.jsx';

// Propiedades de la abertura seleccionada (ventana, puerta o vano).
export function OpeningPanel({ room, id, onRoom, onBack }) {
  const o = room.openings.find((x) => x.id === id);
  if (!o) return null;
  const d = openingDims(room, id);
  const walls = roomWalls(room).map((w) => [w.id, `Pared ${w.i + 1} (${w.len} mm)`]);
  const set = (patch) => onRoom((r) => updateOpening(r, id, patch));
  return (
    <aside className="inspector">
      <h3>{OPENING_TYPES[o.type]?.label || o.type}</h3>
      <div className="row-btns">
        <button onClick={onBack}>← Proyecto</button>
        <button className="danger" onClick={() => { onRoom((r) => removeOpening(r, id)); onBack(); }}>Quitar</button>
      </div>
      <SelField label="Tipo" value={o.type} options={Object.entries(OPENING_TYPES).map(([k, t]) => [k, t.label])} onChange={(v) => set({ type: v })} />
      <SelField label="Pared" value={o.wallId} options={walls} onChange={(v) => set({ wallId: v })} />
      <NumField label="Desde inicio de pared" unit="mm" value={d?.start ?? 0} min={0} max={30000} step={10} onChange={(v) => onRoom((r) => setOpeningDim(r, id, 'start', v))} />
      <NumField label="Hasta fin de pared" unit="mm" value={d?.end ?? 0} min={0} max={30000} step={10} onChange={(v) => onRoom((r) => setOpeningDim(r, id, 'end', v))} />
      <NumField label="Ancho" unit="mm" value={o.width} min={100} max={10000} step={10} onChange={(v) => set({ width: v })} />
      <NumField label="Alto" unit="mm" value={o.height} min={100} max={5000} step={10} onChange={(v) => set({ height: v })} />
      <NumField label="Antepecho" unit="mm" value={o.sill} min={0} max={3000} step={10} onChange={(v) => set({ sill: v })} />
      <p className="hint">Arrastrala sobre su pared para moverla; nunca se sale de la pared. Supr la quita.</p>
    </aside>
  );
}

// Propiedades de la columna / saliente seleccionada.
export function ColumnPanel({ room, id, onRoom, onBack }) {
  const c = room.columns.find((x) => x.id === id);
  if (!c) return null;
  const set = (patch) => onRoom((r) => updateColumn(r, id, patch));
  return (
    <aside className="inspector">
      <h3>Columna</h3>
      <div className="row-btns">
        <button onClick={onBack}>← Proyecto</button>
        <button className="danger" onClick={() => { onRoom((r) => removeColumn(r, id)); onBack(); }}>Quitar</button>
      </div>
      <NumField label="X" unit="mm" value={c.x} min={-30000} max={30000} step={10} onChange={(v) => set({ x: v })} />
      <NumField label="Z" unit="mm" value={c.z} min={-30000} max={30000} step={10} onChange={(v) => set({ z: v })} />
      <NumField label="Ancho" unit="mm" value={c.w} min={50} max={3000} step={10} onChange={(v) => set({ w: v })} />
      <NumField label="Profundidad" unit="mm" value={c.d} min={50} max={3000} step={10} onChange={(v) => set({ d: v })} />
      <p className="hint">Arrastrala para moverla: se pega a las paredes y a la grilla. Supr la quita.</p>
    </aside>
  );
}
