import { useEffect, useMemo, useRef, useState } from 'react';
import { roomWalls } from '../domain/room.js';
import { floorPolygon } from '../domain/walls.js';
import { ROOM_MATERIALS, roomMatById } from '../domain/roomMaterials.js';
import { stripsOf, setStrips, stripCells, saveStripPreset, rectPts, circlePts, offsetPolygon, chamferPolygon, filletPolygon, cutPolygon, movePolygon, addRegion, updateRegion, regionId, removeRegion, duplicateRegion, regionsOn } from '../domain/strips.js';
import { ListField } from './fields.jsx';

const SW = 560, SH = 320, PAD = 16;
const matColor = (f) => (f ? f.tint || roomMatById(f.mat)?.color || '#ccc' : null);

function useEsc(onClose) {
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
}

// Escala y traslado de la superficie (mm) al dibujo; en paredes v crece hacia arriba.
function useFit(bx0, by0, bx1, by1, flipY) {
  return useMemo(() => {
    const k = Math.min((SW - 2 * PAD) / Math.max(1, bx1 - bx0), (SH - 2 * PAD) / Math.max(1, by1 - by0));
    const to = ([x, y]) => [PAD + (x - bx0) * k, flipY ? SH - PAD - (y - by0) * k : PAD + (y - by0) * k];
    const from = (sx, sy) => [bx0 + (sx - PAD) / k, flipY ? by0 + (SH - PAD - sy) / k : by0 + (sy - PAD) / k];
    return { k, to, from };
  }, [bx0, by0, bx1, by1, flipY]);
}

const svgPoint = (e) => { const r = e.currentTarget.closest('svg').getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };

