import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { lightsOf, spotCone } from '../domain/lights.js';

RectAreaLightUniformsLib.init();
const S = 0.001;

function Spot({ l }) {
  const target = useMemo(() => new THREE.Object3D(), []);
  useEffect(() => { target.position.set(...l.dir.map((v) => v * 2)); target.updateMatrixWorld(); }, [target, l.dir]);
  const { angle, penumbra } = spotCone(l.angle, l.falloff);
  return (
    <group position={l.pos.map((v) => v * S)}>
      <primitive object={target} />
      <spotLight target={target} color={l.color} intensity={l.intensity * 7} distance={8} decay={1.5} angle={angle} penumbra={penumbra} castShadow={l.shadow} />
    </group>
  );
}

function Linear({ l }) {
  const ref = useMemo(() => ({ current: null }), []);
  const rotY = Math.atan2(-l.axis[1], l.axis[0]);
  return (
    <group position={l.pos.map((v) => v * S)} rotation={[0, rotY, 0]}>
      <rectAreaLight ref={ref} width={Math.max(0.05, l.length * S)} height={0.02} color={l.color} intensity={l.intensity * 5} rotation={[-Math.PI / 2, 0, 0]} />
    </group>
  );
}

// Luces de las luminarias del proyecto (posiciones en mm del ambiente; van dentro del grupo del ambiente).
export default function Lights3D({ project }) {
  const lights = lightsOf(project);
  return lights.map((l) => {
    if (l.intensity <= 0) return null;
    if (l.kind === 'spot') return <Spot key={l.id} l={l} />;
    if (l.kind === 'lineal') return <Linear key={l.id} l={l} />;
    return <pointLight key={l.id} position={l.pos.map((v) => v * S)} color={l.color} intensity={l.intensity * 2.5} distance={7} decay={1.5} castShadow={l.shadow} />;
  });
}
