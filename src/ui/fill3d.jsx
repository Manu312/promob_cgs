import { createContext, useContext, useLayoutEffect, useRef } from 'react';
import * as THREE from 'three';
import { Edges } from '@react-three/drei';
import { fillMode } from '../domain/fillModes.js';

// Modos de relleno en el 3D: cada malla pide su material según el modo y, si el modo lleva líneas,
// dibuja sus aristas. El contexto vive adentro del <Canvas>.
export const FillContext = createContext(fillMode());

const off = { polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 };
const WHITE = new THREE.MeshBasicMaterial({ color: '#ffffff', ...off });
const BLACK = new THREE.MeshBasicMaterial({ color: '#000000', ...off });
const NONE = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
const plainCache = new Map();

// Color liso de un material (las maderas y piedras guardan su color base en userData).
function plain(mat) {
  if (plainCache.has(mat.uuid)) return plainCache.get(mat.uuid);
  const color = mat.userData?.baseColor || `#${mat.color.getHexString()}`;
  const p = new THREE.MeshStandardMaterial({ color, roughness: mat.roughness ?? 0.6, metalness: mat.metalness ?? 0, transparent: mat.transparent, opacity: mat.opacity, ...off });
  plainCache.set(mat.uuid, p);
  return p;
}

export function fillMaterial(mode, mat) {
  if (!mat) return mat;
  switch (mode.faces) {
    case 'color': return plain(mat);
    case 'blanco': return mat.transparent ? NONE : WHITE;
    case 'negro': return mat.transparent ? NONE : BLACK;
    case 'ninguna': return NONE;
    default: return mat;
  }
}

export const useFill = () => useContext(FillContext);

// Aristas de la malla padre si el modo lleva líneas.
export function FillEdges({ force = false }) {
  const mode = useFill();
  if (!mode.lines && !force) return null;
  return <Edges threshold={20} color={mode.lineColor || '#374151'} />;
}

export const NONE_MATERIAL = NONE;

const lineMats = new Map();
const lineMat = (c = '#374151') => {
  if (!lineMats.has(c)) lineMats.set(c, new THREE.LineBasicMaterial({ color: c }));
  return lineMats.get(c);
};

// Aplica el modo de relleno a todas las mallas de adentro (cambia el material y agrega o saca
// las aristas). `outline`: en "Caja de contorno" estas mallas muestran su contorno (paredes).
export function FillGroup({ children, outline = false, ...props }) {
  const mode = useFill();
  const ref = useRef();
  useLayoutEffect(() => {
    const lines = mode.lines || (mode.box && outline);
    ref.current?.traverse((o) => {
      if (!o.isMesh || o.userData.noFill) return;
      if (o.material !== o.userData.fillApplied) o.userData.fillOrig = o.material; // React le puso uno nuevo
      const m = fillMaterial(mode, o.userData.fillOrig);
      o.material = m;
      o.userData.fillApplied = m;
      let e = o.userData.fillEdges;
      if (lines) {
        if (!e || e.userData.geo !== o.geometry) {
          if (e) { o.remove(e); e.geometry.dispose(); }
          e = new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry, 20), lineMat(mode.lineColor));
          e.userData.geo = o.geometry;
          e.raycast = () => {};
          o.add(e);
          o.userData.fillEdges = e;
        } else e.material = lineMat(mode.lineColor);
      } else if (e) {
        o.remove(e);
        e.geometry.dispose();
        o.userData.fillEdges = null;
      }
    });
  });
  return <group ref={ref} {...props}>{children}</group>;
}
