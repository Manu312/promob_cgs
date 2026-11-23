import { useEffect, useState } from 'react';
import { linearSpan, linearItemFor, segmentsFromClicks, autoTamponamento, DEFAULT_TOP_ITEMS } from '../domain/tamponamento.js';
import { NumField } from './fields.jsx';
import { footprint } from '../domain/modules.js';

const W = 560, H = 220, PAD = 14;

// Editor de Tamponamentos (Promob): tapas y laterales para los módulos seleccionados.
// Vista frontal: con "Insertar" cada clic arriba de los módulos marca una unión de la tapa.
export default function TamponamentoEditor({ mods, items, onItems, onInsert, onClose }) {
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  const all = items.length ? items : DEFAULT_TOP_ITEMS;
  const tops = all.filter((i) => i.kind === 'tapa'), sides = all.filter((i) => i.kind === 'lateral');
  const [topId, setTopId] = useState(tops[0]?.id);
  const [sideId, setSideId] = useState(sides[0]?.id);
  const [priority, setPriority] = useState('tapas');
  const [tool, setTool] = useState(null);
  const [cuts, setCuts] = useState([]);
  const [form, setForm] = useState(null);
  const sp = linearSpan(mods);
  if (!sp) return null;
  const top = all.find((i) => i.id === topId) || tops[0];
  const side = all.find((i) => i.id === sideId) || sides[0];
  const k = Math.min((W - 2 * PAD) / Math.max(1, sp.s1 - sp.s0), (H - 2 * PAD) / Math.max(1, sp.top + 200));
  const sx = (s) => PAD + (s - sp.s0) * k, sy = (y) => H - PAD - y * k;
  // comienzo del módulo a lo largo del conjunto (la menor proyección de su huella)
  const proj = (m) => { const { fw, fd } = footprint(m); return Math.min(...[[m.x, m.z], [m.x + fw, m.z], [m.x, m.z + fd], [m.x + fw, m.z + fd]].map(([x, z]) => x * sp.ex[0] + z * sp.ex[1])); };
  const segs = segmentsFromClicks(sp.s0, sp.s1, cuts);
  const insertTops = () => onInsert(segs.map((sg) => linearItemFor(mods, top, sg)));
  const auto = (mode) => onInsert(autoTamponamento(mods, { top, side, mode, priority }));
  return (
    <div className="menu-backdrop dim">
      <div className="wall-dialog surface-editor tampon-editor" role="dialog" aria-label="Editor de tamponamentos">
        <h3>Editor de tamponamentos · {mods.length} módulo{mods.length > 1 ? 's' : ''}</h3>
        <div className="se-tools">
          <label>Tapa <select value={top?.id} onChange={(e) => setTopId(e.target.value)}>{tops.map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}</select></label>
          <label>Lateral <select value={side?.id} onChange={(e) => setSideId(e.target.value)}>{sides.map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}</select></label>
          <button onClick={() => setForm({ label: '', kind: 'tapa', thickness: 18, depthExtra: 0, offset: 0, align: 'frente' })}>Registrar ítem…</button>
        </div>
        <div className="se-tools">
          <button className={tool === 'insert' ? 'active' : ''} onClick={() => setTool(tool === 'insert' ? null : 'insert')} title="Clic en la vista frontal para marcar las uniones de la tapa">Insertar (uniones)</button>
          <button onClick={() => setCuts([])} disabled={!cuts.length}>Sin uniones</button>
        </div>
        <svg width={W} height={H} className={`se-svg${tool ? ' tool-h' : ''}`} onPointerDown={(e) => {
          if (tool !== 'insert') return;
          const r = e.currentTarget.getBoundingClientRect();
          setCuts((c) => [...c, sp.s0 + (e.clientX - r.left - PAD) / k]);
        }}>
          <line x1={0} y1={sy(0)} x2={W} y2={sy(0)} className="se-floor" />
          {mods.map((m) => { const s = proj(m); return <rect key={m.id} x={sx(s)} y={sy((m.y || 0) + m.params.height)} width={m.params.width * k} height={m.params.height * k} className="se-face" />; })}
          {segs.map(([a, b], i) => <rect key={i} x={sx(a) + 1} y={sy(sp.top + top.thickness)} width={(b - a) * k - 2} height={Math.max(3, top.thickness * k)} className="se-top" />)}
          {cuts.map((c, i) => <line key={i} x1={sx(c)} x2={sx(c)} y1={sy(sp.top + 120)} y2={sy(sp.top - 40)} className="se-strip h" />)}
        </svg>
        <div className="row-btns"><button onClick={insertTops}>Insertar tapa{segs.length > 1 ? `s (${segs.length})` : ''}</button></div>
        <h4>Inserción automática</h4>
        <div className="se-tools">
          <label>Prioridad de inserción <select value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="tapas">Tapas primero (los laterales crecen)</option>
            <option value="laterales">Laterales primero (la tapa crece)</option>
          </select></label>
        </div>
        <div className="row-btns">
          <button onClick={() => auto('tapas')}>Insertar solo tapas</button>
          <button onClick={() => auto('laterales')}>Insertar solo laterales</button>
          <button onClick={() => auto('ambos')}>Insertar ambos</button>
        </div>
        {form && (
          <div className="tampon-form">
            <h4>Registrar ítem</h4>
            <label className="field"><span>Nombre</span><input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} /></label>
            <label className="field"><span>Tipo</span><select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}><option value="tapa">Tapa</option><option value="lateral">Lateral</option></select></label>
            <NumField label="Espesor" unit="mm" value={form.thickness} min={3} max={100} onChange={(v) => setForm({ ...form, thickness: v })} />
            <NumField label="Profundidad (extra)" unit="mm" value={form.depthExtra} min={-200} max={400} onChange={(v) => setForm({ ...form, depthExtra: v })} />
            <NumField label="Offset" unit="mm" value={form.offset} min={0} max={500} onChange={(v) => setForm({ ...form, offset: v })} />
            <label className="field"><span>Alineación</span><select value={form.align} onChange={(e) => setForm({ ...form, align: e.target.value })}>
              <option value="frente">Por el frente</option><option value="atras">Por atrás</option><option value="arriba">Por arriba</option><option value="abajo">Por abajo</option>
            </select></label>
            <div className="row-btns">
              <button onClick={() => setForm(null)}>Cancelar</button>
              <button className="active" disabled={!form.label.trim()} onClick={() => {
                const it = { ...form, id: `it${Date.now().toString(36)}`, type: form.kind === 'tapa' ? 'tapa' : 'vista' };
                onItems([...all, it]);
                if (it.kind === 'tapa') setTopId(it.id); else setSideId(it.id);
                setForm(null);
              }}>Registrar</button>
            </div>
          </div>
        )}
        <div className="row-btns"><button className="active" onClick={onClose}>Aceptar</button></div>
      </div>
    </div>
  );
}
