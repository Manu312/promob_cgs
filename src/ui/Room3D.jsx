import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import { roomWalls, wallPieces } from '../domain/room.js';
import { wallCorners, floorPolygon, wallFacesCamera } from '../domain/walls.js';
import { finishesOf } from '../domain/roomMaterials.js';
import { finishMaterial } from './roomTextures.js';
import { stripsOf, stripCells, rectMinusRects, regionsOn } from '../domain/strips.js';

const OV = { side: THREE.DoubleSide };
// Franjas con material y regiones sobre la cara interior de una pared (1 mm hacia adentro del ambiente),
// descontando los vanos de puertas y ventanas. Coordenadas locales de la pared (u, v - separación del piso).
function WallOverlays({ room, w, H, gap, zc, ops }) {
  const strips = stripsOf(room, w.id, w.len, H);
  const sf = room.stripFinishes?.[w.id] || {};
  const holes = ops.map((o) => ({ u0: o.offset, u1: o.offset + o.width, v0: o.sill, v1: o.sill + o.height }));
  const z = (zc > 0 ? -1 : 1) * 0.001;
  const rects = [];
  for (const c of stripCells(strips, w.len, H)) {
    if (!sf[c.id]) continue;
    for (const r of rectMinusRects(c, holes)) rects.push({ ...r, f: sf[c.id], key: `${c.id}|${r.u0}|${r.v0}` });
  }
  const regs = regionsOn(room, { kind: 'wall', wallId: w.id }).filter((r) => r.finish);
  return (
    <>
      {rects.map((r) => (
        <mesh key={r.key} position={[((r.u0 + r.u1) / 2) * S, ((r.v0 + r.v1) / 2 - gap) * S, z]} material={finishMaterial(r.f, r.u1 - r.u0, r.v1 - r.v0, OV)} receiveShadow>
          <planeGeometry args={[(r.u1 - r.u0) * S, (r.v1 - r.v0) * S]} />
        </mesh>
      ))}
      {regs.map((r) => <RegionMesh key={r.id} r={r} gap={gap} position={[0, 0, z * 1.6]} />)}
    </>
  );
}

