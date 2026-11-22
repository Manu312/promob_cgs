import { useState } from 'react';
import { Line } from '@react-three/drei';
import { snapPoint, annotationValue } from '../domain/annotations.js';
import { CotaLabel } from './Cotas.jsx';

const S = 0.001;

// Herramienta de cotas manuales (Planta): lineal = 2 clics, angular = 3 clics (brazo,
// vértice, brazo). Imán a esquinas y caras de paredes, módulos y columnas.
export function AnnotateTool({ room, modules, tool, origin, onPoint, onFinish }) {
  const [cur, setCur] = useState(null);
  const grid = room.grid?.size || 50;
  const top = (Math.max(room.h, ...room.walls.map((w) => Math.max(w.h0, w.h1))) + 60) * S;
  const snap = (e) => snapPoint(room, modules, [e.point.x / S + origin.x, e.point.z / S + origin.z], { grid });
  const onMove = (e) => setCur(snap(e));
  const onDown = (e) => {
    e.stopPropagation();
    if ((e.nativeEvent?.button ?? e.button) === 2) { onFinish(); return; }
    onPoint(snap(e).point);
  };
  const p3 = (p) => [p[0] * S, top, p[1] * S];
  const pts = cur ? [...tool.points, cur.point] : tool.points;
  const preview = tool.mode === 'lin' ? pts.length === 2 : pts.length === 3;
  return (
    <group>
      <mesh position={[origin.x * S, top + 0.5, origin.z * S]} rotation={[-Math.PI / 2, 0, 0]} onPointerMove={onMove} onPointerDown={onDown}>
        <planeGeometry args={[400, 400]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {pts.length >= 2 && <Line points={pts.map(p3)} color="#0f766e" lineWidth={2} dashed dashSize={0.06} gapSize={0.04} depthTest={false} renderOrder={6} />}
      {preview && <CotaLabel p={p3(tool.mode === 'lin' ? [(pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2] : pts[1])}
        value={annotationValue({ kind: tool.mode, points: pts })} text={tool.mode === 'lin' ? undefined : `${annotationValue({ kind: 'ang', points: pts })}°`} className="cota cota-man" />}
      {cur && (
        <mesh position={p3(cur.point)} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.04, 0.07, 24]} />
          <meshBasicMaterial color={cur.kind === 'vertex' ? '#7c3aed' : cur.kind === 'edge' ? '#2563eb' : '#0f766e'} depthTest={false} />
        </mesh>
      )}
    </group>
  );
}
