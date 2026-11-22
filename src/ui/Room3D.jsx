import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import { roomWalls, wallPieces } from '../domain/room.js';
import { wallCorners, floorPolygon, wallFacesCamera } from '../domain/walls.js';
import { footprint } from '../domain/modules.js';
import { CotaLabel } from './Cotas.jsx';
import { wallDims } from '../domain/dimensions.js';

const S = 0.001;
const wallMat = new THREE.MeshStandardMaterial({ color: '#eeebe5', roughness: 0.95 });
const wallSelMat = new THREE.MeshStandardMaterial({ color: '#bcd3f7', roughness: 0.9, emissive: '#1d4ed8', emissiveIntensity: 0.08 });
// Pared transparente: se ve translúcida y deja ver los módulos (como "Transparente" en Promob).
const wallTransMat = new THREE.MeshStandardMaterial({ color: '#eeebe5', roughness: 0.95, transparent: true, opacity: 0.22, depthWrite: false });
const wallSelTransMat = new THREE.MeshStandardMaterial({ color: '#bcd3f7', roughness: 0.9, transparent: true, opacity: 0.35, depthWrite: false });
const floorMat = new THREE.MeshStandardMaterial({ color: '#d8d1c4', roughness: 0.9 });
const frameMat = new THREE.MeshStandardMaterial({ color: '#f7f7f5', roughness: 0.5 });
const glassMat = new THREE.MeshStandardMaterial({ color: '#cfe6f3', roughness: 0.05, metalness: 0, transparent: true, opacity: 0.28 });
const doorMat = new THREE.MeshStandardMaterial({ color: '#c9b49a', roughness: 0.6 });
const frameSelMat = new THREE.MeshStandardMaterial({ color: '#7fa8f0', roughness: 0.5 });
const colSelMat = new THREE.MeshStandardMaterial({ color: '#bcd3f7', roughness: 0.9 });
// Volumen invisible que toma el clic de una abertura (también de un vano sin marco).
const pickMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });

const Box = ({ c, s, m }) => (
  <mesh position={c} material={m} castShadow receiveShadow>
    <boxGeometry args={s} />
  </mesh>
);

// Ventana / puerta dentro del vano, en coordenadas de pared (mm): u a lo largo, v alto, zc centro de espesor.
function Opening({ o, T, zc, selected, onDown }) {
  const F = 50; // ancho de marco
  const u0 = o.offset, u1 = o.offset + o.width, v0 = o.sill, v1 = o.sill + o.height;
  const cu = (u0 + u1) / 2, cv = (v0 + v1) / 2;
  const pick = onDown && (
    <mesh position={[cu * S, cv * S, zc * S]} material={pickMat} onPointerDown={onDown} userData={{ openingPick: o.id }}>
      <boxGeometry args={[o.width * S, o.height * S, (T + 40) * S]} />
    </mesh>
  );
  if (o.type === 'paso') return <group>{pick}</group>;
  const frame = [
    { c: [u0 + F / 2, cv, zc], s: [F, o.height, T] },
    { c: [u1 - F / 2, cv, zc], s: [F, o.height, T] },
    { c: [cu, v1 - F / 2, zc], s: [o.width, F, T] },
  ];
  if (o.type === 'ventana') frame.push({ c: [cu, v0 + F / 2, zc], s: [o.width, F, T] }, { c: [cu, cv, zc], s: [F * 0.6, o.height - 2 * F, 60] });
  return (
    <group>
      {pick}
      {frame.map((f, i) => <Box key={i} c={f.c.map((v) => v * S)} s={f.s.map((v) => v * S)} m={selected ? frameSelMat : frameMat} />)}
      {o.type === 'ventana'
        ? <Box c={[cu * S, cv * S, zc * S]} s={[(o.width - 2 * F) * S, (o.height - 2 * F) * S, 0.006]} m={glassMat} />
        : <Box c={[cu * S, (v0 + (o.height - F) / 2) * S, zc * S]} s={[(o.width - 2 * F) * S, (o.height - F) * S, 0.04]} m={doorMat} />}
    </group>
  );
}

