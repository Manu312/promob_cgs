import * as THREE from 'three';

const cache = new Map();

function seedFrom(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return (Math.abs(h) % 2147483646) + 1;
}

// Opera en sRGB directo (THREE.Color convertiría a lineal y oscurecería el canvas).
function shade(hex, f) {
  const n = parseInt(hex.replace('#', ''), 16);
  const ch = (v) => Math.max(0, Math.min(255, Math.round(v * f)));
  return `rgb(${ch((n >> 16) & 255)},${ch((n >> 8) & 255)},${ch(n & 255)})`;
}

// Veta de madera procedural, vertical (a lo largo de la altura de puertas y laterales).
function woodTexture(hex) {
  const S = 1024;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  let seed = seedFrom(hex);
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

  // Bandas anchas de tono (tablas / variación natural)
  let x = 0;
  while (x < S) {
    const w = 60 + rnd() * 160;
    g.fillStyle = shade(hex, 0.92 + rnd() * 0.16);
    g.fillRect(x, 0, w + 1, S);
    x += w;
  }
  // Fibras finas casi rectas
  for (let i = 0; i < 900; i++) {
    const x0 = rnd() * S, drift = (rnd() - 0.5) * 6, dark = rnd() < 0.7;
    g.strokeStyle = dark ? `rgba(30,15,0,${0.03 + rnd() * 0.07})` : `rgba(255,245,230,${0.02 + rnd() * 0.05})`;
    g.lineWidth = 0.4 + rnd() * 1.6;
    g.beginPath();
    g.moveTo(x0, 0);
    for (let y = 0; y <= S; y += 64) g.lineTo(x0 + drift * Math.sin(y / 180 + i), y);
    g.stroke();
  }
  // Algunas "catedrales" suaves
  for (let k = 0; k < 4; k++) {
    const cx = rnd() * S, cy = rnd() * S, h = 200 + rnd() * 300;
    for (let r = 0; r < 8; r++) {
      g.strokeStyle = `rgba(40,20,0,${0.035})`;
      g.lineWidth = 1.2;
      g.beginPath();
      g.ellipse(cx, cy, 10 + r * 9, h / 2 + r * 18, 0, 0, Math.PI * 2);
      g.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

export function mat3d(m) {
  const key = `${m.id}|${m.color}|${m.wood ? 1 : 0}`;
  if (!cache.has(key)) {
    cache.set(key, new THREE.MeshStandardMaterial({
      color: '#ffffff',
      ...(m.wood ? { map: woodTexture(m.color) } : { color: m.color }),
      roughness: m.wood ? 0.6 : 0.45,
      metalness: 0,
    }));
  }
  return cache.get(key);
}

export const metal = new THREE.MeshStandardMaterial({ color: '#a3a8ad', metalness: 0.85, roughness: 0.3 });
export const stone = new THREE.MeshStandardMaterial({ color: '#5d5f61', roughness: 0.28, metalness: 0.05 });
