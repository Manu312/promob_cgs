import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, Lightformer, ContactShadows } from '@react-three/drei';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { WebGLPathTracer, GradientEquirectTexture } from 'three-gpu-pathtracer';
import { footprint } from '../domain/modules.js';
import { mat3d, metal, stone } from './materials3d.js';
import { Room3D, Dimensions } from './Room3D.jsx';

const S = 0.001; // mm → m

function PartMesh({ p, material }) {
  return (
    <mesh position={[(p.x + p.sx / 2) * S, (p.y + p.sy / 2) * S, (p.z + p.sz / 2) * S]} material={material} castShadow receiveShadow>
      <boxGeometry args={[p.sx * S, p.sy * S, p.sz * S]} />
    </mesh>
  );
}

function DecorMesh({ d }) {
  const pos = [(d.x + d.sx / 2) * S, (d.y + d.sy / 2) * S, (d.z + d.sz / 2) * S];
  if (d.decor === 'barral') {
    return (
      <mesh position={pos} rotation={[0, 0, Math.PI / 2]} material={metal} castShadow>
        <cylinderGeometry args={[0.012, 0.012, d.sx * S, 16]} />
      </mesh>
    );
  }
  return (
    <mesh position={pos} material={d.decor === 'mesada' ? stone : metal} castShadow receiveShadow>
      <boxGeometry args={[d.sx * S, d.sy * S, d.sz * S]} />
    </mesh>
  );
}

function SelBox({ w, h, d }) {
  const geo = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(w * S + 0.012, h * S + 0.012, d * S + 0.04)), [w, h, d]);
  return (
    <lineSegments geometry={geo} position={[0, (h * S) / 2, 0.014]}>
      <lineBasicMaterial color="#2f7df6" />
    </lineSegments>
  );
}

function ModuleObject({ mod, b, selected, showSel, onDown }) {
  const { fw, fd } = footprint(mod);
  const W = mod.params.width, D = mod.params.depth, H = mod.params.height;
  return (
    <group position={[(mod.x + fw / 2) * S, (mod.y || 0) * S, (mod.z + fd / 2) * S]} rotation={[0, ((mod.rot || 0) * Math.PI) / 180, 0]} onPointerDown={(e) => onDown(e, mod)}>
      <group position={[(-W / 2) * S, 0, (-D / 2) * S]}>
        {b.parts.map((p, i) => <PartMesh key={i} p={p} material={mat3d(b.mats[p.role])} />)}
        {b.decors.map((d, i) => <DecorMesh key={'d' + i} d={d} />)}
      </group>
      {selected && showSel && <SelBox w={W} h={H} d={D} />}
    </group>
  );
}

function CameraRig({ view, room, controlsRef }) {
  const { camera } = useThree();
  useEffect(() => {
    const big = Math.max(room.w, room.d) * S;
    let pos, tgt;
    if (view.name === 'planta') { pos = [0, big * 1.5 + 1.5, 0.001]; tgt = [0, 0, 0]; }
    else if (view.name === 'frente') { pos = [0, 1.3, (room.d * S) / 2 + 2.8]; tgt = [0, 1.1, -(room.d * S) / 4]; }
    else { pos = [1.6, 2.3, (room.d * S) / 2 + 2.6]; tgt = [0, 0.9, -(room.d * S) / 5]; }
    camera.position.set(...pos);
    const c = controlsRef.current;
    if (c) { c.target.set(...tgt); c.update(); } else camera.lookAt(...tgt);
  }, [view.tick]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

// Render fotorrealista por trazado de rayos: acumula muestras cuadro a cuadro.
function PathTracer({ maxSamples, onProgress, controlsRef, sceneKey }) {
  const { gl, scene, camera } = useThree();
  const ptRef = useRef(null);
  const last = useRef(-1);
  useEffect(() => {
    const env = new GradientEquirectTexture(256);
    env.topColor.set('#fffaf2');
    env.bottomColor.set('#b9b2a6');
    env.exponent = 2;
    env.update();
    const prevEnv = scene.environment;
    scene.environment = env;
    const pt = new WebGLPathTracer(gl);
    pt.bounces = 6;
    pt.minSamples = 1;
    pt.tiles.set(2, 2);
    pt.filterGlossyFactor = 0.5;
    pt.fadeDuration = 250;
    pt.setScene(scene, camera);
    ptRef.current = pt;
    last.current = -1;
    const c = controlsRef.current;
    const onChange = () => pt.updateCamera();
    // Al soltar la cámara, las paredes que se ocultan pudieron cambiar: reconstruir la escena del trazador.
    const onEnd = () => setTimeout(() => { if (ptRef.current === pt) pt.setScene(scene, camera); }, 50);
    c?.addEventListener('change', onChange);
    c?.addEventListener('end', onEnd);
    return () => {
      c?.removeEventListener('change', onChange);
      c?.removeEventListener('end', onEnd);
      try { pt.dispose(); } catch { /* three-gpu-pathtracer 0.0.23 falla al liberar recursos internos no creados */ }
      ptRef.current = null;
      scene.environment = prevEnv;
      env.dispose();
    };
  }, [sceneKey, gl, scene, camera, controlsRef]);
  useFrame(() => {
    const pt = ptRef.current;
    if (!pt) return;
    if (pt.samples < maxSamples) pt.renderSample();
    const s = Math.floor(pt.samples);
    if (s !== last.current) { last.current = s; onProgress?.(s); }
  }, 1);
  return null;
}

function Capturer({ captureRef, photoreal }) {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    captureRef.current = (scale = 2) => {
      if (photoreal) return gl.domElement.toDataURL('image/png'); // la imagen ya está acumulada en el canvas
      const old = gl.getPixelRatio();
      gl.setPixelRatio(old * scale);
      gl.render(scene, camera);
      const url = gl.domElement.toDataURL('image/png');
      gl.setPixelRatio(old);
      gl.render(scene, camera);
      return url;
    };
  }, [gl, scene, camera, captureRef, photoreal]);
  return null;
}

