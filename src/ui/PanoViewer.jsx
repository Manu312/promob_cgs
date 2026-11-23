import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { PANO_VIEW, panoDrag, panoZoom } from '../domain/render.js';

// Visor del panorama 360°: arrastrar para mirar alrededor, rueda para acercar/alejar.
// Dibuja cada píxel buscando en el panorama la dirección que se ve (misma convención que equirectDir).
const VS = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const FS = `
uniform sampler2D pano;
uniform float yaw, pitch, tanHalf, aspect;
varying vec2 vUv;
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  vec3 d = normalize(vec3(p.x * tanHalf * aspect, p.y * tanHalf, -1.0));
  float cp = cos(pitch), sp = sin(pitch);
  d = vec3(d.x, d.y * cp - d.z * sp, d.y * sp + d.z * cp);
  float cy = cos(yaw), sy = sin(yaw);
  d = vec3(d.x * cy - d.z * sy, d.y, d.x * sy + d.z * cy);
  float lon = atan(d.x, -d.z);
  float lat = asin(clamp(d.y, -1.0, 1.0));
  gl_FragColor = texture2D(pano, vec2(lon / 6.28318530718 + 0.5, lat / 3.14159265359 + 0.5));
}`;

export default function PanoViewer({ source, onClose }) {
  const holder = useRef(null);
  const viewRef = useRef(PANO_VIEW);
  const [view, setView] = useState(PANO_VIEW);
  const draw = useRef(null);

  useEffect(() => {
    const el = holder.current;
    const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace; // el panorama ya está en sRGB
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    el.appendChild(renderer.domElement);
    const tex = new THREE.CanvasTexture(source);
    tex.wrapS = THREE.RepeatWrapping;
    tex.minFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    const mat = new THREE.ShaderMaterial({ uniforms: { pano: { value: tex }, yaw: { value: 0 }, pitch: { value: 0 }, tanHalf: { value: 1 }, aspect: { value: 1 } }, vertexShader: VS, fragmentShader: FS });
    const scene = new THREE.Scene();
    scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    draw.current = () => {
      const w = el.clientWidth || 800;
      const h = el.clientHeight || 450;
      renderer.setSize(w, h);
      const v = viewRef.current;
      mat.uniforms.yaw.value = (v.yaw * Math.PI) / 180;
      mat.uniforms.pitch.value = (v.pitch * Math.PI) / 180;
      mat.uniforms.tanHalf.value = Math.tan(((v.fov * Math.PI) / 180) / 2);
      mat.uniforms.aspect.value = w / h;
      renderer.render(scene, cam);
    };
    draw.current();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => draw.current?.()) : null;
    ro?.observe(el);
    return () => { ro?.disconnect(); draw.current = null; tex.dispose(); mat.dispose(); renderer.dispose(); renderer.domElement.remove(); };
  }, [source]);

  const update = (v) => { viewRef.current = v; setView(v); draw.current?.(); };
  const last = useRef(null);
  return (
    <div className="pano-viewer" data-yaw={Math.round(view.yaw)} data-pitch={Math.round(view.pitch)} data-fov={Math.round(view.fov)}>
      <div className="pv-canvas" ref={holder}
        onPointerDown={(e) => { e.currentTarget.setPointerCapture?.(e.pointerId); last.current = [e.clientX, e.clientY]; }}
        onPointerMove={(e) => {
          if (!last.current) return;
          const [x, y] = last.current;
          last.current = [e.clientX, e.clientY];
          update(panoDrag(viewRef.current, e.clientX - x, e.clientY - y));
        }}
        onPointerUp={() => { last.current = null; }}
        onWheel={(e) => update(panoZoom(viewRef.current, e.deltaY))} />
      <div className="pv-bar">
        <span>Arrastrá para mirar alrededor · rueda para acercar</span>
        <button onClick={() => update(PANO_VIEW)}>Centrar</button>
        <button onClick={onClose}>Volver a la imagen</button>
      </div>
    </div>
  );
}
