import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, OrthographicCamera, Environment, Lightformer, ContactShadows, Edges } from '@react-three/drei';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { lightRig } from '../domain/render.js';
import { footprint, localAxes, RESIZE_HANDLES, AXIS_COLORS } from '../domain/modules.js';
import { bounds } from '../domain/walls.js';
import { frontTransforms } from '../domain/fronts.js';
import { roomWalls } from '../domain/room.js';
import { planFitZoom } from '../domain/grid.js';
import { viewPose, wallViewPose, orthoZoom } from '../domain/views.js';
import { fitBoxPose, zoomWindowPose, walkPose } from '../domain/navigation.js';
import { fillMode } from '../domain/fillModes.js';
import { FillContext, FillGroup, useFill, NONE_MATERIAL } from './fill3d.jsx';
import { GeometryMesh } from './Geometry3D.jsx';
import Lights3D from './Lights3D.jsx';
import { outlineOf, boundsOf, holesOn, holesInGeometry } from '../domain/geometry.js';
import { arcMid } from '../domain/curvedWalls.js';
import { mat3d, metal, stone, finishMat } from './materials3d.js';
import { Room3D, Dimensions } from './Room3D.jsx';
import { ModuleDistances, OpeningDims, HeightRuler, Annotations } from './Cotas.jsx';
import { AnnotateTool } from './AnnotateTool.jsx';
import { PlanImage } from './PlanImage.jsx';
import { DrawTool } from './DrawTool.jsx';
import { PlanGrid } from './PlanGrid.jsx';

