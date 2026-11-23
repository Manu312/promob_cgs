import { useEffect, useMemo, useRef, useState } from 'react';
import { floorPolygon } from '../domain/walls.js';
import { floorGridOf, addFloorVertex, removeFloorVertex } from '../domain/floor.js';

const W = 520, H = 340, PAD = 20;
const useEsc = (fn) => useEffect(() => {
  const k = (e) => { if (e.key === 'Escape') fn(); };
  window.addEventListener('keydown', k);
  return () => window.removeEventListener('keydown', k);
}, [fn]);

// Alterar formato del piso (Promob, Editor de Forma): arrastrar vértices, "+" en un lado agrega
// uno, clic derecho en un vértice lo quita. Al aceptar, el piso deja de seguir a las paredes.
export function FloorShapeEditor({ room, onApply, onClose }) {
  useEsc(onClose);
  const [pts, setPts] = useState(() => floorPolygon(room).map((p) => [...p]));
  const [drag, setDrag] = useState(null);
  const svgRef = useRef(null);
  const fit = useMemo(() => {
    const xs = [...pts.map((p) => p[0]), ...room.nodes.map((n) => n.x)], zs = [...pts.map((p) => p[1]), ...room.nodes.map((n) => n.z)];
    const x0 = Math.min(...xs) - 300, z0 = Math.min(...zs) - 300, x1 = Math.max(...xs) + 300, z1 = Math.max(...zs) + 300;
    const k = Math.min((W - 2 * PAD) / (x1 - x0), (H - 2 * PAD) / (z1 - z0));
    return { k, to: ([x, z]) => [PAD + (x - x0) * k, PAD + (z - z0) * k], from: (sx, sy) => [x0 + (sx - PAD) / k, z0 + (sy - PAD) / k] };
  }, [room]); // eslint-disable-line react-hooks/exhaustive-deps
  const at = (e) => { const r = svgRef.current.getBoundingClientRect(); return fit.from(e.clientX - r.left, e.clientY - r.top); };
  const walls = room.walls.map((w) => [room.nodes.find((n) => n.id === w.n0), room.nodes.find((n) => n.id === w.n1)]).filter(([a, b]) => a && b);
  return (
    <div className="menu-backdrop dim">
      <div className="wall-dialog floor-editor" role="dialog" aria-label="Forma del piso">
        <h3>Forma del piso</h3>
        <svg ref={svgRef} width={W} height={H} className="se-svg" onPointerMove={(e) => { if (drag != null) { const p = at(e); setPts((ps) => ps.map((q, i) => (i === drag ? [Math.round(p[0] / 10) * 10, Math.round(p[1] / 10) * 10] : q))); } }} onPointerUp={() => setDrag(null)}>
          {walls.map(([a, b], i) => { const [x0, y0] = fit.to([a.x, a.z]), [x1, y1] = fit.to([b.x, b.z]); return <line key={i} x1={x0} y1={y0} x2={x1} y2={y1} className="fe-wall" />; })}
          <polygon points={pts.map((p) => fit.to(p).join(',')).join(' ')} className="fe-floor" />
          {pts.map((p, i) => {
            const q = pts[(i + 1) % pts.length];
            const [mx, my] = fit.to([(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]);
            return <g key={'m' + i} className="fe-add" onPointerDown={(e) => { e.stopPropagation(); setPts((ps) => addFloorVertex(ps, i)); }}><circle cx={mx} cy={my} r={7} /><text x={mx} y={my + 4} textAnchor="middle">+</text></g>;
          })}
          {pts.map((p, i) => { const [x, y] = fit.to(p); return <rect key={i} x={x - 5} y={y - 5} width={10} height={10} className="se-vertex fe-vertex" data-i={i}
            onPointerDown={(e) => { e.stopPropagation(); if (e.button === 0) { svgRef.current.setPointerCapture?.(e.pointerId); setDrag(i); } }}
            onContextMenu={(e) => { e.preventDefault(); setPts((ps) => removeFloorVertex(ps, i)); }} />; })}
        </svg>
        <p className="hint">Arrastrá los vértices; “+” agrega uno en ese lado; clic derecho en un vértice lo quita. Las paredes se ven en gris.</p>
        <div className="row-btns">
          <button onClick={onClose}>Cancelar</button>
          <button className="active" onClick={() => { onApply(pts); onClose(); }}>Aceptar</button>
        </div>
      </div>
    </div>
  );
}

// Editar grilla del piso (Promob, Editor de Grid): atraer, gap e intervalos.
export function FloorGridEditor({ room, onChange, onClose }) {
  useEsc(onClose);
  const g = floorGridOf(room);
  const num = (label, k) => (
    <label className="field"><span>{label}</span><span className="numwrap">
      <input type="number" value={g[k]} onChange={(e) => onChange({ [k]: +e.target.value || 0 })} /><em>mm</em></span></label>
  );
  return (
    <div className="menu-backdrop dim">
      <div className="wall-dialog floor-grid-editor" role="dialog" aria-label="Grilla del piso">
        <h3>Grilla del piso</h3>
        <label className="check"><input type="checkbox" checked={g.show} onChange={(e) => onChange({ show: e.target.checked })} /> Mostrar la grilla</label>
        <label className="check"><input type="checkbox" checked={g.attract} onChange={(e) => onChange({ attract: e.target.checked })} /> Atraer (los módulos se pegan a las líneas)</label>
        {num('Gap', 'gap')}
        {num('Intervalo horizontal', 'ix')}
        {num('Intervalo vertical', 'iz')}
        <div className="row-btns"><button className="active" onClick={onClose}>Cerrar</button></div>
      </div>
    </div>
  );
}
