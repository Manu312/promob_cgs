import { useState } from 'react';
import { Line } from '@react-three/drei';
import { absAngle } from '../domain/walls.js';
import { segmentEnd } from '../domain/drawWalls.js';
import { CotaLabel } from './Cotas.jsx';

const S = 0.001;
const SNAP_NODE = 150; // mm: imán a esquinas libres

// Herramienta "Construir paredes" en Planta. Un plano invisible por encima de todo toma
// los clics: clic = punto, clic derecho = terminar. Calcula el tramo con los saltos de
// largo/ángulo (Shift = ortogonal) y el imán a esquinas libres; lo deja en `cursorRef`
// para que el teclado use la dirección del mouse.
export function DrawTool({ room, draw, origin, cursorRef, onPoint, onFinish }) {
  const [cur, setCur] = useState(null);
  const cfg = room.draw || { linear: 50, angular: 5 };
  const grid = room.grid?.size || 50;
  const degree = (id) => room.walls.filter((w) => w.n0 === id || w.n1 === id).length;
  const fromNode = draw.fromNodeId && room.nodes.find((n) => n.id === draw.fromNodeId);
  const from = fromNode ? [fromNode.x, fromNode.z] : draw.start;
  const top = (Math.max(room.h, ...room.walls.map((w) => Math.max(w.h0, w.h1))) + 40) * S;

  const compute = (e) => {
    const raw = [e.point.x / S + origin.x, e.point.z / S + origin.z];
    const hit = room.nodes.find((n) => n.id !== draw.fromNodeId && degree(n.id) < 2 && Math.hypot(n.x - raw[0], n.z - raw[1]) <= SNAP_NODE);
    if (!from) return { end: hit ? [hit.x, hit.z] : raw.map((v) => Math.round(v / grid) * grid), nodeId: hit?.id };
    if (hit) {
      const v = [hit.x - from[0], hit.z - from[1]], len = Math.hypot(...v);
      return len ? { end: [hit.x, hit.z], nodeId: hit.id, len, abs: absAngle([v[0] / len, v[1] / len]) } : null;
    }
    const v = [raw[0] - from[0], raw[1] - from[1]], d = Math.hypot(...v);
    if (d < 1) return null;
    const step = e.shiftKey ? 90 : cfg.angular;
    const abs = (Math.round(absAngle([v[0] / d, v[1] / d]) / step) * step) % 360;
    const len = Math.round(d / cfg.linear) * cfg.linear;
    return { end: segmentEnd(from, len, abs), len, abs };
  };
  const onMove = (e) => { const c = compute(e); cursorRef.current = c; setCur(c); };
  const onDown = (e) => {
    e.stopPropagation();
    if ((e.nativeEvent?.button ?? e.button) === 2) { onFinish(); return; }
    const c = compute(e);
    if (c && (!from || c.len > 0)) onPoint(c);
  };

  const p3 = (p) => [p[0] * S, top, p[1] * S];
  return (
    <group>
      <mesh position={[origin.x * S, top + 0.5, origin.z * S]} rotation={[-Math.PI / 2, 0, 0]} onPointerMove={onMove} onPointerDown={onDown}>
        <planeGeometry args={[400, 400]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {from && (
        <mesh position={p3(from)} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.06, 24]} />
          <meshBasicMaterial color="#16a34a" depthTest={false} />
        </mesh>
      )}
      {cur && (
        <mesh position={p3(cur.end)} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.05, 0.08, 24]} />
          <meshBasicMaterial color={cur.nodeId ? '#2563eb' : '#16a34a'} depthTest={false} />
        </mesh>
      )}
      {from && cur?.len > 0 && (
        <>
          <Line points={[p3(from), p3(cur.end)]} color="#16a34a" lineWidth={3} depthTest={false} renderOrder={6} />
          <CotaLabel p={[((from[0] + cur.end[0]) / 2) * S, top, ((from[1] + cur.end[1]) / 2) * S]} value={Math.round(cur.len)}
            text={`${Math.round(cur.len)} · ${Math.round(cur.abs)}°`} className="cota cota-draw" />
        </>
      )}
    </group>
  );
}