const ROTATE_BUTTONS = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
const PLAN_BUTTONS = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
// Dibujando paredes: el clic izquierdo y el derecho son de la herramienta; la ruedita hace zoom y el botón del medio mueve la vista.
const DRAW_BUTTONS = { LEFT: -1, MIDDLE: THREE.MOUSE.PAN, RIGHT: -1 };
// Herramientas Pan (P) y Zoom (Z) de Promob: el botón izquierdo hace eso.
const PAN_BUTTONS = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
const ZOOM_BUTTONS = { LEFT: THREE.MOUSE.DOLLY, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
const NAV_BUTTONS = { pan: PAN_BUTTONS, zoom: ZOOM_BUTTONS, zoomWin: { LEFT: -1, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }, walk: { LEFT: -1, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: -1 } };

// Navegación (Zoom Total, Zoom Entidad, Zoom Ventana, Caminar): mueve la cámara y los controles.
function NavBridge({ navRef, controlsRef, project, origin }) {
  const { camera, size } = useThree();
  useEffect(() => {
    const apply = (pose, zoomFactor) => {
      camera.position.set(...pose.pos);
      if (camera.isOrthographicCamera && zoomFactor) { camera.zoom *= zoomFactor; camera.updateProjectionMatrix(); }
      const c = controlsRef.current;
      if (c) { c.target.set(...pose.target); c.update(); } else camera.lookAt(...pose.target);
    };
    const target = () => (controlsRef.current ? controlsRef.current.target.toArray() : [0, 0, 0]);
    const aspect = () => size.width / Math.max(1, size.height);
    const boxOf = (mods) => {
      let mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
      for (const m of mods) {
        const { fw, fd } = footprint(m);
        const a = [(m.x - origin.x) * S, (m.y || 0) * S, (m.z - origin.z) * S];
        const b = [(m.x + fw - origin.x) * S, ((m.y || 0) + m.params.height) * S, (m.z + fd - origin.z) * S];
        mn = mn.map((v, i) => Math.min(v, a[i])); mx = mx.map((v, i) => Math.max(v, b[i]));
      }
      return [mn, mx];
    };
    const fit = (mn, mx) => {
      if (camera.isOrthographicCamera) {
        const t = mn.map((v, i) => (v + mx[i]) / 2);
        const dir = camera.position.toArray().map((v, i) => v - target()[i]);
        const span = Math.max(Math.hypot(mx[0] - mn[0], mx[2] - mn[2]), mx[1] - mn[1], 0.3) * 1.15;
        camera.zoom = Math.min(size.width, size.height) / span;
        camera.updateProjectionMatrix();
        apply({ pos: t.map((v, i) => v + dir[i]), target: t });
        return;
      }
      apply(fitBoxPose(mn, mx, camera.position.toArray(), target(), camera.fov, aspect()));
    };
    navRef.current = {
      fitAll() {
        const b = bounds(project.room);
        const mods = project.modules.filter((m) => !m.hidden);
        let [mn, mx] = [[(b.minX - origin.x) * S, 0, (b.minZ - origin.z) * S], [(b.maxX - origin.x) * S, project.room.h * S, (b.maxZ - origin.z) * S]];
        if (mods.length) { const [a, c] = boxOf(mods); mn = mn.map((v, i) => Math.min(v, a[i])); mx = mx.map((v, i) => Math.max(v, c[i])); }
        fit(mn, mx);
      },
      fitModules(ids) {
        const mods = project.modules.filter((m) => ids.includes(m.id));
        if (mods.length) fit(...boxOf(mods));
      },
      zoomWindow(rect) {
        const p = zoomWindowPose(camera.position.toArray(), target(), rect, { fovDeg: camera.fov || 45, aspect: aspect(), ortho: !!camera.isOrthographicCamera, zoom: camera.zoom, viewH: size.height });
        apply(p, p.zoomFactor);
      },
      walk(forward, yaw) {
        if (camera.isOrthographicCamera) return;
        apply(walkPose(camera.position.toArray(), target(), forward, yaw));
      },
    };
  }, [camera, size, controlsRef, project, origin, navRef]);
  return null;
}

const S = 0.001; // mm → m
const MAX_DRAG_DIST = 25; // m: más lejos, el plano de arrastre está casi de canto a la cámara

function PartMesh({ p, material, onDoubleClick }) {
  return (
    <mesh position={[(p.x + p.sx / 2) * S, (p.y + p.sy / 2) * S, (p.z + p.sz / 2) * S]} rotation={[0, p.ry || 0, 0]} material={material} castShadow receiveShadow onDoubleClick={onDoubleClick}>
      <boxGeometry args={[p.sx * S, p.sy * S, p.sz * S]} />
    </mesh>
  );
}

function DecorMesh({ d, stoneMat }) {
  const pos = [(d.x + d.sx / 2) * S, (d.y + d.sy / 2) * S, (d.z + d.sz / 2) * S];
  if (d.decor === 'aparato' && d.shape === 'cyl') { // cilindro: eje vertical o hacia el frente
    return (
      <mesh position={pos} rotation={d.axis === 'z' ? [Math.PI / 2, 0, 0] : [0, 0, 0]} material={finishMat(d.finish)} castShadow>
        <cylinderGeometry args={[(d.sx / 2) * S, (d.sx / 2) * S, (d.axis === 'z' ? d.sz : d.sy) * S, 24]} />
      </mesh>
    );
  }
  if (d.decor === 'aparato') {
    return (
      <mesh position={pos} rotation={[0, d.ry || 0, 0]} material={finishMat(d.finish)} castShadow receiveShadow>
        <boxGeometry args={[d.sx * S, d.sy * S, d.sz * S]} />
      </mesh>
    );
  }
  if (d.decor === 'barral') {
    return (
      <mesh position={pos} rotation={[0, 0, Math.PI / 2]} material={metal} castShadow>
        <cylinderGeometry args={[0.012, 0.012, d.sx * S, 16]} />
      </mesh>
    );
  }
  return (
    <mesh position={pos} rotation={[0, d.ry || 0, 0]} material={d.decor === 'mesada' ? stoneMat || stone : metal} castShadow receiveShadow>
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
const GAP = 150; // la cola de la flecha (125 mm) no se mete en el módulo
const handlePos = (W, H, D) => ({
  right: [W / 2 + GAP, H / 2, 0], left: [-W / 2 - GAP, H / 2, 0],
  front: [0, H / 2, D / 2 + GAP], back: [0, H / 2, -D / 2 - GAP],
  top: [0, H + GAP, 0], bottom: [0, -GAP, 0],
});
const HANDLE_ROT = {
  right: [0, 0, -Math.PI / 2], left: [0, 0, Math.PI / 2],
  front: [Math.PI / 2, 0, 0], back: [-Math.PI / 2, 0, 0],
  top: [0, 0, 0], bottom: [Math.PI, 0, 0],
};
const handleMats = Object.fromEntries(Object.entries(AXIS_COLORS).map(([k, c]) => [k, new THREE.MeshBasicMaterial({ color: c, depthTest: false, transparent: true })]));

function ResizeHandles({ W, H, D, planta, onDown }) {
  return Object.entries(handlePos(W, H, D))
    .filter(([k]) => !(planta && RESIZE_HANDLES[k].axis === 'y')) // en Planta no se puede arrastrar en vertical
    .map(([k, p]) => (
      <mesh key={k} position={p.map((v) => v * S)} rotation={HANDLE_ROT[k]} material={handleMats[RESIZE_HANDLES[k].axis]} renderOrder={3} userData={{ resizeHandle: k }}
        onPointerDown={(e) => onDown(e, k)}
        onPointerOver={() => { document.body.style.cursor = 'grab'; }}
        onPointerOut={() => { document.body.style.cursor = ''; }}>
        <coneGeometry args={[0.04, 0.09, 20]} />
        {/* cola de la flecha (como las de Promob) */}
        <mesh position={[0, -0.085, 0]} material={handleMats[RESIZE_HANDLES[k].axis]} renderOrder={3} userData={{ resizeHandle: k }}>
          <cylinderGeometry args={[0.012, 0.012, 0.08, 10]} />
        </mesh>
      </mesh>
    ));
}

// Frente abierto: la puerta gira sobre su bisagra; el cajón sale hacia adelante.
function FrontMove({ T, children }) {
  if (!T) return children;
  if (T.type === 'drawer') return <group position={[0, 0, T.dz * S]}>{children}</group>;
  return (
    <group position={[T.px * S, 0, T.pz * S]} rotation={[0, T.angle, 0]}>
      <group position={[-T.px * S, 0, -T.pz * S]}>{children}</group>
    </group>
  );
}

function ModuleObject({ mod, b, selected, showSel, onDown, onMenu, onResizeDown, planta, openState, onToggleFront }) {
  const { fw, fd } = footprint(mod);
  const W = mod.params.width, D = mod.params.depth, H = mod.params.height;
  const tfm = useMemo(() => frontTransforms(b, openState, D), [b, openState, D]);
  const dbl = (p) => (p.front != null && onToggleFront ? (e) => { e.stopPropagation(); onToggleFront(mod.id, p.front); } : undefined);
  const fill = useFill();
  return (
    <group position={[(mod.x + fw / 2) * S, (mod.y || 0) * S, (mod.z + fd / 2) * S]} rotation={[0, ((mod.rot || 0) * Math.PI) / 180, 0]} onPointerDown={(e) => onDown(e, mod)} userData={{ moduleId: mod.id }}
      onContextMenu={onMenu ? (e) => onMenu(e, mod) : undefined}>
      <FillGroup position={[(-W / 2) * S, 0, (-D / 2) * S]}>
        {b.parts.map((p, i) => <FrontMove key={i} T={p.front != null ? tfm.get(p.front) : null}><PartMesh p={p} material={mat3d(b.mats[p.slot])} onDoubleClick={dbl(p)} /></FrontMove>)}
        {b.decors.map((d, i) => <FrontMove key={'d' + i} T={d.front != null ? tfm.get(d.front) : null}><DecorMesh d={d} stoneMat={b.mats.tapas ? mat3d(b.mats.tapas) : null} /></FrontMove>)}
      </FillGroup>
      {fill.box && ( // Caja de contorno: solo el contorno del módulo (y se puede elegir haciendo clic adentro)
        <mesh position={[0, (H / 2) * S, 0]} material={NONE_MATERIAL} userData={{ noFill: true }}>
          <boxGeometry args={[W * S, H * S, D * S]} />
          <Edges color="#374151" />
        </mesh>
      )}
      {selected && showSel && <SelBox w={W} h={H} d={D} />}
      {selected && showSel && onResizeDown && <ResizeHandles W={W} H={H} D={D} planta={planta} onDown={(e, k) => onResizeDown(e, mod, k)} />}
    </group>
  );
}

// Ubica la cámara al cambiar de vista. Al entrar/salir de Planta cambia la cámara
// (ortográfica ↔ perspectiva) y drei recrea los controles en el render siguiente:
// se espera a que ambos estén listos antes de aplicar la vista.
function CameraRig({ view, room, controlsRef, origin }) {
  const pending = useRef(true);
  const { size } = useThree();
  useEffect(() => { pending.current = true; }, [view.tick]);
  useFrame(({ camera }) => {
    if (!pending.current) return;
    const planta = view.name === 'planta';
    const ortho = planta || !!view.ortho;
    const c = controlsRef.current;
    if (!!camera.isOrthographicCamera !== ortho || (c && c.object !== camera)) return;
    pending.current = false;
    const b = bounds(room);
    const box = { w: b.maxX - b.minX, d: b.maxZ - b.minZ, h: room.h };
    const aspect = size.width / Math.max(1, size.height);
    const g = view.name === 'pared' ? roomWalls(room).find((w) => w.id === view.wallId) : null;
    const wh = g ? Math.max(g.wall.h0 ?? room.h, g.wall.h1 ?? room.h) : room.h;
    const pose = g ? wallViewPose(g, wh, origin, 45, aspect) : viewPose(view.name, box, 45, aspect);
    camera.position.set(...pose.pos);
    if (ortho) {
      // en Planta queda margen alrededor: los paneles de las herramientas (abajo) no tapan las paredes
      camera.zoom = planta ? planFitZoom(b, size.width, size.height, 1.8)
        : g ? orthoZoom(g.len / 1000, wh / 1000, size.width, size.height)
          : orthoZoom(Math.hypot(box.w, box.d) / 1000, Math.hypot(box.w, box.d, box.h) / 1000, size.width, size.height);
      camera.updateProjectionMatrix();
    }
    if (c) { c.target.set(...pose.target); c.update(); } else camera.lookAt(...pose.target);
  });
  return null;
}

// Superficie del ambiente bajo un punto de la pantalla: pared o piso (un módulo delante la tapa).
function SurfacePicker({ surfaceRef }) {
  const { camera, gl, scene } = useThree();
  useEffect(() => {
    const ray = new THREE.Raycaster();
    surfaceRef.current = (cx, cy) => {
      const r = gl.domElement.getBoundingClientRect();
      ray.setFromCamera(new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1), camera);
      for (const hit of ray.intersectObjects(scene.children, true)) {
        if (!hit.object.isMesh || !hit.object.visible) continue;
        let o = hit.object, vis = true;
        while (o) {
          if (!o.visible) vis = false;
          if (o.userData?.regionId) return vis ? { kind: 'region', id: o.userData.regionId } : null;
          if (o.userData?.geometryId) return { kind: 'geometry', id: o.userData.geometryId };
          if (o.userData?.wallId) { // con la posición (u, v) en la cara, para las franjas
            if (!vis) return null;
            const l = o.worldToLocal(hit.point.clone());
            return { kind: 'wall', wallId: o.userData.wallId, u: l.x / S, v: l.y / S + (o.userData.gap || 0) };
          }
          if (o.userData?.floor) return { kind: 'floor' };
          if (o.userData?.moduleId) return { kind: 'module', id: o.userData.moduleId };
          o = o.parent;
        }
        if (vis) return null;
      }
      return null;
    };
    // Punto (u, v) sobre el plano de la cara interior de una pared, aunque haya algo delante.
    surfaceRef.wallPoint = (cx, cy, wallId) => {
      let wall = null;
      scene.traverse((o) => { if (o.userData?.wallId === wallId) wall = o; });
      if (!wall) return null;
      const r = gl.domElement.getBoundingClientRect();
      ray.setFromCamera(new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1), camera);
      const inv = new THREE.Matrix4().copy(wall.matrixWorld).invert();
      const local = ray.ray.clone().applyMatrix4(inv);
      const pt = new THREE.Vector3();
      if (!local.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), pt)) return null;
      return [pt.x / S, pt.y / S + (wall.userData.gap || 0)];
    };
  }, [camera, gl, scene, surfaceRef]);
  return null;
}

