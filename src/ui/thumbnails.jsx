import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { buildAll } from '../domain/cutlist.js';
import { itemParams } from '../domain/library.js';
import { mat3d, metal, stone } from './materials3d.js';

// Miniaturas del catálogo generadas con el mismo modelo 3D que el visor (como Promob):
// un único renderer fuera de pantalla, de a una por vez, con caché por ítem + medidas + materiales.
const SIZE = 140;
const S = 0.001;
const cache = new Map();
const waiting = new Map();
let renderer = null;
let queue = Promise.resolve();

function getRenderer() {
  if (renderer) return renderer;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setSize(SIZE, SIZE, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  return renderer;
}

function box({ x, y, z, sx, sy, sz, ry = 0 }, material) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(sx * S, sy * S, sz * S), material);
  m.position.set((x + sx / 2) * S, (y + sy / 2) * S, (z + sz / 2) * S);
  m.rotation.y = ry;
  return m;
}

function render(item, variant, ctx) {
  const params = itemParams(item, variant);
  const mod = { id: 'thumb', type: item.type, params, x: 0, z: 0, y: 0, rot: 0, mats: {} };
  const [b] = buildAll({ ...ctx.project, modules: [mod] }, ctx.settings);
  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(0xffffff, 0.7));
  scene.add(new THREE.HemisphereLight(0xffffff, 0xcbbfae, 0.6));
  const sun = new THREE.DirectionalLight(0xffffff, 1.5);
  sun.position.set(2, 3, 4);
  scene.add(sun);
  const { width: W, height: H, depth: D } = params;
  const g = new THREE.Group();
  g.position.set((-W / 2) * S, (-H / 2) * S, (-D / 2) * S);
  for (const p of b.parts) g.add(box(p, mat3d(b.mats[p.role])));
  for (const d of b.decors) g.add(box(d, d.decor === 'mesada' ? stone : metal));
  scene.add(g);
  // Cámara de frente, un poco de costado y desde arriba; encuadra la esfera que envuelve al módulo.
  const cam = new THREE.PerspectiveCamera(28, 1, 0.01, 100);
  const r = 0.5 * Math.hypot(W, H, D) * S;
  const dist = (r / Math.sin(((cam.fov / 2) * Math.PI) / 180)) * 1.02;
  cam.position.copy(new THREE.Vector3(0.55, 0.35, 1).normalize().multiplyScalar(dist));
  cam.lookAt(0, 0, 0);
  const rd = getRenderer();
  rd.setClearColor(0x000000, 0);
  rd.render(scene, cam);
  const url = rd.domElement.toDataURL('image/png');
  g.traverse((o) => o.geometry?.dispose());
  return url;
}

// Pide la miniatura (se resuelve en cola, sin trabar la interfaz).
export function thumbnail(item, variant, ctx) {
  const key = `${item.id}|${variant ?? ''}|${ctx.key}`;
  if (cache.has(key)) return Promise.resolve(cache.get(key));
  if (waiting.has(key)) return waiting.get(key);
  const p = (queue = queue.then(() => new Promise((ok) => setTimeout(ok, 0))).then(() => {
    let url = null;
    try { url = render(item, variant, ctx); } catch { /* sin WebGL: queda la silueta */ }
    cache.set(key, url);
    waiting.delete(key);
    return url;
  }));
  waiting.set(key, p);
  return p;
}

export function ModelThumb({ item, variant = null, ctx }) {
  const key = `${item.id}|${variant ?? ''}|${ctx.key}`;
  const [src, setSrc] = useState(() => cache.get(key) || null);
  useEffect(() => {
    let alive = true;
    thumbnail(item, variant, ctx).then((u) => { if (alive) setSrc(u); });
    return () => { alive = false; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return src ? <img className="cb-thumb" src={src} alt="" draggable={false} /> : <Silhouette item={item} />;
}

// Silueta provisoria (proporcional a ancho × alto) hasta tener la miniatura del 3D.
export function Silhouette({ item }) {
  const p = itemParams(item);
  const k = 64 / Math.max(p.width, p.height);
  const w = Math.max(10, p.width * k), h = Math.max(10, p.height * k);
  return (
    <svg className="cb-thumb" viewBox="0 0 70 70" aria-hidden="true">
      <rect x={(70 - w) / 2} y={70 - h - 2} width={w} height={h} rx="1.5" fill="#d8c3a5" stroke="#8a6d4b" />
    </svg>
  );
}