// Pared con alto inicial ≠ final: perfil trapezoidal (en coordenadas de pared) extruido
// en el espesor, con los vanos de las aberturas como agujeros.
function SlopedWall({ len, h0, h1, T, zc, openings, material }) {
  const geo = useMemo(() => {
    const sh = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(len * S, 0), new THREE.Vector2(len * S, h1 * S), new THREE.Vector2(0, h0 * S)]);
    const top = Math.min(h0, h1);
    for (const o of openings) {
      const v1 = Math.min(o.sill + o.height, top - 1);
      if (v1 <= o.sill) continue;
      sh.holes.push(new THREE.Path([
        new THREE.Vector2(o.offset * S, o.sill * S), new THREE.Vector2((o.offset + o.width) * S, o.sill * S),
        new THREE.Vector2((o.offset + o.width) * S, v1 * S), new THREE.Vector2(o.offset * S, v1 * S),
      ]));
    }
    return new THREE.ExtrudeGeometry(sh, { depth: T * S, bevelEnabled: false });
  }, [len, h0, h1, T, openings]);
  useEffect(() => () => geo.dispose(), [geo]);
  return <mesh geometry={geo} position={[0, 0, (zc - T / 2) * S]} material={material} castShadow receiveShadow />;
}


function Wall({ w, prev, origin, openings, autoHide, lowerH = 100, selected, onDown: onWallDown, onMenu, selectedOpeningId, onOpeningDown }) {
  const ref = useRef();
  const W = w.wall;
  const T = w.t;
  const gap = W.floorGap || 0; // la separación del piso eleva toda la pared
  // Auto Rebajar: la pared que tapa la vista baja a zócalo (estado que cambia solo cuando hace falta).
  const [autoLow, setAutoLow] = useState(false);
  const lowered = W.lowered || autoLow;
  const h0 = (lowered ? Math.min(lowerH, W.h0) : W.h0) - gap, h1 = (lowered ? Math.min(lowerH, W.h1) : W.h1) - gap;
  const H = Math.max(h0, h1);
  const ops = lowered ? [] : openings;
  const mat = W.transparent ? (selected ? wallSelTransMat : wallTransMat) : (selected ? wallSelMat : wallMat);
  const theta = Math.atan2(-w.u[1], w.u[0]);
  // Eje z local del grupo rotado = (-uz, ux). El espesor va hacia el lado de la normal exterior.
  const outSign = w.n[0] * -w.u[1] + w.n[1] * w.u[0];
  const zc = (outSign >= 0 ? 1 : -1) * (T / 2);
  const sloped = h0 !== h1;
  const pieces = useMemo(() => (sloped ? [] : wallPieces(w.len, H, ops)), [sloped, w.len, H, ops]);
  useFrame(({ camera }) => {
    const low = autoHide && wallFacesCamera(w, [camera.position.x / S + origin.x, camera.position.z / S + origin.z]);
    if (low !== autoLow) setAutoLow(low);
  });
  useEffect(() => { // solo en desarrollo: los tests e2e consultan qué paredes están rebajadas
    if (import.meta.env?.DEV) (window.__mueblesLowered ||= {})[w.id] = lowered;
  }, [w.id, lowered]);
  // Solo toma el clic si se ve (una pared con Visible = No ni se dibuja).
  const onDown = (e) => {
    if (!onWallDown || !ref.current?.visible) return;
    e.stopPropagation();
    onWallDown(e, w);
  };
  return (
    <group ref={ref} position={[w.a[0] * S, gap * S, w.a[1] * S]} rotation={[0, theta, 0]} onPointerDown={onDown}
      onContextMenu={(e) => { if (!onMenu || !ref.current?.visible) return; e.stopPropagation(); onMenu(e, w); }}>
      {sloped
        ? <SlopedWall len={w.len} h0={h0} h1={h1} T={T} zc={zc} openings={ops} material={mat} />
        : pieces.map((p, i) => (
          <Box key={i} c={[((p.u0 + p.u1) / 2) * S, ((p.v0 + p.v1) / 2) * S, zc * S]} s={[(p.u1 - p.u0) * S, (p.v1 - p.v0) * S, T * S]} m={mat} />
        ))}
      {ops.map((o) => (
        <Opening key={o.id} o={o} T={T} zc={zc} selected={o.id === selectedOpeningId}
          onDown={onOpeningDown ? (e) => { if (!ref.current?.visible) return; e.stopPropagation(); onOpeningDown(e, o, w); } : null} />
      ))}
      {/* Encuentro con la pared que llega a este vértice (esquina), en coordenadas locales de esta pared */}
      {prev && (() => {
        const ox = ((w.n[0] + prev.n[0]) * T) / 2, oz = ((w.n[1] + prev.n[1]) * T) / 2;
        const lu = ox * w.u[0] + oz * w.u[1], lz = ox * -w.u[1] + oz * w.u[0];
        return <Box c={[lu * S, (h0 / 2) * S, lz * S]} s={[T * S, h0 * S, T * S]} m={mat} />;
      })()}
    </group>
  );
}