// Puente con la ventana de render: le da el renderer, la escena, la cámara y el tamaño de la vista.
// `roomCenter` = centro del ambiente en coordenadas de la escena (m), para el panorama 360°.
function RenderBridge({ renderRef, room, origin }) {
  const { gl, scene, camera, size } = useThree();
  useEffect(() => {
    const c = roomCenter(room);
    renderRef.current = () => ({ gl, scene, camera, view: { width: Math.round(size.width), height: Math.round(size.height) }, roomCenter: [(c.x - origin.x) * S, 0, (c.z - origin.z) * S] });
  }, [gl, scene, camera, size, renderRef, room, origin]);
  return null;
}

function Capturer({ captureRef }) {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    captureRef.current = (scale = 2) => {
      const plan = scene.getObjectByName('planImage'); // el plano de referencia no va a la imagen exportada
      if (plan) plan.visible = false;
      const old = gl.getPixelRatio();
      gl.setPixelRatio(old * scale);
      gl.render(scene, camera);
      const url = gl.domElement.toDataURL('image/png');
      gl.setPixelRatio(old);
      if (plan) plan.visible = true;
      gl.render(scene, camera);
      return url;
    };
  }, [gl, scene, camera, captureRef]);
  return null;
}

// Proyecta un punto de la pantalla al plano horizontal y = `y` (mm) del ambiente: lo usa
// el arrastre desde el catálogo para ubicar el recuadro verde.
function Picker({ pickRef, origin }) {
  const { camera, gl } = useThree();
  useEffect(() => {
    const ray = new THREE.Raycaster();
    pickRef.current = (cx, cy, y = 0) => {
      const r = gl.domElement.getBoundingClientRect();
      ray.setFromCamera(new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1), camera);
      const pt = new THREE.Vector3();
      if (!ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -y * S), pt)) return null;
      if (!camera.isOrthographicCamera && pt.distanceTo(camera.position) > MAX_DRAG_DIST) return null;
      return [pt.x / S + origin.x, pt.z / S + origin.z];
    };
  }, [camera, gl, origin, pickRef]);
  return null;
}

