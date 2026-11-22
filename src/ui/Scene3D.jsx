import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, OrthographicCamera, Environment, Lightformer, ContactShadows } from '@react-three/drei';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { WebGLPathTracer, GradientEquirectTexture } from 'three-gpu-pathtracer';
import { footprint, localAxes, RESIZE_HANDLES } from '../domain/modules.js';
import { bounds } from '../domain/walls.js';
import { roomWalls } from '../domain/room.js';
import { planFitZoom } from '../domain/grid.js';
import { mat3d, metal, stone } from './materials3d.js';
import { Room3D, Dimensions } from './Room3D.jsx';
import { ModuleDistances } from './Cotas.jsx';
import { DrawTool } from './DrawTool.jsx';
import { PlanGrid } from './PlanGrid.jsx';

const ROTATE_BUTTONS = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
const PLAN_BUTTONS = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
// Dibujando paredes: el clic izquierdo y el derecho son de la herramienta; la ruedita hace zoom y el botón del medio mueve la vista.
const DRAW_BUTTONS = { LEFT: -1, MIDDLE: THREE.MOUSE.PAN, RIGHT: -1 };

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
    <lineSegments geometry={geo} position={[0, (h * S) / 2, 0.014]} raycast={() => null}>
      <lineBasicMaterial color="#2f7df6" />
    </lineSegments>
  );
}

// Flechas de redimensionar: posición (mm, sistema del módulo con origen en el centro de
// la huella y el piso del módulo) y giro del cono (apunta hacia +y por defecto).
const GAP = 90;
const handlePos = (W, H, D) => ({ right: [W / 2 + GAP, H / 2, 0], left: [-W / 2 - GAP, H / 2, 0], front: [0, H / 2, D / 2 + GAP], top: [0, H + GAP, 0] });
const HANDLE_ROT = { right: [0, 0, -Math.PI / 2], left: [0, 0, Math.PI / 2], front: [Math.PI / 2, 0, 0], top: [0, 0, 0] };
const handleMat = new THREE.MeshBasicMaterial({ color: '#ef4444', depthTest: false, transparent: true });

function ResizeHandles({ W, H, D, planta, onDown }) {
  return Object.entries(handlePos(W, H, D))
    .filter(([k]) => !(planta && k === 'top')) // en Planta no se puede arrastrar en vertical
    .map(([k, p]) => (
      <mesh key={k} position={p.map((v) => v * S)} rotation={HANDLE_ROT[k]} material={handleMat} renderOrder={3} userData={{ resizeHandle: k }}
        onPointerDown={(e) => onDown(e, k)}
        onPointerOver={() => { document.body.style.cursor = 'grab'; }}
        onPointerOut={() => { document.body.style.cursor = ''; }}>
        <coneGeometry args={[0.045, 0.11, 20]} />
      </mesh>
    ));
}

function ModuleObject({ mod, b, selected, showSel, onDown, onResizeDown, planta }) {
  const { fw, fd } = footprint(mod);
  const W = mod.params.width, D = mod.params.depth, H = mod.params.height;
  return (
    <group position={[(mod.x + fw / 2) * S, (mod.y || 0) * S, (mod.z + fd / 2) * S]} rotation={[0, ((mod.rot || 0) * Math.PI) / 180, 0]} onPointerDown={(e) => onDown(e, mod)}>
      <group position={[(-W / 2) * S, 0, (-D / 2) * S]}>
        {b.parts.map((p, i) => <PartMesh key={i} p={p} material={mat3d(b.mats[p.role])} />)}
        {b.decors.map((d, i) => <DecorMesh key={'d' + i} d={d} />)}
      </group>
      {selected && showSel && <SelBox w={W} h={H} d={D} />}
      {selected && showSel && onResizeDown && <ResizeHandles W={W} H={H} D={D} planta={planta} onDown={(e, k) => onResizeDown(e, mod, k)} />}
    </group>
  );
}

