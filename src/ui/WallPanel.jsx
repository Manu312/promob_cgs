import { arcAngleFromSagitta, sagittaFromArcAngle, arcLength } from '../domain/curvedWalls.js';
import FinishFields from './FinishFields.jsx';
import { finishesOf, setFinishProps, clearFinish } from '../domain/roomMaterials.js';
import { roomWalls } from '../domain/room.js';
import { wallAngles } from '../domain/walls.js';
import { setWallLength, setWallAngle, updateWall } from '../domain/wallEdit.js';
import { NumField, SelField } from './fields.jsx';

const YES_NO = [['si', 'Sí'], ['no', 'No']];
const yn = (b) => (b ? 'si' : 'no');

// Propiedades de la pared seleccionada (como Herramientas → Propiedades de Promob).
export default function WallPanel({ room, wallId, onRoom, onBack, onDelete, onSplit }) {
  const g = roomWalls(room).find((w) => w.id === wallId);
  if (!g) return null;
  const ang = wallAngles(room).find((a) => a.id === wallId);
  const w = g.wall;
  const set = (patch) => onRoom((r) => updateWall(r, wallId, patch));
  return (
    <aside className="inspector">
      <h3>Pared {g.i + 1}</h3>
      <div className="row-btns">
        <button onClick={onBack}>← Proyecto</button>
        {onSplit && <button onClick={() => onSplit(wallId, g.len / 2)} title="Parte la pared en dos tramos iguales">Dividir al medio</button>}
        {onDelete && <button className="danger" onClick={() => onDelete(wallId)}>Eliminar…</button>}
      </div>
      <FinishFields title="Material (cara interior)" finish={finishesOf(room).walls[wallId]}
        onProps={(patch) => onRoom((r) => setFinishProps(r, { kind: 'wall', wallId }, patch))}
        onClear={() => onRoom((r) => clearFinish(r, { kind: 'wall', wallId }))} />
      <h4>Dimensiones</h4>
      <NumField label="Largo" unit="mm" value={g.len} min={100} max={30000} step={10} onChange={(v) => onRoom((r) => setWallLength(r, wallId, v))} />
      <NumField label="Ángulo absoluto" unit="°" value={ang.abs} min={0} max={359.99} step={0.5} onChange={(v) => onRoom((r) => setWallAngle(r, wallId, v, 'abs'))} />
      {ang.rel != null
        ? <NumField label="Ángulo relativo" unit="°" value={ang.rel} min={1} max={359} step={0.5} onChange={(v) => onRoom((r) => setWallAngle(r, wallId, v, 'rel'))} />
        : <p className="hint">Ángulo relativo: no tiene, es la primera pared de la cadena.</p>}
      <NumField label="Espesor" unit="mm" value={w.t} min={50} max={600} step={10} onChange={(v) => set({ t: v })} />
      <NumField label="Flecha (curva)" unit="mm" value={w.flecha || 0} min={-Math.round(g.len / 2)} max={Math.round(g.len / 2)} step={10} onChange={(v) => set({ flecha: v })} />
      <NumField label="Ángulo del arco" unit="°" value={arcAngleFromSagitta(g.len, w.flecha || 0)} min={-180} max={180} step={5} onChange={(v) => set({ flecha: sagittaFromArcAngle(g.len, v) })} />
      {!!w.flecha && <p className="hint">Largo del arco: {arcLength(g.len, w.flecha)} mm (el largo de arriba es la cuerda). Con H (Mover HotPoint) se curva arrastrando el punto verde.</p>}
      <NumField label="Alto inicial" unit="mm" value={w.h0} min={100} max={6000} step={10} onChange={(v) => set({ h0: v })} />
      <NumField label="Alto final" unit="mm" value={w.h1} min={100} max={6000} step={10} onChange={(v) => set({ h1: v })} />
      <NumField label="Separación del piso" unit="mm" value={w.floorGap || 0} min={0} max={3000} step={10} onChange={(v) => set({ floorGap: v })} />
      <h4>Opciones</h4>
      <SelField label="Movible en 3D" value={yn(w.movable)} options={YES_NO} onChange={(v) => set({ movable: v === 'si' })} />
      <SelField label="Rebajada" value={yn(w.lowered)} options={YES_NO} onChange={(v) => set({ lowered: v === 'si' })} />
      <SelField label="Visible" value={yn(w.visible)} options={YES_NO} onChange={(v) => set({ visible: v === 'si' })} />
      <p className="hint">Al cambiar el largo o el ángulo, la pared siguiente se corre en paralelo y el ambiente sigue cerrado.</p>
      <p className="hint">Una pared invisible se vuelve a elegir desde la lista de paredes del proyecto.</p>
      <p className="hint">Clic derecho sobre la pared: Rebajar · Transparente · Dividir aquí · Eliminar. <b>Supr</b> también elimina.</p>
    </aside>
  );
}
