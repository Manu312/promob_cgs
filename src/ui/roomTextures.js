import * as THREE from 'three';
import { roomMatById, textureRepeat } from '../domain/roomMaterials.js';

// Texturas propias (dibujadas en un canvas) para los materiales del ambiente: una baldosa o una
// tabla por textura, con su junta; la pintura es color liso.
const texCache = new Map();
const PX = 256;

function shade(hex, k) {
  const c = new THREE.Color(hex);
  c.offsetHSL(0, 0, k);
  return `#${c.getHexString()}`;
}

function drawTile(m) {
  const [tw, th] = m.tile;
  const w = PX, h = Math.max(8, Math.round((PX * th) / tw));
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  if (m.kind === 'madera') {
    g.fillStyle = m.color; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) { // vetas
      g.strokeStyle = i % 2 ? shade(m.color2, 0.03) : shade(m.color, -0.05);
      g.globalAlpha = 0.35; g.lineWidth = 1 + (i % 3);
      const y = (h * (i + 0.5)) / 40 + Math.sin(i * 7.3) * 2;
      g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(w * 0.3, y + 3, w * 0.6, y - 3, w, y + 1); g.stroke();
    }
    g.globalAlpha = 1; g.strokeStyle = shade(m.color2, -0.12); g.lineWidth = 2; g.strokeRect(0, 0, w, h);
  } else {
    g.fillStyle = m.color; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 300; i++) { // leve variación
      g.fillStyle = shade(m.color, (Math.sin(i * 12.9898) * 43758.5453 % 1) * 0.04);
      g.globalAlpha = 0.25; g.fillRect((i * 37) % w, (i * 53) % h, 6, 6);
    }
    g.globalAlpha = 1;
    if (m.joint) { // junta en el borde de la baldosa
      const j = Math.max(1, Math.round((m.joint / tw) * w));
      g.fillStyle = m.jointColor; g.fillRect(0, 0, w, j); g.fillRect(0, 0, j, h);
    }
  }
  return c;
}

function baseTexture(m) {
  if (!texCache.has(m.id)) {
    const t = new THREE.CanvasTexture(drawTile(m));
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 4;
    texCache.set(m.id, t);
  }
  return texCache.get(m.id);
}

// Muestra chica (data URL) para el panel de materiales.
const swatchCache = new Map();
export function swatchUrl(id) {
  const m = roomMatById(id);
  if (!m) return '';
  if (m.kind === 'pintura') return '';
  if (!swatchCache.has(id)) swatchCache.set(id, drawTile(m).toDataURL('image/png'));
  return swatchCache.get(id);
}

const matCache = new Map();
// Material de una cara de w × h mm con esa terminación (o null si no tiene).
export function finishMaterial(finish, wMm, hMm, base) {
  if (!finish) return null;
  const m = roomMatById(finish.mat);
  if (!m) return null;
  const [rx, ry] = textureRepeat(finish, wMm, hMm);
  const key = `${JSON.stringify(finish)}|${Math.round(wMm)}|${Math.round(hMm)}|${base?.side ?? 0}|${base?.transparent ? 1 : 0}`;
  if (matCache.has(key)) return matCache.get(key);
  const opts = { side: base?.side ?? THREE.FrontSide, roughness: m.kind === 'pintura' ? 0.92 : m.kind === 'madera' ? 0.6 : 0.35, metalness: 0, transparent: base?.transparent, opacity: base?.opacity ?? 1, depthWrite: base?.depthWrite ?? true };
  let mat;
  if (m.kind === 'pintura') mat = new THREE.MeshStandardMaterial({ ...opts, color: finish.tint || m.color });
  else {
    const t = baseTexture(m).clone();
    t.needsUpdate = true;
    t.repeat.set(rx * (finish.mirrorX ? -1 : 1), ry * (finish.mirrorY ? -1 : 1));
    t.rotation = (finish.rot * Math.PI) / 180;
    mat = new THREE.MeshStandardMaterial({ ...opts, map: t, color: finish.tint || '#ffffff' });
  }
  mat.userData.baseColor = finish.tint || m.color;
  matCache.set(key, mat);
  return mat;
}