// Ubica la cámara al cambiar de vista. Al entrar/salir de Planta cambia la cámara
// (ortográfica ↔ perspectiva) y drei recrea los controles en el render siguiente:
// se espera a que ambos estén listos antes de aplicar la vista.
function CameraRig({ view, room, controlsRef }) {
  const pending = useRef(true);
  const { size } = useThree();
  useEffect(() => { pending.current = true; }, [view.tick]);
  useFrame(({ camera }) => {
    if (!pending.current) return;
    const planta = view.name === 'planta';
    const c = controlsRef.current;
    if (!!camera.isOrthographicCamera !== planta || (c && c.object !== camera)) return;
    pending.current = false;
    const b = bounds(room);
    const depth = (b.maxZ - b.minZ) * S;
    let pos, tgt;
    if (planta) {
      pos = [0, 40, 0.001]; tgt = [0, 0, 0];
      camera.zoom = planFitZoom(b, size.width, size.height);
      camera.updateProjectionMatrix();
    } else if (view.name === 'frente') { pos = [0, 1.3, depth / 2 + 2.8]; tgt = [0, 1.1, -depth / 4]; }
    else { pos = [1.6, 2.3, depth / 2 + 2.6]; tgt = [0, 0.9, -depth / 5]; }
    camera.position.set(...pos);
    if (c) { c.target.set(...tgt); c.update(); } else camera.lookAt(...tgt);
  });
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

// Solo en desarrollo: permite a los tests e2e ubicar módulos, paredes y vértices en pantalla.
function DevProbe({ project, origin }) {
  const { camera, gl } = useThree();
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const toScreen = (x, y, z) => {
      const v = new THREE.Vector3((x - origin.x) * S, y * S, (z - origin.z) * S).project(camera);
      const r = gl.domElement.getBoundingClientRect();
      return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
    };
    window.__muebles = {
      cameraType: camera.type,
      screenOf(id, dy = 0) {
        const m = project.modules.find((o) => o.id === id);
        if (!m) return null;
        const { fw, fd } = footprint(m);
        return toScreen(m.x + fw / 2, (m.y || 0) + m.params.height / 2 + dy, m.z + fd);
      },
      // Punto de una pared a la altura `y` (mm), corrido `side` mm sobre su normal (−2 = cara interior).
      screenOfWall(id, y = 1500, side = -2) {
        const g = roomWalls(project.room).find((w) => w.id === id);
        if (!g) return null;
        return toScreen((g.a[0] + g.b[0]) / 2 + g.n[0] * side, y, (g.a[1] + g.b[1]) / 2 + g.n[1] * side);
      },
      screenOfNode(id) {
        const n = project.room.nodes.find((o) => o.id === id);
        return n ? toScreen(n.x, project.room.h + 20, n.z) : null;
      },
      screenOfPoint(x, z, y = 0) { return toScreen(x, y, z); },
      screenOfHandle(id, handle) {
        const m = project.modules.find((o) => o.id === id);
        if (!m) return null;
        const { fw, fd } = footprint(m);
        const [lx, ly, lz] = handlePos(m.params.width, m.params.height, m.params.depth)[handle];
        const { ex, ez } = localAxes(m.rot || 0);
        return toScreen(m.x + fw / 2 + ex[0] * lx + ez[0] * lz, (m.y || 0) + ly, m.z + fd / 2 + ex[1] * lx + ez[1] * lz);
      },
    };
  });
  return null;
}

// Manijas de los vértices (solo en Planta): se arrastran para mover esquinas.
function NodeHandles({ room, onNodeDown }) {
  const top = Math.max(room.h, ...room.walls.map((w) => Math.max(w.h0, w.h1))) + 20;
  return room.nodes.map((n) => (
    <mesh key={n.id} position={[n.x * S, top * S, n.z * S]} renderOrder={2}
      onPointerDown={(e) => onNodeDown(e, n)}
      onPointerOver={() => { document.body.style.cursor = 'move'; }}
      onPointerOut={() => { document.body.style.cursor = ''; }}>
      <cylinderGeometry args={[0.07, 0.07, 0.01, 24]} />
      <meshBasicMaterial color="#2563eb" />
    </mesh>
  ));
}

