import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { planImageSize } from '../domain/planImage.js';

const S = 0.001;

// Plano de referencia apoyado en el piso (solo Planta). No toma clics y el capturador lo
// oculta al exportar la imagen.
export function PlanImage({ img }) {
  const tex = useMemo(() => { const t = new THREE.TextureLoader().load(img.src); t.colorSpace = THREE.SRGBColorSpace; return t; }, [img.src]);
  useEffect(() => () => tex.dispose(), [tex]);
  const { w, h } = planImageSize(img);
  return (
    <mesh name="planImage" position={[(img.x + w / 2) * S, 0.004, (img.z + h / 2) * S]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null} renderOrder={0}>
      <planeGeometry args={[w * S, h * S]} />
      <meshBasicMaterial map={tex} transparent opacity={img.opacity} depthWrite={false} />
    </mesh>
  );
}
