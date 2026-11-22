import { useMemo, useState } from 'react';
import { Html, Line } from '@react-three/drei';
import { nearestDistances } from '../domain/dimensions.js';
import { roomWalls } from '../domain/room.js';
import { openingDims } from '../domain/openings.js';

const S = 0.001;

// Contenido de la etiqueta. Tiene que tener su propio estado: drei <Html> lo renderiza
// en otra raíz de React, y un input controlado con estado en la raíz de afuera pierde teclas.
function CotaContent({ value, text, onCommit, className }) {
  const [edit, setEdit] = useState(false);
  const [s, setS] = useState('');
  const commit = () => {
    const v = Number(String(s).replace(',', '.'));
    setEdit(false);
    if (s !== '' && Number.isFinite(v) && v >= 0 && v !== value) onCommit(v);
  };
  if (edit) {
    return (
      <input className="cota-input" autoFocus value={s} onFocus={(e) => e.target.select()}
        onChange={(e) => setS(e.target.value)} onBlur={() => setEdit(false)}
        onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEdit(false); }} />
    );
  }
  return (
    <div className={`${className}${onCommit ? ' editable' : ''}`} title={onCommit ? 'Clic para escribir la medida' : undefined}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={() => { if (!onCommit) return; setS(String(value)); setEdit(true); }}>
      {text ?? value}
    </div>
  );
}

// Etiqueta de cota. Con `onCommit` es editable: clic → escribir → Enter (Esc cancela).
export function CotaLabel({ p, value, text, onCommit, className = 'cota' }) {
  return (
    <Html position={p} center zIndexRange={[20, 0]} style={{ pointerEvents: onCommit ? 'auto' : 'none' }}>
      <CotaContent value={value} text={text} onCommit={onCommit} className={className} />
    </Html>
  );
}

// Cotas de referencia del módulo seleccionado: distancia a pared, columna o módulo
// más cercano en cada dirección. Editables: mueven el módulo.
export function ModuleDistances({ room, modules, mod, onEdit }) {
  const dims = useMemo(() => nearestDistances(mod, room, modules), [mod, room, modules]);
  const y = ((mod.y || 0) + Math.min(mod.params.height / 2, 450)) * S;
  return dims.map((d) => {
    const a = [d.from[0] * S, y, d.from[1] * S], b = [d.to[0] * S, y, d.to[1] * S];
    const ux = Math.sign(d.to[0] - d.from[0]), uz = Math.sign(d.to[1] - d.from[1]);
    const px = -uz * 0.06, pz = ux * 0.06; // marca perpendicular de 60 mm
    const tick = (q) => [[q[0] - px, y, q[2] - pz], [q[0] + px, y, q[2] + pz]];
    const mid = [(a[0] + b[0]) / 2, y, (a[2] + b[2]) / 2];
    return (
      <group key={d.dir}>
        <Line points={[a, b]} color="#e4572e" lineWidth={1.6} depthTest={false} renderOrder={5} />
        <Line points={tick(a)} color="#e4572e" lineWidth={1.6} depthTest={false} renderOrder={5} />
        <Line points={tick(b)} color="#e4572e" lineWidth={1.6} depthTest={false} renderOrder={5} />
        <CotaLabel p={mid} value={d.dist} className="cota cota-dist" onCommit={onEdit ? (v) => onEdit(d, v) : undefined} />
      </group>
    );
  });
}

// Cotas de la abertura seleccionada: distancia a cada extremo de su pared (editables).
export function OpeningDims({ room, id, onEdit }) {
  const o = room.openings.find((x) => x.id === id);
  const g = o && roomWalls(room).find((w) => w.id === o.wallId);
  if (!g) return null;
  const d = openingDims(room, id);
  const y = 0.02;
  const P = (s) => [(g.a[0] + g.u[0] * s - g.n[0] * 180) * S, y, (g.a[1] + g.u[1] * s - g.n[1] * 180) * S];
  const segs = [['start', 0, o.offset, d.start], ['end', o.offset + o.width, g.len, d.end]].filter(([, s0, s1]) => s1 - s0 >= 1);
  return segs.map(([k, s0, s1, val]) => (
    <group key={k}>
      <Line points={[P(s0), P(s1)]} color="#e4572e" lineWidth={1.6} depthTest={false} renderOrder={5} />
      <CotaLabel p={P((s0 + s1) / 2)} value={val} className="cota cota-dist" onCommit={onEdit ? (v) => onEdit(id, k, v) : undefined} />
    </group>
  ));
}