// Arrastre: módulos (posición), paredes (desplazamiento sobre su normal), vértices y
// flechas de redimensionar. Los listeners están siempre registrados y el arrastre vive en
// una ref que se carga en el mismo pointerdown: si se registraran al empezar (en un efecto),
// un clic rápido soltaría el botón antes y el arrastre quedaría "pegado" al mouse.
function DragController({ dragRef, setDrag, onMove, onMoveWall, onMoveNode, onResize, onDragEnd, controlsRef, origin }) {
  const { camera, gl } = useThree();
  const live = useRef();
  live.current = { camera, gl, onMove, onMoveWall, onMoveNode, onResize, onDragEnd, origin };
  useEffect(() => {
    const ray = new THREE.Raycaster();
    const v = new THREE.Vector2();
    const pt = new THREE.Vector3();
    const planeOf = (drag, cam) => {
      if (drag.plane) return drag.plane;
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -drag.planeY);
      if (drag.vertical) { // flecha de alto: plano vertical de frente a la cámara
        const n = new THREE.Vector3();
        cam.getWorldDirection(n);
        n.y = 0;
        if (n.lengthSq() < 1e-6) n.set(0, 0, 1);
        plane.setFromNormalAndCoplanarPoint(n.normalize(), drag.p0);
      }
      drag.plane = plane;
      return plane;
    };
    const move = (ev) => {
      const drag = dragRef.current;
      if (!drag) return;
      const { camera: cam, gl: g, origin: o, ...cb } = live.current;
      const r = g.domElement.getBoundingClientRect();
      v.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(v, cam);
      if (!ray.ray.intersectPlane(planeOf(drag, cam), pt)) return;
      const snap = (val) => Math.round(val / drag.step) * drag.step;
      const rx = pt.x / S + o.x, rz = pt.z / S + o.z;
      if (drag.kind === 'resize') {
        const delta = drag.vertical ? (pt.y - drag.p0.y) / S : (rx - drag.sx) * drag.dir[0] + (rz - drag.sz) * drag.dir[1];
        cb.onResize(drag.start, drag.handle, snap(delta));
      } else if (drag.kind === 'wall') {
        const q = snap((rx - drag.sx) * drag.n[0] + (rz - drag.sz) * drag.n[1]);
        cb.onMoveWall(drag.id, drag.n[0] * q, drag.n[1] * q);
      } else if (drag.kind === 'node') {
        cb.onMoveNode(drag.id, snap(rx + drag.offX), snap(rz + drag.offZ));
      } else {
        cb.onMove(drag.id, rx - drag.offX, rz - drag.offZ);
      }
    };
    const up = () => {
      if (!dragRef.current) return;
      dragRef.current = null;
      setDrag(null);
      live.current.onDragEnd?.();
      if (controlsRef.current) controlsRef.current.enabled = true;
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
  }, [dragRef, setDrag, controlsRef]);
  return null;
}

// Centro de la caja envolvente del ambiente (mm).
const roomCenter = (room) => {
  const b = bounds(room);
  return { x: (b.minX + b.maxX) / 2, z: (b.minZ + b.maxZ) / 2 };
};