export function Room3D({ room, origin, autoHide = true, selectedWallId, onWallDown, onWallMenu, selectedOpeningId, onOpeningDown, selectedColumnId, onColumnDown }) {
  const walls = useMemo(() => roomWalls(room).filter((w) => w.wall.visible), [room]);
  // Esquina de cada pared: la pared que llega a su vértice de inicio.
  const incomingOf = useMemo(() => new Map(wallCorners(room).map((c) => [c.outgoing.id, c.incoming])), [room]);
  const floorPts = useMemo(() => floorPolygon(room), [room]);
  const floorGeo = useMemo(() => {
    const shape = new THREE.Shape(floorPts.map(([x, z]) => new THREE.Vector2(x * S, -z * S)));
    return new THREE.ShapeGeometry(shape);
  }, [floorPts]);
  const H = room.h;
  return (
    <group>
      <mesh geometry={floorGeo} rotation={[-Math.PI / 2, 0, 0]} material={floorMat} receiveShadow />
      {walls.map((w) => (
        <Wall key={w.id} w={w} prev={incomingOf.get(w.id)} origin={origin}
          openings={room.openings.filter((o) => o.wallId === w.id)} autoHide={autoHide} lowerH={room.lowerH}
          selected={w.id === selectedWallId} onDown={onWallDown} onMenu={onWallMenu}
          selectedOpeningId={selectedOpeningId} onOpeningDown={onOpeningDown} />
      ))}
      {room.columns.map((c) => (
        <mesh key={c.id} position={[(c.x + c.w / 2) * S, (H / 2) * S, (c.z + c.d / 2) * S]} material={c.id === selectedColumnId ? colSelMat : wallMat}
          castShadow receiveShadow onPointerDown={onColumnDown ? (e) => { e.stopPropagation(); onColumnDown(e, c); } : undefined}>
          <boxGeometry args={[c.w * S, H * S, c.d * S]} />
        </mesh>
      ))}
    </group>
  );
}

const Label = ({ p, children, small }) => (
  <Html position={p} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
    <div className={small ? 'cota cota-mod' : 'cota'}>{children}</div>
  </Html>
);

// Cotas: largo de cada pared (por fuera, editable) y ancho de cada módulo.
export function Dimensions({ room, modules, onWallLength, onWallAngle }) {
  const walls = useMemo(() => roomWalls(room), [room]);
  const angular = useMemo(() => wallDims(room).angular, [room]);
  const y = 0.01;
  return (
    <group>
      {walls.map((w) => {
        const off = w.t + 250;
        const a = [w.a[0] + w.n[0] * off, w.a[1] + w.n[1] * off], b = [w.b[0] + w.n[0] * off, w.b[1] + w.n[1] * off];
        const tick = (p) => [[(p[0] - w.n[0] * 80) * S, y, (p[1] - w.n[1] * 80) * S], [(p[0] + w.n[0] * 80) * S, y, (p[1] + w.n[1] * 80) * S]];
        return (
          <group key={w.i}>
            <Line points={[[a[0] * S, y, a[1] * S], [b[0] * S, y, b[1] * S]]} color="#2f6fdf" lineWidth={1.2} />
            <Line points={tick(a)} color="#2f6fdf" lineWidth={1.2} />
            <Line points={tick(b)} color="#2f6fdf" lineWidth={1.2} />
            <CotaLabel p={[((a[0] + b[0]) / 2) * S, y, ((a[1] + b[1]) / 2) * S]} value={w.len} text={`P${w.i + 1} · ${w.len}`}
              onCommit={onWallLength ? (v) => onWallLength(w.id, v) : undefined} />
          </group>
        );
      })}
      {/* Cotas angulares en cada esquina (editables: giran la pared que sale de la esquina) */}
      {angular.map((c) => (
        <group key={'ang' + c.nodeId}>
          <Line points={c.arc.map(([x, z]) => [x * S, y, z * S])} color="#7c3aed" lineWidth={1.2} />
          <CotaLabel p={[c.label[0] * S, y, c.label[1] * S]} value={c.deg} text={`${Math.round(c.deg * 10) / 10}°`} className="cota cota-ang"
            onCommit={onWallAngle ? (v) => onWallAngle(c.wallId, v) : undefined} />
        </group>
      ))}
      {modules.map((m) => {
        const { fw, fd } = footprint(m);
        return <Label key={m.id} small p={[(m.x + fw / 2) * S, ((m.y || 0) + m.params.height + 60) * S, (m.z + fd / 2) * S]}>{m.params.width}</Label>;
      })}
    </group>
  );
}
