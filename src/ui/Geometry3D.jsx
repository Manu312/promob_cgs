import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { roomWalls } from '../domain/room.js';
import { outlineOf } from '../domain/geometry.js';
import { finishMaterial } from './roomTextures.js';

const S = 0.001;
const colorMats = new Map();
const colorMat = (c, sel) => {
  const k = `${c}|${sel ? 1 : 0}`;
  if (!colorMats.has(k)) colorMats.set(k, new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, side: THREE.DoubleSide, ...(sel ? { emissive: '#1d4ed8', emissiveIntensity: 0.25 } : {}) }));
  return colorMats.get(k);
};
const draftMat = new THREE.MeshStandardMaterial({ color: '#22c55e', transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide });

// Marco del plano de construcción: piso (y del afastamiento), tapa de un módulo o cara interior de una pared.
export function planeFrame(g, room, modules) {
  if (g.plane.kind === 'wall') {
    const w = roomWalls(room).find((x) => x.id === g.plane.wallId);
    if (!w) return null;
    const outSign = w.n[0] * -w.u[1] + w.n[1] * w.u[0];
    const inward = outSign >= 0 ? -1 : 1; // hacia adentro del ambiente, en z local de la pared
    return { kind: 'wall', position: [w.a[0] * S, (w.wall.floorGap || 0) * S, w.a[1] * S], rotation: [0, Math.atan2(-w.u[1], w.u[0]), 0], inward, gap: w.wall.floorGap || 0 };
  }
  let y = 0;
  if (g.plane.kind === 'module') {
    const m = modules.find((x) => x.id === g.plane.id);
    y = m ? (m.y || 0) + m.params.height + (m.params.mesada === 'si' ? m.params.mesadaT || 0 : 0) : g.plane.y || 0;
  }
  return { kind: 'floor', y };
}

// Una geometría extruida sobre su plano. `draft` = vista previa mientras se construye.
export function GeometryMesh({ g, room, modules, selected, draft, onDown, onMenu }) {
  const f = planeFrame(g, room, modules);
  const pts = outlineOf(g);
  const key = JSON.stringify([pts, g.height, f?.kind, f?.gap]);
  const geo = useMemo(() => {
    if (!f || pts.length < 3) return null;
    const shape = new THREE.Shape(pts.map(([a, b]) => (f.kind === 'wall' ? new THREE.Vector2(a * S, (b - f.gap) * S) : new THREE.Vector2(a * S, -b * S))));
    return new THREE.ExtrudeGeometry(shape, { depth: Math.max(1, g.height || 1) * S, bevelEnabled: false });
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => geo?.dispose(), [geo]);
  if (!geo || g.visible === false) return null;
  const mat = draft ? draftMat : (g.finish ? finishMaterial(g.finish, 1000, 1000, { side: THREE.DoubleSide }) : colorMat(g.color || '#c9c4ba', selected));
  const handlers = draft ? { raycast: () => null } : {
    onPointerDown: onDown ? (e) => onDown(e, g) : undefined,
    onContextMenu: onMenu ? (e) => onMenu(e, g) : undefined,
  };
  if (f.kind === 'wall') {
    return (
      <group position={f.position} rotation={f.rotation}>
        <mesh geometry={geo} material={mat} position={[0, 0, f.inward * (g.offset || 0) * S]} scale={[1, 1, f.inward]} castShadow receiveShadow userData={{ geometryId: g.id }} {...handlers} />
      </group>
    );
  }
  return <mesh geometry={geo} material={mat} rotation={[-Math.PI / 2, 0, 0]} position={[0, (f.y + (g.offset || 0)) * S, 0]} castShadow receiveShadow userData={{ geometryId: g.id }} {...handlers} />;
}