// ---------------- Editor de franjas ----------------
export function StripEditor({ room, wallId, onRoom, presets = [], onPresets, onRegions, onUndo, onRedo, onClose }) {
  useEsc(onClose);
  const g = roomWalls(room).find((w) => w.id === wallId);
  const [tool, setTool] = useState('sel');
  const [drag, setDrag] = useState(null);
  const [name, setName] = useState('');
  const H = g ? Math.max(g.wall.h0 ?? room.h, g.wall.h1 ?? room.h) : room.h;
  const fit = useFit(0, 0, g?.len || 1000, H, true);
  if (!g) return null;
  const strips = stripsOf(room, wallId, g.len, H);
  const put = (s) => onRoom((r) => setStrips(r, wallId, s));
  const sf = room.stripFinishes?.[wallId] || {};
  const ops = room.openings.filter((o) => o.wallId === wallId);
  const onBg = (e) => {
    const [u, v] = fit.from(...svgPoint(e));
    if (tool === 'h') put({ ...strips, h: [...strips.h, v] });
    if (tool === 'v') put({ ...strips, v: [...strips.v, u] });
  };
  const onMove = (e) => {
    if (!drag) return;
    const [u, v] = fit.from(...svgPoint(e));
    const s = { h: [...strips.h], v: [...strips.v] };
    s[drag.axis][drag.i] = drag.axis === 'h' ? v : u;
    put(s);
  };
  const line = (axis, val, i) => {
    const [x0, y0] = fit.to(axis === 'h' ? [0, val] : [val, 0]);
    const [x1, y1] = fit.to(axis === 'h' ? [g.len, val] : [val, H]);
    return (
      <line key={axis + i} x1={x0} y1={y0} x2={x1} y2={y1} className={`se-strip ${axis}`} data-axis={axis} data-val={Math.round(val)}
        onPointerDown={(e) => {
          e.stopPropagation();
          if (tool === 'del') put({ ...strips, [axis]: strips[axis].filter((_, k) => k !== i) });
          else if (tool === 'sel') { e.currentTarget.ownerSVGElement.setPointerCapture?.(e.pointerId); setDrag({ axis, i }); }
        }} />
    );
  };
  const [ox, oy] = fit.to([0, H]);
  return (
    <div className="menu-backdrop dim">
      <div className="wall-dialog surface-editor strip-editor" role="dialog" aria-label="Editor de franjas">
        <h3>Editor de franjas · Pared {g.i + 1}</h3>
        <div className="se-tools">
          {[['sel', 'Seleccionar/Mover'], ['h', 'Franja horizontal'], ['v', 'Franja vertical'], ['del', 'Quitar']].map(([k, l]) => (
            <button key={k} className={tool === k ? 'active' : ''} onClick={() => setTool(k)}>{l}</button>
          ))}
          <button onClick={() => put({ h: [], v: [] })} title="Saca todas las franjas de la pared">Nuevo</button>
          {onUndo && <button onClick={onUndo} title="Deshacer">↶</button>}
          {onRedo && <button onClick={onRedo} title="Rehacer">↷</button>}
          {onRegions && <button onClick={onRegions}>Editar regiones…</button>}
        </div>
        <svg width={SW} height={SH} className={`se-svg tool-${tool}`} onPointerDown={onBg} onPointerMove={onMove} onPointerUp={() => setDrag(null)}>
          <rect x={ox} y={oy} width={g.len * fit.k} height={H * fit.k} className="se-face" />
          {stripCells(strips, g.len, H).filter((c) => sf[c.id]).map((c) => {
            const [x, y] = fit.to([c.u0, c.v1]);
            return <rect key={c.id} x={x} y={y} width={(c.u1 - c.u0) * fit.k} height={(c.v1 - c.v0) * fit.k} fill={matColor(sf[c.id])} opacity={0.8} />;
          })}
          {ops.map((o) => { const [x, y] = fit.to([o.offset, o.sill + o.height]); return <rect key={o.id} x={x} y={y} width={o.width * fit.k} height={o.height * fit.k} className="se-opening" />; })}
          {strips.h.map((v, i) => line('h', v, i))}
          {strips.v.map((u, i) => line('v', u, i))}
        </svg>
        <div className="se-nums">
          <ListField label="Horizontales (alturas, mm)" value={strips.h} parse={(t) => t.split(/[;,\s]+/).map(Number).filter((x) => Number.isFinite(x))} onChange={(h) => put({ ...strips, h })} />
          <ListField label="Verticales (desde el inicio, mm)" value={strips.v} parse={(t) => t.split(/[;,\s]+/).map(Number).filter((x) => Number.isFinite(x))} onChange={(v) => put({ ...strips, v })} />
        </div>
        <div className="se-presets">
          <select value="" onChange={(e) => { const p = presets.find((x) => x.name === e.target.value); if (p) put({ h: p.h, v: p.v }); }}>
            <option value="">Usar configuración guardada…</option>
            {presets.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
          </select>
          <input placeholder="Nombre" value={name} onChange={(e) => setName(e.target.value)} />
          <button disabled={!name.trim()} onClick={() => { onPresets(saveStripPreset(presets, name, strips)); setName(''); }}>Guardar</button>
          {presets.length > 0 && <select value="" onChange={(e) => e.target.value && onPresets(presets.filter((p) => p.name !== e.target.value))}>
            <option value="">Quitar guardada…</option>
            {presets.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
          </select>}
        </div>
        <p className="hint">Para el material, arrastralo a la pared: con franjas se elige Región, Perfil horizontal, Perfil vertical, Cara o Todo.</p>
        <div className="row-btns"><button className="active" onClick={onClose}>Aceptar</button></div>
      </div>
    </div>
  );
}

// ---------------- Editor de regiones ----------------
export function RegionEditor({ room, surface, onRoom, onUndo, onRedo, onClose }) {
  useEsc(onClose);
  const wall = surface.kind === 'wall' ? roomWalls(room).find((w) => w.id === surface.wallId) : null;
  const H = wall ? Math.max(wall.wall.h0 ?? room.h, wall.wall.h1 ?? room.h) : 0;
  const floor = useMemo(() => (surface.kind === 'floor' ? floorPolygon(room) : null), [room, surface.kind]);
  const box = wall ? [0, 0, wall.len, H] : [Math.min(...floor.map((p) => p[0])), Math.min(...floor.map((p) => p[1])), Math.max(...floor.map((p) => p[0])), Math.max(...floor.map((p) => p[1]))];
  const fit = useFit(...box, !!wall);
  const [tool, setTool] = useState('sel');
  const [sel, setSel] = useState(null);
  const [draft, setDraft] = useState(null); // dibujando: { kind, a, b } o { kind: 'pts', pts }
  const [drag, setDrag] = useState(null); // { id, vi?, last }
  const [amount, setAmount] = useState(50);
  const regs = regionsOn(room, surface);
  const cur = regs.find((r) => r.id === sel) || null;
  const pt = (e) => fit.from(...svgPoint(e));
  const commitAdd = (pts) => { const id = regionId(); onRoom((r) => addRegion(r, surface, pts, null, id).room); setSel(id); };
  const svgRef = useRef(null);

  const onDown = (e) => {
    const p = pt(e);
    svgRef.current?.setPointerCapture?.(e.pointerId);
    if (tool === 'rect' || tool === 'circle') setDraft({ kind: tool, a: p, b: p });
    else if (tool === 'pts') {
      const pts = draft?.pts || [];
      if (pts.length >= 3 && Math.hypot(p[0] - pts[0][0], p[1] - pts[0][1]) * fit.k < 10) { commitAdd(pts); setDraft(null); } else setDraft({ kind: 'pts', pts: [...pts, p] });
    } else if ((tool === 'cutv' || tool === 'cuth') && cur) {
      const parts = cutPolygon(cur.pts, tool === 'cutv' ? 'v' : 'h', tool === 'cutv' ? p[0] : p[1]);
      if (parts.length === 2) onRoom((r) => addRegion(updateRegion(r, cur.id, { pts: parts[0] }), surface, parts[1], cur.finish).room);
    } else if (tool === 'sel') setSel(null);
  };
  const onMove = (e) => {
    const p = pt(e);
    if (draft && draft.kind !== 'pts') setDraft({ ...draft, b: p });
    if (drag) {
      const r = regs.find((x) => x.id === drag.id);
      if (!r) return;
      if (drag.vi != null) onRoom((rm) => updateRegion(rm, r.id, { pts: r.pts.map((q, i) => (i === drag.vi ? p : q)) }));
      else { onRoom((rm) => updateRegion(rm, r.id, { pts: movePolygon(r.pts, p[0] - drag.last[0], p[1] - drag.last[1]) })); setDrag({ ...drag, last: p }); }
    }
  };
  const onUp = () => {
    if (draft && draft.kind === 'rect' && Math.abs(draft.b[0] - draft.a[0]) > 5 && Math.abs(draft.b[1] - draft.a[1]) > 5) commitAdd(rectPts(...draft.a, ...draft.b));
    if (draft && draft.kind === 'circle') { const r = Math.hypot(draft.b[0] - draft.a[0], draft.b[1] - draft.a[1]); if (r > 5) commitAdd(circlePts(...draft.a, r)); }
    if (draft && draft.kind !== 'pts') setDraft(null);
    setDrag(null);
  };
  const regionDown = (e, r) => {
    if (tool !== 'sel' && tool !== 'addv' && tool !== 'delv' && tool !== 'del') return;
    e.stopPropagation();
    if (tool === 'del') { onRoom((rm) => removeRegion(rm, r.id)); setSel(null); return; }
    setSel(r.id);
    if (tool === 'addv') { // nuevo vértice en el lado más cercano al clic
      const p = pt(e);
      let best = 0, bd = Infinity;
      r.pts.forEach((a, i) => { const b = r.pts[(i + 1) % r.pts.length]; const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; const d = Math.hypot(m[0] - p[0], m[1] - p[1]); if (d < bd) { bd = d; best = i; } });
      onRoom((rm) => updateRegion(rm, r.id, { pts: [...r.pts.slice(0, best + 1), p, ...r.pts.slice(best + 1)] }));
      return;
    }
    if (tool === 'sel') { svgRef.current?.setPointerCapture?.(e.pointerId); setDrag({ id: r.id, last: pt(e) }); }
  };
  const vertexDown = (e, r, i) => {
    e.stopPropagation();
    if (tool === 'delv' && r.pts.length > 3) { onRoom((rm) => updateRegion(rm, r.id, { pts: r.pts.filter((_, k) => k !== i) })); return; }
    svgRef.current?.setPointerCapture?.(e.pointerId);
    setDrag({ id: r.id, vi: i });
  };
  const poly = (pts) => pts.map((p) => fit.to(p).join(',')).join(' ');
  const outline = wall ? rectPts(0, 0, wall.len, H) : floor;
  const tools = [['sel', 'Seleccionar/Mover'], ['rect', 'Rectángulo'], ['circle', 'Círculo'], ['pts', 'Por puntos'], ['addv', 'Agregar vértice'], ['delv', 'Quitar vértice'], ['cutv', 'Corte vertical'], ['cuth', 'Corte horizontal'], ['del', 'Quitar']];
  return (
    <div className="menu-backdrop dim">
      <div className="wall-dialog surface-editor region-editor" role="dialog" aria-label="Editor de regiones">
        <h3>Editor de regiones · {wall ? `Pared ${wall.i + 1}` : 'Piso'}</h3>
        <div className="se-tools">
          {tools.map(([k, l]) => <button key={k} className={tool === k ? 'active' : ''} onClick={() => { setTool(k); setDraft(null); }}>{l}</button>)}
          {onUndo && <button onClick={onUndo} title="Deshacer">↶</button>}
          {onRedo && <button onClick={onRedo} title="Rehacer">↷</button>}
        </div>
        <svg ref={svgRef} width={SW} height={SH} className={`se-svg tool-${tool}`} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp}>
          <polygon points={poly(outline)} className="se-face" />
          {wall && room.openings.filter((o) => o.wallId === wall.id).map((o) => <polygon key={o.id} points={poly(rectPts(o.offset, o.sill, o.offset + o.width, o.sill + o.height))} className="se-opening" />)}
          {regs.map((r) => (
            <g key={r.id}>
              <polygon points={poly(r.pts)} className={`se-region${r.id === sel ? ' on' : ''}`} fill={matColor(r.finish) || 'rgba(47,111,223,.15)'} data-region={r.id}
                onPointerDown={(e) => regionDown(e, r)} />
              {r.id === sel && r.pts.length <= 16 && r.pts.map((p, i) => { const [x, y] = fit.to(p); return <rect key={i} x={x - 4} y={y - 4} width={8} height={8} className="se-vertex" onPointerDown={(e) => vertexDown(e, r, i)} />; })}
            </g>
          ))}
          {draft?.kind === 'rect' && <polygon points={poly(rectPts(...draft.a, ...draft.b))} className="se-draft" />}
          {draft?.kind === 'circle' && <polygon points={poly(circlePts(...draft.a, Math.hypot(draft.b[0] - draft.a[0], draft.b[1] - draft.a[1])))} className="se-draft" />}
          {draft?.kind === 'pts' && <polyline points={poly(draft.pts)} className="se-draft" />}
        </svg>
        <div className="se-ops">
          <label>Distancia <input type="number" value={amount} onChange={(e) => setAmount(+e.target.value || 0)} /> mm</label>
          <button disabled={!cur} onClick={() => onRoom((r) => updateRegion(r, cur.id, { pts: offsetPolygon(cur.pts, amount) }))} title="Offset forma: agranda (o achica con negativo) toda la región">Offset forma</button>
          <button disabled={!cur} onClick={() => onRoom((r) => updateRegion(r, cur.id, { pts: chamferPolygon(cur.pts, amount) }))}>Chanfle</button>
          <button disabled={!cur} onClick={() => onRoom((r) => updateRegion(r, cur.id, { pts: filletPolygon(cur.pts, amount) }))}>Filete</button>
          <button disabled={!cur} onClick={() => { const id = regionId(); onRoom((r) => duplicateRegion(r, cur.id, id).room); setSel(id); }}>Duplicar</button>
          <select disabled={!cur} value={cur?.finish?.mat || ''} onChange={(e) => onRoom((r) => updateRegion(r, cur.id, { finish: e.target.value ? { mat: e.target.value, scaleX: 1, scaleY: 1, rot: 0 } : null }))} title="Material de la región">
            <option value="">Sin material</option>
            {ROOM_MATERIALS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </div>
        {tool === 'pts' && <p className="hint">Clic en cada punto; clic en el primero para cerrar la región.</p>}
        <div className="row-btns"><button className="active" onClick={onClose}>Aceptar</button></div>
      </div>
    </div>
  );
}
