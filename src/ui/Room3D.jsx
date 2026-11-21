import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import { roomWalls, wallPieces } from '../domain/room.js';
import { footprint } from '../domain/modules.js';

const S = 0.001;
const wallMat = new THREE.MeshStandardMaterial({ color: '#eeebe5', roughness: 0.95 });
const floorMat = new THREE.MeshStandardMaterial({ color: '#d8d1c4', roughness: 0.9 });
const frameMat = new THREE.MeshStandardMaterial({ color: '#f7f7f5', roughness: 0.5 });
const glassMat = new THREE.MeshStandardMaterial({ color: '#cfe6f3', roughness: 0.05, metalness: 0, transparent: true, opacity: 0.28 });
const doorMat = new THREE.MeshStandardMaterial({ color: '#c9b49a', roughness: 0.6 });

const Box = ({ c, s, m }) => (
  <mesh position={c} material={m} castShadow receiveShadow>
    <boxGeometry args={s} />
  </mesh>
);

// Ventana / puerta dentro del vano, en coordenadas de pared (mm): u a lo largo, v alto, zc centro de espesor.
function Opening({ o, T, zc }) {
  const F = 50; // ancho de marco
  const u0 = o.offset, u1 = o.offset + o.width, v0 = o.sill, v1 = o.sill + o.height;
  const cu = (u0 + u1) / 2, cv = (v0 + v1) / 2;
  if (o.type === 'paso') return null;
  const frame = [
    { c: [u0 + F / 2, cv, zc], s: [F, o.height, T] },
    { c: [u1 - F / 2, cv, zc], s: [F, o.height, T] },
    { c: [cu, v1 - F / 2, zc], s: [o.width, F, T] },
  ];
  if (o.type === 'ventana') frame.push({ c: [cu, v0 + F / 2, zc], s: [o.width, F, T] }, { c: [cu, cv, zc], s: [F * 0.6, o.height - 2 * F, 60] });
  return (
    <group>
      {frame.map((f, i) => <Box key={i} c={f.c.map((v) => v * S)} s={f.s.map((v) => v * S)} m={frameMat} />)}
      {o.type === 'ventana'
        ? <Box c={[cu * S, cv * S, zc * S]} s={[(o.width - 2 * F) * S, (o.height - 2 * F) * S, 0.006]} m={glassMat} />
        : <Box c={[cu * S, (v0 + (o.height - F) / 2) * S, zc * S]} s={[(o.width - 2 * F) * S, (o.height - F) * S, 0.04]} m={doorMat} />}
    </group>
  );
}

function Wall({ w, prev, room, openings, autoHide }) {
  const ref = useRef();
  const T = room.t, H = room.h;
  const theta = Math.atan2(-w.u[1], w.u[0]);
  // Eje z local del grupo rotado = (-uz, ux). El espesor va hacia el lado de la normal exterior.
  const outSign = w.n[0] * -w.u[1] + w.n[1] * w.u[0];
  const zc = (outSign >= 0 ? 1 : -1) * (T / 2);
  const pieces = useMemo(() => wallPieces(w.len, H, openings), [w.len, H, openings]);
  const mid = [(w.a[0] + w.b[0]) / 2, (w.a[1] + w.b[1]) / 2];
  useFrame(({ camera }) => {
    if (!ref.current) return;
    if (!autoHide) { ref.current.visible = true; return; }
    const cx = camera.position.x / S + room.w / 2, cz = camera.position.z / S + room.d / 2;
    ref.current.visible = (cx - mid[0]) * w.n[0] + (cz - mid[1]) * w.n[1] < 200;
  });
  return (
    <group ref={ref} position={[w.a[0] * S, 0, w.a[1] * S]} rotation={[0, theta, 0]}>
      {pieces.map((p, i) => (
        <Box key={i} c={[((p.u0 + p.u1) / 2) * S, ((p.v0 + p.v1) / 2) * S, zc * S]} s={[(p.u1 - p.u0) * S, (p.v1 - p.v0) * S, T * S]} m={wallMat} />
      ))}
      {openings.map((o) => <Opening key={o.id} o={o} T={T} zc={zc} />)}
      {/* Encuentro con la pared anterior (esquina), en coordenadas locales de esta pared */}
      {(() => {
        const ox = ((w.n[0] + prev.n[0]) * T) / 2, oz = ((w.n[1] + prev.n[1]) * T) / 2;
        const lu = ox * w.u[0] + oz * w.u[1], lz = ox * -w.u[1] + oz * w.u[0];
        return <Box c={[lu * S, (H / 2) * S, lz * S]} s={[T * S, H * S, T * S]} m={wallMat} />;
      })()}
    </group>
  );
}

export function Room3D({ room, autoHide = true }) {
  const walls = useMemo(() => roomWalls(room), [room]);
  const floorGeo = useMemo(() => {
    const shape = new THREE.Shape(room.points.map(([x, z]) => new THREE.Vector2(x * S, -z * S)));
    return new THREE.ShapeGeometry(shape);
  }, [room.points]);
  const T = room.t, H = room.h;
  return (
    <group>
      <mesh geometry={floorGeo} rotation={[-Math.PI / 2, 0, 0]} material={floorMat} receiveShadow />
      {walls.map((w, i) => (
        <Wall key={w.i} w={w} prev={walls[(i - 1 + walls.length) % walls.length]} room={room}
          openings={room.openings.filter((o) => o.wall === w.i)} autoHide={autoHide} />
      ))}
      {room.columns.map((c) => (
        <Box key={c.id} c={[(c.x + c.w / 2) * S, (H / 2) * S, (c.z + c.d / 2) * S]} s={[c.w * S, H * S, c.d * S]} m={wallMat} />
      ))}
    </group>
  );
}

const Label = ({ p, children, small }) => (
  <Html position={p} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
    <div className={small ? 'cota cota-mod' : 'cota'}>{children}</div>
  </Html>
);

// Cotas: largo de cada pared (por fuera) y ancho de cada módulo.
export function Dimensions({ room, modules }) {
  const walls = useMemo(() => roomWalls(room), [room]);
  const off = room.t + 250;
  const y = 0.01;
  return (
    <group>
      {walls.map((w) => {
        const a = [w.a[0] + w.n[0] * off, w.a[1] + w.n[1] * off], b = [w.b[0] + w.n[0] * off, w.b[1] + w.n[1] * off];
        const tick = (p) => [[(p[0] - w.n[0] * 80) * S, y, (p[1] - w.n[1] * 80) * S], [(p[0] + w.n[0] * 80) * S, y, (p[1] + w.n[1] * 80) * S]];
        return (
          <group key={w.i}>
            <Line points={[[a[0] * S, y, a[1] * S], [b[0] * S, y, b[1] * S]]} color="#2f6fdf" lineWidth={1.2} />
            <Line points={tick(a)} color="#2f6fdf" lineWidth={1.2} />
            <Line points={tick(b)} color="#2f6fdf" lineWidth={1.2} />
            <Label p={[((a[0] + b[0]) / 2) * S, y, ((a[1] + b[1]) / 2) * S]}>P{w.i + 1} · {w.len}</Label>
          </group>
        );
      })}
      {modules.map((m) => {
        const { fw, fd } = footprint(m);
        return <Label key={m.id} small p={[(m.x + fw / 2) * S, ((m.y || 0) + m.params.height + 60) * S, (m.z + fd / 2) * S]}>{m.params.width}</Label>;
      })}
    </group>
  );
}