// Pared perforada por geometrías (Promob "Furar"): el alzado de la pared extruido con los vanos y
// los agujeros. Un agujero con profundidad menor al espesor solo cala la parte de adentro.
function HoledWall({ len, H, T, zc, gap, openings, holes, material, finishMat }) {
  const geos = useMemo(() => {
    const rect = (u0, v0, u1, v1) => [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
    const path = (pts, Cls) => { const p = new Cls(); pts.forEach(([u, v], i) => (i ? p.lineTo(u * S, v * S) : p.moveTo(u * S, v * S))); p.closePath(); return p; };
    const opPts = openings.map((o) => rect(o.offset, o.sill, o.offset + o.width, o.sill + o.height));
    const hPts = holes.map((h) => ({ pts: h.pts.map(([u, v]) => [u, v - gap]), depth: h.depth }));
    const partial = Math.min(T, Math.max(0, ...hPts.filter((h) => h.depth && h.depth < T).map((h) => h.depth)));
    const layer = (depth, withPartial) => {
      const shape = path(rect(0, 0, len, H), THREE.Shape);
      for (const o of opPts) shape.holes.push(path(o, THREE.Path));
      for (const h of hPts) if (!h.depth || h.depth >= T || withPartial) shape.holes.push(path(h.pts, THREE.Path));
      return new THREE.ExtrudeGeometry(shape, { depth: depth * S, bevelEnabled: false });
    };
    // capa de adentro (con los agujeros parciales) y el resto del espesor
    return partial > 0 ? [{ g: layer(partial, true), z0: 0, d: partial }, { g: layer(T - partial, false), z0: partial, d: T - partial }] : [{ g: layer(T, true), z0: 0, d: T }];
  }, [len, H, T, gap, openings, holes]);
  useEffect(() => () => geos.forEach((x) => x.g.dispose()), [geos]);
  const inSign = zc > 0 ? 1 : -1; // el cuerpo crece desde z = 0 (cara interior) hacia afuera
  const mats = finishMat ? [finishMat, material] : material;
  return geos.map((x, i) => (
    <mesh key={i} geometry={x.g} material={mats} position={[0, 0, inSign > 0 ? x.z0 * S : -(x.z0 + x.d) * S]} castShadow receiveShadow />
  ));
}

// Región: en pared (u, v) o en piso (x, z); la geometría se libera al cambiar.
function RegionMesh({ r, gap = 0, floor = false, position, rotation }) {
  const geo = useMemo(() => new THREE.ShapeGeometry(new THREE.Shape(r.pts.map(([a, b]) => (floor ? new THREE.Vector2(a * S, -b * S) : new THREE.Vector2(a * S, (b - gap) * S))))), [r.pts, gap, floor]);
  useEffect(() => () => geo.dispose(), [geo]);
  return <mesh geometry={geo} position={position} rotation={rotation} material={finishMaterial(r.finish, 1000, 1000, OV)} userData={{ regionId: r.id }} receiveShadow />;
}

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


function Wall({ w, prev, origin, openings, autoHide, lowerH = 100, selected, onDown: onWallDown, onMenu, onDouble, selectedOpeningId, onOpeningDown, finish, room, holes = [] }) {
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
    <group ref={ref} position={[w.a[0] * S, gap * S, w.a[1] * S]} rotation={[0, theta, 0]} onPointerDown={onDown} userData={{ wallId: w.id, gap }}
      onDoubleClick={onDouble ? (e) => { if (!ref.current?.visible || !firstHitIn(e)) return; e.stopPropagation(); onDouble(w.id); } : undefined}
      onContextMenu={(e) => { if (!onMenu || !ref.current?.visible) return; e.stopPropagation(); onMenu(e, w); }}>
      {!sloped && holes.length > 0
        ? <HoledWall len={w.len} H={H} T={T} zc={zc} gap={gap} openings={ops} holes={holes} material={mat} finishMat={finishMaterial(finish, w.len, H, mat)} />
        : sloped
        ? <SlopedWall len={w.len} h0={h0} h1={h1} T={T} zc={zc} openings={ops} material={mat} />
        : pieces.map((p, i) => {
          // con material, la cara interior (la del lado z = 0 del cuerpo) lo lleva; las otras quedan igual
          const fm = finishMaterial(finish, p.u1 - p.u0, p.v1 - p.v0, mat);
          const m = fm ? [mat, mat, mat, mat, zc > 0 ? mat : fm, zc > 0 ? fm : mat] : mat;
          return <Box key={i} c={[((p.u0 + p.u1) / 2) * S, ((p.v0 + p.v1) / 2) * S, zc * S]} s={[(p.u1 - p.u0) * S, (p.v1 - p.v0) * S, T * S]} m={m} />;
        })}
      {!lowered && room && <WallOverlays room={room} w={w} H={H} gap={gap} zc={zc} ops={ops} />}
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

// ¿El primer objeto que toca el clic es parte de `group`? (si hay un módulo delante, no).
const firstHitIn = (e) => {
  let o = e.intersections?.[0]?.object;
  while (o) { if (o === e.eventObject) return true; o = o.parent; }
  return false;
};

export function Room3D({ room, origin, autoHide = true, selectedWallId, onWallDown, onWallMenu, selectedOpeningId, onOpeningDown, selectedColumnId, onColumnDown, onWallDouble, onFloorDouble, onFloorClick, onFloorDown, wallHoles = {}, floorHoles = [] }) {
  const walls = useMemo(() => roomWalls(room).filter((w) => w.wall.visible), [room]);
  // Esquina de cada pared: la pared que llega a su vértice de inicio.
  const incomingOf = useMemo(() => new Map(wallCorners(room).map((c) => [c.outgoing.id, c.incoming])), [room]);
  const floorPts = useMemo(() => floorPolygon(room), [room]);
  const floorGeo = useMemo(() => {
    const shape = new THREE.Shape(floorPts.map(([x, z]) => new THREE.Vector2(x * S, -z * S)));
    for (const h of floorHoles) shape.holes.push(new THREE.Path(h.pts.map(([x, z]) => new THREE.Vector2(x * S, -z * S)))); // perforado por geometrías
    return new THREE.ShapeGeometry(shape);
  }, [floorPts, floorHoles]);
  const H = room.h;
  const fin = useMemo(() => finishesOf(room), [room]);
  const floorM = finishMaterial(fin.floor, 1000, 1000) || floorMat; // UV del piso en metros
  return (
    <group>
      <mesh geometry={floorGeo} rotation={[-Math.PI / 2, 0, 0]} material={floorM} receiveShadow userData={{ floor: true }}
        onClick={onFloorClick ? (e) => { if (firstHitIn(e)) onFloorClick(e); } : undefined}
        onPointerDown={onFloorDown ? (e) => { if (!firstHitIn(e)) return; e.stopPropagation(); onFloorDown(); } : undefined}
        onDoubleClick={onFloorDouble ? (e) => { if (!firstHitIn(e)) return; e.stopPropagation(); onFloorDouble(); } : undefined} />
      {walls.map((w) => (
        <Wall key={w.id} w={w} prev={incomingOf.get(w.id)} origin={origin}
          openings={room.openings.filter((o) => o.wallId === w.id)} autoHide={autoHide} lowerH={room.lowerH}
          selected={w.id === selectedWallId} onDown={onWallDown} onMenu={onWallMenu} onDouble={onWallDouble} finish={fin.walls[w.id]} room={room} holes={wallHoles[w.id] || []}
          selectedOpeningId={selectedOpeningId} onOpeningDown={onOpeningDown} />
      ))}
      {regionsOn(room, { kind: 'floor' }).filter((r) => r.finish).map((r) => (
        <RegionMesh key={r.id} r={r} floor position={[0, 0.0012, 0]} rotation={[-Math.PI / 2, 0, 0]} />
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