export default function Scene3D({ project, builtById, selectedId, onSelect, selectedWallId, onSelectWall, onMove, onMoveWall, onMoveNode, onResize, onDimEdit, onWallLength, onWallAngle, onWallContext, drawing, drawCursorRef, onDrawPoint, onDrawFinish, step = 10, onDragStart, onDragEnd, renderMode, photoreal, maxSamples = 400, onProgress, view, captureRef, showDims, autoHideWalls = true }) {
  const controlsRef = useRef();
  const [drag, setDrag] = useState(null);
  const dragRef = useRef(null);
  const { room } = project;
  const planta = view.name === 'planta';
  const selectedMod = project.modules.find((m) => m.id === selectedId) || null;
  // Origen del visor (mm del ambiente en el centro de la escena). Se fija al cambiar de
  // vista, no en cada cambio: si se recentrara mientras se arrastra una pared, la escena
  // se movería debajo del mouse.
  const [origin, setOrigin] = useState(() => roomCenter(room));
  useEffect(() => setOrigin(roomCenter(room)), [view.tick]); // eslint-disable-line react-hooks/exhaustive-deps
  const toRoom = (p) => [p.x / S + origin.x, p.z / S + origin.z];

  const leftButton = (e) => (e.nativeEvent?.button ?? 0) === 0; // los arrastres son con el botón izquierdo
  const startDrag = (d) => {
    onDragStart?.(); // el arrastre completo es un solo paso de deshacer
    dragRef.current = d;
    setDrag(d);
    if (controlsRef.current) controlsRef.current.enabled = false;
  };
  // Las flechas se dibujan siempre encima: si el rayo pasó por una (aunque haya algo
  // más cerca, como el propio módulo), el clic es de la flecha.
  const handleHit = (e) => {
    if (!onResize || !selectedMod) return false;
    const hit = e.intersections?.find((i) => i.object.userData?.resizeHandle);
    if (!hit) return false;
    onResizeDown(e, selectedMod, hit.object.userData.resizeHandle, hit.point);
    return true;
  };
  const onDown = (e, mod) => {
    if (renderMode) return;
    e.stopPropagation();
    if (handleHit(e)) return;
    onSelect(mod.id);
    if (!leftButton(e)) return;
    const [rx, rz] = toRoom(e.point);
    startDrag({ kind: 'module', id: mod.id, planeY: e.point.y, offX: rx - mod.x, offZ: rz - mod.z });
  };
  // Clic derecho en una pared: menú contextual en la posición del mouse (offset = punto sobre la pared).
  const onWallMenu = (e, g) => {
    const [rx, rz] = toRoom(e.point);
    onWallContext?.({ wallId: g.id, offset: (rx - g.a[0]) * g.u[0] + (rz - g.a[1]) * g.u[1], x: e.nativeEvent.clientX, y: e.nativeEvent.clientY });
  };
  // Pared: se selecciona siempre; se arrastra en Planta, o en 3D si es movible.
  const onWallDown = (e, g) => {
    if (renderMode) return;
    if (handleHit(e)) return;
    onSelectWall(g.id);
    if (!leftButton(e) || !(planta || g.wall.movable)) return;
    const [rx, rz] = toRoom(e.point);
    startDrag({ kind: 'wall', id: g.id, planeY: e.point.y, sx: rx, sz: rz, n: g.n, step });
  };
  const onNodeDown = (e, n) => {
    if (renderMode || !leftButton(e)) return;
    e.stopPropagation();
    const [rx, rz] = toRoom(e.point);
    startDrag({ kind: 'node', id: n.id, planeY: e.point.y, offX: n.x - rx, offZ: n.z - rz, step });
  };
  // Flecha de redimensionar: el arrastre se mide sobre el eje de la flecha (en el mundo),
  // siempre desde el módulo como estaba al empezar.
  function onResizeDown(e, mod, handle, point = e.point) {
    if (renderMode || !leftButton(e)) return;
    e.stopPropagation();
    const h = RESIZE_HANDLES[handle];
    if (h.axis === 'y') return startDrag({ kind: 'resize', id: mod.id, handle, start: mod, vertical: true, p0: point.clone(), planeY: 0, step });
    const { ex, ez } = localAxes(mod.rot || 0);
    const ax = h.axis === 'x' ? ex : ez;
    const [rx, rz] = toRoom(point);
    startDrag({ kind: 'resize', id: mod.id, handle, start: mod, planeY: point.y, sx: rx, sz: rz, dir: [ax[0] * h.sign, ax[1] * h.sign], step });
  }

  return (
    <Canvas
      shadows
      dpr={renderMode ? [1, 2] : [1, 1.5]}
      gl={{ preserveDrawingBuffer: true, antialias: true }}
      camera={{ fov: 45, near: 0.05, far: 100, position: [1.6, 2.3, 4] }}
      onPointerMissed={() => !dragRef.current && !drawing && onSelect(null)}
      onContextMenu={(e) => e.preventDefault()}
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
      <group position={[-origin.x * S, 0, -origin.z * S]}>
        <Room3D room={room} origin={origin} autoHide={autoHideWalls} selectedWallId={renderMode ? null : selectedWallId} onWallDown={renderMode ? null : onWallDown}
          onWallMenu={renderMode || drawing ? null : onWallMenu} />
        {planta && !renderMode && <PlanGrid room={room} />}
        {planta && !renderMode && !drawing && <NodeHandles room={room} onNodeDown={onNodeDown} />}
        {planta && !renderMode && drawing && <DrawTool room={room} draw={drawing} origin={origin} cursorRef={drawCursorRef} onPoint={onDrawPoint} onFinish={onDrawFinish} />}
        {showDims && !renderMode && <Dimensions room={room} modules={project.modules} onWallLength={onWallLength} onWallAngle={onWallAngle} />}
        {selectedMod && !renderMode && <ModuleDistances room={room} modules={project.modules} mod={selectedMod} onEdit={onDimEdit} />}
        {project.modules.map((m) => {
          const b = builtById.get(m.id);
          if (!b) return null;
          return <ModuleObject key={m.id} mod={m} b={b} selected={m.id === selectedId} showSel={!renderMode} onDown={onDown}
            onResizeDown={onResize ? onResizeDown : null} planta={planta} />;
        })}
      </group>
      {renderMode && !photoreal && <ContactShadows position={[0, 0.002, 0]} scale={12} blur={2.2} opacity={0.45} far={2.5} />}
      {planta && <OrthographicCamera makeDefault near={0.1} far={200} position={[0, 40, 0.001]} />}
      <OrbitControls ref={controlsRef} makeDefault maxPolarAngle={planta ? Math.PI : Math.PI / 2 - 0.02} minDistance={0.5} maxDistance={20}
        enableRotate={!planta} zoomToCursor={planta} minZoom={15} maxZoom={4000} mouseButtons={planta ? (drawing ? DRAW_BUTTONS : PLAN_BUTTONS) : ROTATE_BUTTONS} />
      <CameraRig view={view} room={room} controlsRef={controlsRef} />
      {photoreal && <PathTracer maxSamples={maxSamples} onProgress={onProgress} controlsRef={controlsRef} sceneKey={JSON.stringify([project.modules, room])} />}
      <Capturer captureRef={captureRef} photoreal={photoreal} />
      <DevProbe project={project} origin={origin} />
      <DragController dragRef={dragRef} setDrag={setDrag} onMove={onMove} onMoveWall={onMoveWall} onMoveNode={onMoveNode} onResize={onResize} onDragEnd={onDragEnd} controlsRef={controlsRef} origin={origin} />
    </Canvas>
  );
}
