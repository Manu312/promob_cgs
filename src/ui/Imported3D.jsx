import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { unitToMm } from '../domain/externals.js';

const S = 0.001;
const GREY = new THREE.MeshStandardMaterial({ color: '#b8b8b8', roughness: 0.6 });

const toBuffer = (dataUrl) => {
  const b64 = String(dataUrl).split(',')[1] || '';
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
};

// Lee el modelo (una vez por contenido) y lo apoya en el piso con su esquina mínima en el origen.
function useModel(e) {
  const [obj, setObj] = useState(null);
  useEffect(() => {
    let alive = true;
    const done = (o) => {
      if (!alive || !o) return;
      o.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; if (!m.material || e.format !== 'glb' && e.format !== 'gltf') m.material = GREY; } });
      const box = new THREE.Box3().setFromObject(o);
      o.position.sub(new THREE.Vector3(box.min.x, box.min.y, box.min.z));
      const g = new THREE.Group();
      g.add(o);
      setObj(g);
    };
    try {
      if (e.format === 'obj') done(new OBJLoader().parse(e.data));
      else if (e.format === 'stl') done(new THREE.Mesh(new STLLoader().parse(toBuffer(e.data)), GREY));
      else new GLTFLoader().parse(e.format === 'glb' ? toBuffer(e.data) : e.data, '', (gl) => done(gl.scene), () => setObj(null));
    } catch { setObj(null); }
    return () => { alive = false; };
  }, [e.data, e.format]); // eslint-disable-line react-hooks/exhaustive-deps
  return obj;
}

export function ExternalModel({ e }) {
  const obj = useModel(e);
  if (!obj || e.visible === false) return null;
  const k = unitToMm(e.units) * (e.scale || 1) * S;
  return (
    <group position={[e.x * S, (e.y || 0) * S, e.z * S]} rotation={[0, ((e.rot || 0) * Math.PI) / 180, 0]} userData={{ externalId: e.id }}>
      <primitive object={obj} scale={[k, k, k]} />
    </group>
  );
}

// Planta DXF importada: líneas sobre el piso (dibujo de referencia).
export function PlanDxf({ dxf }) {
  const geo = useMemo(() => {
    const v = [];
    for (const s of dxf.segments) v.push(s.a[0] * S, 0.004, s.a[1] * S, s.b[0] * S, 0.004, s.b[1] * S);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    return g;
  }, [dxf.segments]);
  useEffect(() => () => geo.dispose(), [geo]);
  if (dxf.visible === false) return null;
  return (
    <lineSegments geometry={geo} position={[(dxf.x || 0) * S, 0, (dxf.z || 0) * S]} raycast={() => null}>
      <lineBasicMaterial color="#7c3aed" />
    </lineSegments>
  );
}
