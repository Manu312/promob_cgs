import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { gridLines } from '../domain/grid.js';
import { bounds } from '../domain/walls.js';

const S = 0.001;
const Y = 0.003; // apenas sobre el piso

function linesGeometry(g, pick) {
  const pos = [];
  const { x0, x1, z0, z1 } = g.range;
  for (const l of g.xs) if (pick(l)) pos.push(l.v * S, Y, z0 * S, l.v * S, Y, z1 * S);
  for (const l of g.zs) if (pick(l)) pos.push(x0 * S, Y, l.v * S, x1 * S, Y, l.v * S);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return geo;
}

// Grilla de la vista Planta en coordenadas del ambiente (mm): línea fina cada `size`, marcada cada metro.
export function PlanGrid({ room }) {
  const b = bounds(room);
  const size = room.grid?.size || 50;
  const { minor, major } = useMemo(() => {
    const g = gridLines(b, size, 1500);
    return { minor: linesGeometry(g, (l) => !l.major), major: linesGeometry(g, (l) => l.major) };
  }, [b.minX, b.minZ, b.maxX, b.maxZ, size]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { minor.dispose(); major.dispose(); }, [minor, major]);
  return (
    <group>
      <lineSegments geometry={minor} renderOrder={1}>
        <lineBasicMaterial color="#8d97a3" transparent opacity={0.3} depthWrite={false} />
      </lineSegments>
      <lineSegments geometry={major} renderOrder={1}>
        <lineBasicMaterial color="#5b6673" transparent opacity={0.55} depthWrite={false} />
      </lineSegments>
    </group>
  );
}