// Solo en desarrollo: permite a los tests e2e ubicar módulos en pantalla.
function DevProbe({ project }) {
  const { camera, gl } = useThree();
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    window.__muebles = {
      screenOf(id, dy = 0) {
        const m = project.modules.find((o) => o.id === id);
        if (!m) return null;
        const { fw, fd } = footprint(m);
        const v = new THREE.Vector3(
          (m.x + fw / 2 - project.room.w / 2) * S,
          ((m.y || 0) + m.params.height / 2 + dy) * S,
          (m.z + fd - project.room.d / 2) * S,
        ).project(camera);
        const r = gl.domElement.getBoundingClientRect();
        return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
      },
    };
  });
  return null;
}

function DragController({ drag, setDrag, onMove, controlsRef, room }) {
  const { camera, gl } = useThree();
  useEffect(() => {
    if (!drag) return;
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -drag.planeY);
    const ray = new THREE.Raycaster();
    const v = new THREE.Vector2();
    const pt = new THREE.Vector3();
    const move = (ev) => {
      const r = gl.domElement.getBoundingClientRect();
      v.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(v, camera);
      if (ray.ray.intersectPlane(plane, pt)) {
        onMove(drag.id, pt.x / S + room.w / 2 - drag.offX, pt.z / S + room.d / 2 - drag.offZ);
      }
    };
    const up = () => { setDrag(null); if (controlsRef.current) controlsRef.current.enabled = true; };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
  }, [drag, camera, gl, onMove, setDrag, controlsRef, room]);
  return null;
}

export default function Scene3D({ project, builtById, selectedId, onSelect, onMove, renderMode, photoreal, maxSamples = 400, onProgress, view, captureRef, showDims, autoHideWalls = true }) {
  const controlsRef = useRef();
  const [drag, setDrag] = useState(null);
  const { room } = project;
  const cx = (room.w * S) / 2, cz = (room.d * S) / 2;

  const onDown = (e, mod) => {
    if (renderMode) return;
    e.stopPropagation();
    onSelect(mod.id);
    const rx = e.point.x / S + room.w / 2, rz = e.point.z / S + room.d / 2;
    setDrag({ id: mod.id, planeY: e.point.y, offX: rx - mod.x, offZ: rz - mod.z });
    if (controlsRef.current) controlsRef.current.enabled = false;
  };

  return (
    <Canvas
      shadows
      dpr={renderMode ? [1, 2] : [1, 1.5]}
      gl={{ preserveDrawingBuffer: true, antialias: true }}
      camera={{ fov: 45, near: 0.05, far: 100, position: [1.6, 2.3, 4] }}
      onPointerMissed={() => !drag && onSelect(null)}
    >
      <color attach="background" args={[renderMode ? '#e7e3dc' : '#f3f4f6']} />
      <ambientLight intensity={renderMode ? 0.25 : 0.6} />
      <hemisphereLight args={['#ffffff', '#cbbfae', renderMode ? 0.35 : 0.4]} />
      <directionalLight
        castShadow
        position={[2.5, 4.5, 3.5]}
        intensity={renderMode ? 1.7 : 1.1}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-5}
        shadow-camera-right={5}
        shadow-camera-top={5}
        shadow-camera-bottom={-5}
        shadow-bias={-0.0004}
      />
      {photoreal && (
        <rectAreaLight position={[0, (room.h * S) - 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} width={1.2} height={0.6} intensity={6} color="#fff4e5" />
      )}
      {renderMode && !photoreal && (
        <Environment resolution={256} frames={1}>
          <Lightformer intensity={2} position={[0, 5, -3]} scale={[10, 4, 1]} />
          <Lightformer intensity={1.2} position={[-5, 2, 1]} rotation-y={Math.PI / 2} scale={[10, 3, 1]} />
          <Lightformer intensity={1.2} position={[5, 2, 1]} rotation-y={-Math.PI / 2} scale={[10, 3, 1]} />
          <Lightformer intensity={0.8} position={[0, 2, 6]} rotation-y={Math.PI} scale={[10, 3, 1]} />
        </Environment>
      )}
      <group position={[-cx, 0, -cz]}>
        <Room3D room={room} autoHide={autoHideWalls} />
        {showDims && !renderMode && <Dimensions room={room} modules={project.modules} />}
        {project.modules.map((m) => {
          const b = builtById.get(m.id);
          if (!b) return null;
          return <ModuleObject key={m.id} mod={m} b={b} selected={m.id === selectedId} showSel={!renderMode} onDown={onDown} />;
        })}
      </group>
      {renderMode && !photoreal && <ContactShadows position={[0, 0.002, 0]} scale={12} blur={2.2} opacity={0.45} far={2.5} />}
      <OrbitControls ref={controlsRef} makeDefault maxPolarAngle={view.name === 'planta' ? Math.PI : Math.PI / 2 - 0.02} minDistance={0.5} maxDistance={20} />
      <CameraRig view={view} room={room} controlsRef={controlsRef} />
      {photoreal && <PathTracer maxSamples={maxSamples} onProgress={onProgress} controlsRef={controlsRef} sceneKey={JSON.stringify([project.modules, room])} />}
      <Capturer captureRef={captureRef} photoreal={photoreal} />
      <DevProbe project={project} />
      <DragController drag={drag} setDrag={setDrag} onMove={onMove} controlsRef={controlsRef} room={room} />
    </Canvas>
  );
}