// Recuadro verde de la posición de inserción (arrastre desde el catálogo).
const ghostFill = new THREE.MeshBasicMaterial({ color: '#22c55e', transparent: true, opacity: 0.22, depthWrite: false });
function GhostBox({ mod }) {
  const { fw, fd } = footprint(mod);
  const W = mod.params.width, H = mod.params.height, D = mod.params.depth;
  const edges = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(W * S, H * S, D * S)), [W, H, D]);
  return (
    <group position={[(mod.x + fw / 2) * S, (mod.y || 0) * S, (mod.z + fd / 2) * S]} rotation={[0, ((mod.rot || 0) * Math.PI) / 180, 0]} name="insertGhost">
      <mesh position={[0, (H * S) / 2, 0]} material={ghostFill} raycast={() => null} renderOrder={4}>
        <boxGeometry args={[W * S, H * S, D * S]} />
      </mesh>
      <lineSegments geometry={edges} position={[0, (H * S) / 2, 0]} raycast={() => null} renderOrder={4}>
        <lineBasicMaterial color="#16a34a" />
      </lineSegments>
    </group>
  );
}

// Solo en desarrollo: permite a los tests e2e ubicar módulos, paredes y vértices en pantalla.
function DevProbe({ project, origin, openFronts }) {
  const { camera, gl, scene } = useThree();
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const toScreen = (x, y, z) => {
      const v = new THREE.Vector3((x - origin.x) * S, y * S, (z - origin.z) * S).project(camera);
      const r = gl.domElement.getBoundingClientRect();
      return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
    };
    window.__muebles = {
      cameraType: camera.type,
      planImageShown: !!scene.getObjectByName('planImage'),
      ghostShown: !!scene.getObjectByName('insertGhost'),
      sun() {
        const l = scene.getObjectByName('sol');
        return l && { visible: l.visible, intensity: l.intensity, color: '#' + l.color.getHexString(), dir: l.position.clone().normalize().toArray() };
      },
      openFronts,
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
      camPos() { return camera.position.toArray(); },
      screenOfOpening(id) {
        const o = project.room.openings.find((x) => x.id === id);
        const g = o && roomWalls(project.room).find((w) => w.id === o.wallId);
        if (!g) return null;
        const s = o.offset + o.width / 2;
        return toScreen(g.a[0] + g.u[0] * s - g.n[0] * 2, o.sill + o.height / 2, g.a[1] + g.u[1] * s - g.n[1] * 2);
      },
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
// Mover HotPoint (H): un punto verde en el medio de cada pared; arrastrarlo la curva.
function HotpointHandles({ room, onDown }) {
  const top = Math.max(room.h, ...room.walls.map((w) => Math.max(w.h0, w.h1))) + 30;
  return roomWalls(room).map((g) => {
    const [x, z] = arcMid(g.a, g.b, g.n, g.wall.flecha || 0);
    return (
      <mesh key={g.id} position={[x * S, top * S, z * S]} renderOrder={3} userData={{ hotpoint: g.id }} onPointerDown={(e) => onDown(e, g)}>
        <boxGeometry args={[0.12, 0.012, 0.12]} />
        <meshBasicMaterial color="#16a34a" />
      </mesh>
    );
  });
}

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
function DragController({ onChangePlane, dragRef, setDrag, onMove, onMoveWall, onMoveNode, onResize, onMoveOpening, onMoveColumn, onMoveGeometry, onMoveHotpoint, onDragEnd, controlsRef, origin }) {
  const { camera, gl } = useThree();
  const live = useRef();
  live.current = { onChangePlane, camera, gl, onMove, onMoveWall, onMoveNode, onResize, onMoveOpening, onMoveColumn, onMoveGeometry, onMoveHotpoint, onDragEnd, origin };
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
      // Cerca del horizonte la proyección se dispara (decenas de metros por píxel): se ignora
      // ese movimiento y el objeto queda donde estaba en vez de salir volando.
      if (!cam.isOrthographicCamera && pt.distanceTo(cam.position) > MAX_DRAG_DIST) return;
      const snap = (val) => Math.round(val / drag.step) * drag.step;
      const rx = pt.x / S + o.x, rz = pt.z / S + o.z;
      if (drag.kind === 'resize') {
        const delta = drag.vertical ? ((pt.y - drag.p0.y) / S) * drag.sign : (rx - drag.sx) * drag.dir[0] + (rz - drag.sz) * drag.dir[1];
        cb.onResize(drag.start, drag.handle, snap(delta));
      } else if (drag.kind === 'opening') {
        cb.onMoveOpening(drag.id, drag.offset0 + snap((rx - drag.sx) * drag.u[0] + (rz - drag.sz) * drag.u[1]));
      } else if (drag.kind === 'hotpoint') {
        cb.onMoveHotpoint?.(drag.id, rx, rz);
      } else if (drag.kind === 'geometry') {
        cb.onMoveGeometry?.(drag.id, snap(rx - drag.offX), snap(rz - drag.offZ));
      } else if (drag.kind === 'column') {
        cb.onMoveColumn(drag.id, rx - drag.offX, rz - drag.offZ);
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
    // Clic derecho mientras se arrastra un módulo: pasa al plano que está bajo el mouse (piso,
    // arriba de otro módulo o contra una pared) y lo suelta ahí.
    const ctx = (ev) => {
      const drag = dragRef.current;
      if (!drag || drag.kind !== 'module' || !live.current.onChangePlane) return;
      ev.preventDefault();
      ev.stopPropagation();
      live.current.onChangePlane(drag.id, ev.clientX, ev.clientY);
      up();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('contextmenu', ctx, true);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('contextmenu', ctx, true); };
  }, [dragRef, setDrag, controlsRef]);
  return null;
}

// Centro de la caja envolvente del ambiente (mm).
const roomCenter = (room) => {
  const b = bounds(room);
  return { x: (b.minX + b.maxX) / 2, z: (b.minZ + b.maxZ) / 2 };
};

export default function Scene3D({ project, builtById, selectedId, selectedIds = [], onToggleSelect, onSelect, selectedWallId, onSelectWall, onMove, onMoveWall, onMoveNode, onResize, onDimEdit, onWallLength, onWallAngle, onWallContext, onModuleContext, onRestoreWall, selectedOpeningId, onSelectOpening, onMoveOpening, onOpeningDim, selectedColumnId, onSelectColumn, onMoveColumn, onWallDouble, onFloorDouble, onFloorDown, onFloorMenu, rulersOf, onChangePlane, bg = '#f3f4f6', lightK = 1, show = {}, surfaceRef, onMoveHotpoint, navTool = 'select', navRef, selectedGeoId, onSelectGeometry, onMoveGeometry, geoDraft, onGeometryMenu, annotating, onAnnotatePoint, onAnnotateFinish, selectedDimId, onSelectDim, drawing, drawCursorRef, onDrawPoint, onDrawFinish, step = 10, onDragStart, onDragEnd, renderMode, view, captureRef, renderRef, fill = 'texturas', showDims, autoHideWalls = true, pickRef, ghost, openFronts = {}, onToggleFront }) {
  const controlsRef = useRef();
  const [drag, setDrag] = useState(null);
  // Luz del modo render según el clima del render (sol, cielo, ambiente).
  const climaKey = JSON.stringify(project.render?.clima || null);
  const rig = useMemo(() => lightRig(project.render?.clima), [climaKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const dragRef = useRef(null);
  const { room } = project;
  const planta = view.name === 'planta';
  const navLock = navTool !== 'select';
  const selectedMod = project.modules.find((m) => m.id === selectedId) || null;
  // Origen del visor (mm del ambiente en el centro de la escena). Se fija al cambiar de
  // vista, no en cada cambio: si se recentrara mientras se arrastra una pared, la escena
  // se movería debajo del mouse.
  const [origin, setOrigin] = useState(() => roomCenter(room));
  useEffect(() => setOrigin(roomCenter(room)), [view.tick]); // eslint-disable-line react-hooks/exhaustive-deps
  const toRoom = (p) => [p.x / S + origin.x, p.z / S + origin.z];

  const leftButton = (e) => (e.nativeEvent?.button ?? 0) === 0; // los arrastres son con el botón izquierdo
  // Geometría: se elige con un clic y, si es movible y está en el piso o sobre un módulo, se arrastra.
  const onGeometryDown = (e, g) => {
    if (renderMode || navLock) return;
    e.stopPropagation();
    onSelectGeometry?.(g.id);
    if (!leftButton(e) || g.movable === false || g.plane.kind === 'wall') return;
    const [rx, rz] = toRoom(e.point);
    const b = boundsOf(outlineOf(g));
    startDrag({ kind: 'geometry', id: g.id, planeY: e.point.y, offX: rx - b.x0, offZ: rz - b.y0 });
  };
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
    if (renderMode || navLock) return;
    e.stopPropagation();
    if (handleHit(e)) return;
    // Ctrl+clic (como Promob): suma o quita el módulo de la selección, sin arrastrar.
    if ((e.ctrlKey || e.metaKey) && onToggleSelect) { onToggleSelect(mod.id); return; }
    // Si ya era parte de una selección múltiple, se conserva y se arrastra todo el conjunto.
    if (!(selectedIds.length > 1 && selectedIds.includes(mod.id))) onSelect(mod.id);
    if (!leftButton(e)) return;
    const [rx, rz] = toRoom(e.point);
    startDrag({ kind: 'module', id: mod.id, planeY: e.point.y, offX: rx - mod.x, offZ: rz - mod.z });
  };
  // Clic derecho en un módulo: su menú (tamaño máximo, rotar, duplicar, eliminar).
  const onModuleMenu = (e, mod) => {
    e.stopPropagation();
    if (!(selectedIds.length > 1 && selectedIds.includes(mod.id))) onSelect(mod.id); // el menú actúa sobre la selección
    onModuleContext?.({ id: mod.id, x: e.nativeEvent.clientX, y: e.nativeEvent.clientY });
  };
  // Abertura: se selecciona y se arrastra solo a lo largo de su pared.
  const onOpeningDown = (e, o, g) => {
    if (renderMode || navLock || handleHit(e)) return;
    onSelectOpening(o.id);
    if (!leftButton(e)) return;
    const [rx, rz] = toRoom(e.point);
    startDrag({ kind: 'opening', id: o.id, planeY: e.point.y, sx: rx, sz: rz, u: g.u, offset0: o.offset, step });
  };
  // Columna: se selecciona y se arrastra (imán a paredes y grilla).
  const onColumnDown = (e, c) => {
    if (renderMode || navLock || handleHit(e)) return;
    onSelectColumn(c.id);
    if (!leftButton(e)) return;
    const [rx, rz] = toRoom(e.point);
    startDrag({ kind: 'column', id: c.id, planeY: e.point.y, offX: rx - c.x, offZ: rz - c.z, step });
  };
  // Clic derecho en una pared: menú contextual en la posición del mouse (offset = punto sobre la pared).
  const onWallMenu = (e, g) => {
    const [rx, rz] = toRoom(e.point);
    onWallContext?.({ wallId: g.id, offset: (rx - g.a[0]) * g.u[0] + (rz - g.a[1]) * g.u[1], x: e.nativeEvent.clientX, y: e.nativeEvent.clientY });
  };
  // Pared: se selecciona siempre; se arrastra en Planta, o en 3D si es movible.
  const onWallDown = (e, g) => {
    if (renderMode || navLock) return;
    if (handleHit(e)) return;
    // En Planta el dintel tapa la abertura desde arriba: si el rayo pasa por una abertura de esta pared, es de la abertura.
    const op = e.intersections?.find((i) => i.object.userData?.openingPick);
    const o = op && room.openings.find((x) => x.id === op.object.userData.openingPick && x.wallId === g.id);
    if (o) { onOpeningDown({ ...e, point: op.point }, o, g); return; }
    // Clic en una pared rebajada a mano: se restaura (como hacer clic en su zócalo en Promob).
    if (g.wall.lowered && leftButton(e)) { onSelectWall(g.id); onRestoreWall?.(g.id); return; }
    onSelectWall(g.id);
    if (!leftButton(e) || !(planta || g.wall.movable)) return;
    const [rx, rz] = toRoom(e.point);
    startDrag({ kind: 'wall', id: g.id, planeY: e.point.y, sx: rx, sz: rz, n: g.n, step });
  };
  const onNodeDown = (e, n) => {
    if (renderMode || navLock || !leftButton(e)) return;
    e.stopPropagation();
    const [rx, rz] = toRoom(e.point);
    startDrag({ kind: 'node', id: n.id, planeY: e.point.y, offX: n.x - rx, offZ: n.z - rz, step });
  };
  // Flecha de redimensionar: el arrastre se mide sobre el eje de la flecha (en el mundo),
  // siempre desde el módulo como estaba al empezar.
  function onResizeDown(e, mod, handle, point = e.point) {
    if (renderMode || navLock || !leftButton(e)) return;
    e.stopPropagation();
    const h = RESIZE_HANDLES[handle];
    if (h.axis === 'y') return startDrag({ kind: 'resize', id: mod.id, handle, start: mod, vertical: true, sign: h.sign, p0: point.clone(), planeY: 0, step });
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
      onPointerMissed={() => !dragRef.current && !drawing && !annotating && onSelect(null)}
      onContextMenu={(e) => e.preventDefault()}
    >
      <FillContext.Provider value={fillMode(fill)}>
      <color attach="background" args={[fillMode(fill).bg || (renderMode ? '#e7e3dc' : bg)]} />
      <ambientLight intensity={renderMode ? 0.25 * rig.ambient : 0.6 * lightK} />
      <hemisphereLight args={renderMode ? [rig.sky.top, rig.sky.bottom, 0.35 * rig.sky.intensity] : ['#ffffff', '#cbbfae', 0.4 * lightK]} />
      <directionalLight
        name="sol"
        castShadow
        visible={!renderMode || rig.sun.on}
        position={renderMode ? rig.sun.dir.map((v) => v * 8) : [2.5, 4.5, 3.5]}
        color={renderMode ? rig.sun.color : '#ffffff'}
        intensity={renderMode ? rig.sun.intensity : 1.1}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-5}
        shadow-camera-right={5}
        shadow-camera-top={5}
        shadow-camera-bottom={-5}
        shadow-bias={-0.0004}
      />
      {renderMode && (
        <Environment resolution={256} frames={1}>
          <Lightformer intensity={2 * rig.sky.intensity} color={rig.sky.top} position={[0, 5, -3]} scale={[10, 4, 1]} />
          <Lightformer intensity={1.2 * rig.sky.intensity} color={rig.sky.bottom} position={[-5, 2, 1]} rotation-y={Math.PI / 2} scale={[10, 3, 1]} />
          <Lightformer intensity={1.2 * rig.sky.intensity} color={rig.sky.bottom} position={[5, 2, 1]} rotation-y={-Math.PI / 2} scale={[10, 3, 1]} />
          <Lightformer intensity={0.8 * rig.sky.intensity} color={rig.sky.bottom} position={[0, 2, 6]} rotation-y={Math.PI} scale={[10, 3, 1]} />
        </Environment>
      )}
      <group position={[-origin.x * S, 0, -origin.z * S]}>
        <FillGroup outline>
        <Room3D rulers={!renderMode ? rulersOf : null} room={room} origin={origin} autoHide={autoHideWalls} selectedWallId={renderMode ? null : selectedWallId} onWallDown={renderMode ? null : onWallDown}
          onWallMenu={renderMode || drawing || annotating ? null : onWallMenu}
          selectedOpeningId={renderMode ? null : selectedOpeningId} onOpeningDown={renderMode || drawing ? null : onOpeningDown}
          selectedColumnId={renderMode ? null : selectedColumnId} onColumnDown={renderMode || drawing ? null : onColumnDown}
          onWallDouble={renderMode || drawing || annotating ? null : onWallDouble} onFloorDouble={renderMode || drawing || annotating ? null : onFloorDouble}
          onFloorClick={(e) => { if (e.delta > 2 || dragRef.current || drawing || annotating || onFloorDown) return; onSelect(null); }}
          onFloorDown={renderMode || drawing || annotating ? null : onFloorDown}
          onFloorMenu={renderMode || drawing || annotating ? null : onFloorMenu}
          wallHoles={Object.fromEntries(room.walls.map((w) => [w.id, holesOn(project, { kind: 'wall', wallId: w.id })]))} floorHoles={holesOn(project, { kind: 'floor' })} />
        </FillGroup>
        {view.name === 'frente' && !renderMode && <HeightRuler room={room} modules={project.modules} />}
        {selectedOpeningId && !renderMode && <OpeningDims room={room} id={selectedOpeningId} onEdit={onOpeningDim} />}
        {planta && !renderMode && <PlanGrid room={room} />}
        {planta && !renderMode && show.planos !== false && project.planImage?.visible && <PlanImage img={project.planImage} />}
        {planta && !renderMode && !drawing && !annotating && navTool !== 'hotpoint' && <NodeHandles room={room} onNodeDown={onNodeDown} />}
        {(navTool === 'hotpoint' || show.hotpoints) && !renderMode && <HotpointHandles room={room} onDown={(e, g) => {
          e.stopPropagation();
          if (!leftButton(e)) return;
          startDrag({ kind: 'hotpoint', id: g.id, planeY: e.point.y });
        }} />}
        {planta && !renderMode && annotating && <AnnotateTool room={room} modules={project.modules} tool={annotating} origin={origin} onPoint={onAnnotatePoint} onFinish={onAnnotateFinish} />}
        {!renderMode && <Annotations annotations={project.annotations || []} selectedId={selectedDimId} onSelect={onSelectDim} />}
        {planta && !renderMode && drawing && <DrawTool room={room} draw={drawing} origin={origin} cursorRef={drawCursorRef} onPoint={onDrawPoint} onFinish={onDrawFinish} />}
        {showDims && !renderMode && <Dimensions room={room} modules={project.modules.filter((m) => !m.hidden)} onWallLength={onWallLength} onWallAngle={onWallAngle} />}
        {selectedMod && !renderMode && <ModuleDistances room={room} modules={project.modules} mod={selectedMod} onEdit={onDimEdit} vertical={!planta} />}
        {ghost && show.insercion !== false && <GhostBox mod={ghost} />}
        {renderMode && <Lights3D project={project} />}
        <FillGroup>
          {(project.geometries || []).map((g) => (
            <GeometryMesh key={g.id} g={g} room={room} modules={project.modules} selected={!renderMode && g.id === selectedGeoId} holes={g.hole?.on ? [] : holesInGeometry(project, g)}
              onDown={renderMode || drawing || annotating ? null : onGeometryDown} onMenu={onGeometryMenu ? (e, gg) => { e.stopPropagation(); onSelectGeometry?.(gg.id); onGeometryMenu(gg, e.nativeEvent); } : null} />
          ))}
        </FillGroup>
        {geoDraft && <GeometryMesh g={geoDraft} room={room} modules={project.modules} draft />}
        {show.invisibles && !renderMode && project.modules.filter((m) => m.hidden).map((m) => <GhostBox key={'inv' + m.id} mod={m} />)}
        {project.modules.map((m) => {
          const b = builtById.get(m.id);
          if (!b || m.hidden) return null; // oculto desde la Lista de módulos
          return <ModuleObject key={m.id} mod={m} b={b} selected={selectedIds.includes(m.id) || m.id === selectedId} showSel={!renderMode} onDown={onDown}
            onMenu={renderMode || drawing || annotating ? null : onModuleMenu}
            openState={openFronts[m.id]} onToggleFront={renderMode ? null : onToggleFront}
            onResizeDown={onResize && selectedIds.length < 2 && show.flechas !== false ? onResizeDown : null} planta={planta} />;
        })}
      </group>
      {/* sombra de contacto solo del visor: su textura vive en este renderer, no va a la ventana de render */}
      {renderMode && <group userData={{ noOffscreen: true }}><ContactShadows position={[0, 0.002, 0]} scale={12} blur={2.2} opacity={0.45} far={2.5} /></group>}
      {(planta || view.ortho) && <OrthographicCamera makeDefault near={0.1} far={200} position={[0, 40, 0.001]} />}
      <OrbitControls ref={controlsRef} makeDefault maxPolarAngle={planta ? Math.PI : Math.PI / 2 - 0.02} minDistance={0.5} maxDistance={20}
        enableRotate={!planta} zoomToCursor={planta} minZoom={15} maxZoom={4000} mouseButtons={NAV_BUTTONS[navTool] || (planta ? (drawing || annotating ? DRAW_BUTTONS : PLAN_BUTTONS) : ROTATE_BUTTONS)} />
      <CameraRig view={view} room={room} controlsRef={controlsRef} origin={origin} />
      {navRef && <NavBridge navRef={navRef} controlsRef={controlsRef} project={project} origin={origin} />}
      {surfaceRef && <SurfacePicker surfaceRef={surfaceRef} />}
      <Capturer captureRef={captureRef} />
      {renderRef && <RenderBridge renderRef={renderRef} room={room} origin={origin} />}
      <DevProbe project={project} origin={origin} openFronts={openFronts} />
      {pickRef && <Picker pickRef={pickRef} origin={origin} />}
      <DragController onChangePlane={onChangePlane} dragRef={dragRef} setDrag={setDrag} onMove={onMove} onMoveWall={onMoveWall} onMoveNode={onMoveNode} onResize={onResize} onMoveOpening={onMoveOpening} onMoveColumn={onMoveColumn} onMoveGeometry={onMoveGeometry} onMoveHotpoint={onMoveHotpoint} onDragEnd={onDragEnd} controlsRef={controlsRef} origin={origin} />
      </FillContext.Provider>
    </Canvas>
  );
}
