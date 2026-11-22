import { useMemo, useState } from 'react';
import { Html, Line } from '@react-three/drei';
import { nearestDistances, verticalDistances, heightRuler } from '../domain/dimensions.js';
import { bounds } from '../domain/walls.js';
import { roomWalls } from '../domain/room.js';
import { openingDims } from '../domain/openings.js';
import { annotationValue } from '../domain/annotations.js';

const S = 0.001;

// Contenido de la etiqueta. Tiene que tener su propio estado: drei <Html> lo renderiza
// en otra raíz de React, y un input controlado con estado en la raíz de afuera pierde teclas.
function CotaContent({ value, text, onCommit, onSelect, className }) {
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
    <div className={`${className}${onCommit ? ' editable' : ''}${onSelect ? ' selectable' : ''}`} title={onCommit ? 'Clic para escribir la medida' : onSelect ? 'Clic para seleccionar (Supr la borra)' : undefined}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={() => { if (onSelect && !onCommit) { onSelect(); return; } if (!onCommit) return; setS(String(value)); setEdit(true); }}>
      {text ?? value}
    </div>
  );
}

// Etiqueta de cota. Con `onCommit` es editable: clic → escribir → Enter (Esc cancela).
export function CotaLabel({ p, value, text, onCommit, onSelect, className = 'cota' }) {
  return (
    <Html position={p} center zIndexRange={[20, 0]} style={{ pointerEvents: onCommit || onSelect ? 'auto' : 'none' }}>
      <CotaContent value={value} text={text} onCommit={onCommit} onSelect={onSelect} className={className} />
    </Html>
  );
}

// Cotas de referencia del módulo seleccionado: distancia a pared, columna o módulo
// más cercano en cada dirección. Editables: mueven el módulo.
export function ModuleDistances({ room, modules, mod, onEdit, vertical = true }) {
  const dims = useMemo(() => nearestDistances(mod, room, modules), [mod, room, modules]);
  const vdims = useMemo(() => (vertical ? verticalDistances(mod, room, modules) : []), [mod, room, modules, vertical]);
  const y = ((mod.y || 0) + Math.min(mod.params.height / 2, 450)) * S;
  const vert = vdims.map((d) => {
    const [x, z] = [d.at[0] * S, d.at[1] * S];
    const a = [x, d.y0 * S, z], b = [x, d.y1 * S, z];
    const tick = (q) => [[q[0] - 0.05, q[1], q[2]], [q[0] + 0.05, q[1], q[2]]];
    return (
      <group key={d.dir}>
        <Line points={[a, b]} color="#e4572e" lineWidth={1.6} depthTest={false} renderOrder={5} />
        <Line points={tick(a)} color="#e4572e" lineWidth={1.6} depthTest={false} renderOrder={5} />
        <Line points={tick(b)} color="#e4572e" lineWidth={1.6} depthTest={false} renderOrder={5} />
        <CotaLabel p={[x, ((d.y0 + d.y1) / 2) * S, z]} value={d.dist} className={`cota cota-dist cota-vert cota-${d.dir}`} onCommit={onEdit ? (v) => onEdit(d, v) : undefined} />
      </group>
    );
  });
  return [...vert, ...dims.map((d) => {
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
  })];
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

// Regla de alturas (vista Frente): línea vertical junto a la pared del fondo con las
// alturas de referencia (azul) y la base/tope de los módulos (gris), como en Promob.
export function HeightRuler({ room, modules }) {
  const marks = useMemo(() => heightRuler(room, modules), [room, modules]);
  const b = bounds(room);
  const x = (b.minX + 120) * S, z = (b.minZ + 40) * S;
  const top = Math.max(room.h, ...marks.map((m) => m.h)) * S;
  return (
    <group>
      <Line points={[[x, 0, z], [x, top, z]]} color="#1e3a8a" lineWidth={1.4} depthTest={false} renderOrder={5} />
      {marks.map((m) => (
        <group key={m.h}>
          <Line points={[[x - 0.06, m.h * S, z], [x + 0.12, m.h * S, z]]} color={m.kind === 'ref' ? '#1e3a8a' : '#6b7280'} lineWidth={1.4} depthTest={false} renderOrder={5} />
          <CotaLabel p={[x + 0.24, m.h * S, z]} value={m.h} className={`cota cota-ruler${m.kind === 'ref' ? '' : ' mod'}`} />
        </group>
      ))}
    </group>
  );
}

// Cotas manuales guardadas en el proyecto. Clic en la etiqueta = seleccionarla (Supr la borra).
export function Annotations({ annotations, selectedId, onSelect }) {
  const y = 0.03;
  const p3 = (p) => [p[0] * S, y, p[1] * S];
  return annotations.map((a) => {
    const v = annotationValue(a);
    const cls = `cota cota-man${a.id === selectedId ? ' sel' : ''}`;
    const color = a.id === selectedId ? '#f59e0b' : '#0f766e';
    if (a.kind === 'lin') {
      const [p0, p1] = a.points;
      const d = [p1[0] - p0[0], p1[1] - p0[1]], L = Math.hypot(...d) || 1;
      const n = [(-d[1] / L) * 70, (d[0] / L) * 70];
      const tick = (p) => [p3([p[0] - n[0], p[1] - n[1]]), p3([p[0] + n[0], p[1] + n[1]])];
      return (
        <group key={a.id}>
          <Line points={[p3(p0), p3(p1)]} color={color} lineWidth={1.6} depthTest={false} renderOrder={5} />
          <Line points={tick(p0)} color={color} lineWidth={1.6} depthTest={false} renderOrder={5} />
          <Line points={tick(p1)} color={color} lineWidth={1.6} depthTest={false} renderOrder={5} />
          <CotaLabel p={p3([(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2])} value={v} className={cls} onSelect={() => onSelect?.(a.id)} />
        </group>
      );
    }
    const [p0, c, p2] = a.points;
    const ang = (p) => Math.atan2(p[1] - c[1], p[0] - c[0]);
    let t0 = ang(p0), t1 = ang(p2);
    let dt = t1 - t0;
    while (dt > Math.PI) dt -= 2 * Math.PI;
    while (dt < -Math.PI) dt += 2 * Math.PI;
    const arc = Array.from({ length: 17 }, (_, i) => p3([c[0] + Math.cos(t0 + (dt * i) / 16) * 300, c[1] + Math.sin(t0 + (dt * i) / 16) * 300]));
    const mid = t0 + dt / 2;
    return (
      <group key={a.id}>
        <Line points={[p3(p0), p3(c), p3(p2)]} color={color} lineWidth={1.4} depthTest={false} renderOrder={5} />
        <Line points={arc} color={color} lineWidth={1.6} depthTest={false} renderOrder={5} />
        <CotaLabel p={p3([c[0] + Math.cos(mid) * 460, c[1] + Math.sin(mid) * 460])} value={v} text={`${v}°`} className={cls} onSelect={() => onSelect?.(a.id)} />
      </group>
    );
  });
}
