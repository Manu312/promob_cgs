import * as THREE from 'three';
import { WebGLPathTracer, GradientEquirectTexture } from 'three-gpu-pathtracer';
import { fitRect, renderFov } from '../domain/render.js';

// Motor de la ventana de render: un WebGLRenderer aparte, fuera de pantalla, al tamaño pedido.
// Usa la misma escena del visor (three guarda los recursos de GPU por renderer) y una copia de la
// cámara que encuadra exactamente el área del render. La imagen se compone en un canvas 2D:
// fondo → render (con fondo transparente) → marca de agua.

// Copia de la cámara del visor que ve solo el área del render (el recuadro centrado en la vista).
export function makeRenderCamera(camera, view, size) {
  const aspect = size.width / size.height;
  const rect = fitRect(aspect, view.width, view.height);
  const cam = camera.clone();
  if (cam.isPerspectiveCamera) {
    cam.fov = renderFov(camera.fov, rect.h / view.height);
    cam.aspect = aspect;
  } else {
    const hh = ((camera.top - camera.bottom) * (rect.h / view.height)) / 2;
    const cx = (camera.left + camera.right) / 2;
    const cy = (camera.top + camera.bottom) / 2;
    Object.assign(cam, { top: cy + hh, bottom: cy - hh, left: cx - hh * aspect, right: cx + hh * aspect });
  }
  cam.updateProjectionMatrix();
  return cam;
}

// Cielo del clima (degradé cenit → horizonte) como entorno: ilumina la escena, no es el fondo.
function skyTexture(sky) {
  const env = new GradientEquirectTexture(256);
  env.topColor.set(sky?.top || '#fffaf2');
  env.bottomColor.set(sky?.bottom || '#b9b2a6');
  env.exponent = 2;
  env.update();
  return env;
}

// Crea un trabajo de render. `quality` = qualityOf(config); `onProgress(muestras)` se llama al avanzar.
export function createRenderJob({ gl, scene, camera, view, size, quality, rig, background = '#e7e3dc', onProgress, onDone }) {
  const { width: W, height: H } = size;
  const glCanvas = document.createElement('canvas');
  const off = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  off.setPixelRatio(1);
  off.setSize(W, H, false);
  off.outputColorSpace = gl.outputColorSpace;
  off.toneMapping = gl.toneMapping;
  off.toneMappingExposure = gl.toneMappingExposure;
  off.shadowMap.enabled = true;
  off.shadowMap.type = gl.shadowMap.type;
  off.setClearColor(0x000000, 0);

  const output = document.createElement('canvas');
  output.width = W;
  output.height = H;
  const ctx = output.getContext('2d');
  const cam = makeRenderCamera(camera, view, size);
  const env = skyTexture(rig?.sky);

  // La escena es la del visor: durante cada llamada se cambia el entorno por el del render, se saca
  // el fondo (lo pone la composición) y se ocultan las cosas que solo existen en el renderer del visor.
  // El rasterizado ya suma las luces del visor (ambiente, hemisférica, sol): el cielo ilumina menos.
  // El trazado de rayos no usa la luz ambiente de three: la "luz ambiente" es un mínimo de cielo.
  const skyI = rig ? rig.sky.intensity : 1;
  const envIntensity = quality.pathTrace ? Math.max(skyI, rig?.ambient ? 0.25 : 0) : skyI * 0.4;
  const withScene = (fn) => {
    const bg = scene.background;
    const en = scene.environment;
    const ei = scene.environmentIntensity;
    const hidden = [];
    scene.traverse((o) => { if (o.userData.noOffscreen && o.visible) { o.visible = false; hidden.push(o); } });
    scene.background = null;
    scene.environment = env;
    scene.environmentIntensity = envIntensity;
    try { return fn(); } finally {
      scene.background = bg;
      scene.environment = en;
      scene.environmentIntensity = ei;
      hidden.forEach((o) => { o.visible = true; });
    }
  };

  const compose = () => {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, W, H);
    ctx.drawImage(glCanvas, 0, 0, W, H);
  };

  let pt = null;
  let raf = 0;
  let running = false;
  let disposed = false;
  let frame = 0;
  const target = quality.pathTrace ? quality.samples : 1;
  const samples = () => (pt ? Math.min(target, Math.floor(pt.samples)) : 0);

  const finish = () => { running = false; compose(); onDone?.(); };
  const tick = () => {
    if (!running || disposed) return;
    pt.renderSample();
    frame += 1;
    const s = samples();
    if (s >= target) { onProgress?.(s); finish(); return; }
    if (frame % 6 === 0) { compose(); onProgress?.(s); }
    raf = requestAnimationFrame(tick);
  };

  const job = {
    output,
    width: W,
    height: H,
    get running() { return running; },
    get samples() { return quality.pathTrace ? samples() : (running ? 0 : 1); },
    target,
    start() {
      if (disposed) return;
      if (!quality.pathTrace) {
        withScene(() => off.render(scene, cam));
        onProgress?.(1);
        finish();
        return;
      }
      if (!pt) {
        pt = new WebGLPathTracer(off);
        pt.bounces = quality.bounces;
        pt.tiles.set(2, 2);
        pt.minSamples = 1;
        pt.renderDelay = 0;
        pt.fadeDuration = 0;
        pt.rasterizeScene = false; // el rasterizado usaría el entorno del visor
        pt.filterGlossyFactor = 0.5;
        withScene(() => pt.setScene(scene, cam));
      }
      if (samples() >= target) return;
      running = true;
      raf = requestAnimationFrame(tick);
    },
    stop() {
      if (!running) return;
      cancelAnimationFrame(raf);
      running = false;
      compose();
    },
    dispose() {
      disposed = true;
      running = false;
      cancelAnimationFrame(raf);
      try { pt?.dispose(); } catch { /* three-gpu-pathtracer 0.0.23 falla al liberar recursos internos no creados */ }
      env.dispose();
      off.dispose();
      off.forceContextLoss();
    },
  };
  return job;
}
