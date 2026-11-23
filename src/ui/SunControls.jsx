import { useRef } from 'react';
import { azimuthFromPoint, altitudeFromPoint } from '../domain/render.js';

// Controles visuales del sol: brújula para el azimut y cuarto de círculo para la altitud.
// Se arrastran (o se hace clic) y avisan el ángulo; `onBegin`/`onEnd` agrupan el arrastre en un solo deshacer.
function useDragAngle(toAngle, onChange, onBegin, onEnd) {
  const ref = useRef(null);
  const at = (e) => {
    const r = ref.current.getBoundingClientRect();
    onChange(toAngle(r, e.clientX, e.clientY));
  };
  return {
    ref,
    onPointerDown: (e) => {
      e.currentTarget.setPointerCapture?.(e.pointerId);
      onBegin?.();
      at(e);
    },
    onPointerMove: (e) => { if (e.buttons & 1) at(e); },
    onPointerUp: () => onEnd?.(),
  };
}

const R = 46;
export function Compass({ value, onChange, onBegin, onEnd }) {
  const drag = useDragAngle((r, x, y) => azimuthFromPoint(r.left + r.width / 2, r.top + r.height / 2, x, y), onChange, onBegin, onEnd);
  const a = (value * Math.PI) / 180;
  const sx = 60 + Math.sin(a) * R;
  const sy = 60 - Math.cos(a) * R;
  return (
    <svg className="sun-compass" viewBox="0 0 120 120" width="120" height="120" role="slider" aria-label="Azimut" aria-valuenow={value} {...drag}>
      <circle cx="60" cy="60" r={R} className="sc-ring" />
      {[0, 90, 180, 270].map((d) => {
        const t = (d * Math.PI) / 180;
        return <line key={d} x1={60 + Math.sin(t) * (R - 6)} y1={60 - Math.cos(t) * (R - 6)} x2={60 + Math.sin(t) * R} y2={60 - Math.cos(t) * R} className="sc-tick" />;
      })}
      <text x="60" y="9" textAnchor="middle">Fondo</text>
      <text x="117" y="63" textAnchor="end">Der.</text>
      <text x="60" y="118" textAnchor="middle">Frente</text>
      <text x="3" y="63">Izq.</text>
      <rect x="44" y="48" width="32" height="24" className="sc-room" />
      <line x1="60" y1="60" x2={sx} y2={sy} className="sc-ray" />
      <circle cx={sx} cy={sy} r="7" className="sc-sun" />
    </svg>
  );
}

export function AltitudeArc({ value, onChange, onBegin, onEnd }) {
  // centro del arco: abajo a la izquierda del control (10, 110) en un viewBox de 120
  const drag = useDragAngle((r, x, y) => altitudeFromPoint(r.left + (10 / 120) * r.width, r.top + (110 / 120) * r.height, x, y), onChange, onBegin, onEnd);
  const a = (value * Math.PI) / 180;
  const L = 92;
  const sx = 10 + Math.cos(a) * L;
  const sy = 110 - Math.sin(a) * L;
  return (
    <svg className="sun-altitude" viewBox="0 0 120 120" width="120" height="120" role="slider" aria-label="Altitud" aria-valuenow={value} {...drag}>
      <path d={`M ${10 + L} 110 A ${L} ${L} 0 0 0 10 ${110 - L}`} className="sc-ring" />
      <line x1="10" y1="110" x2="116" y2="110" className="sc-tick" />
      <line x1="10" y1="110" x2="10" y2="8" className="sc-tick" />
      <line x1="10" y1="110" x2={sx} y2={sy} className="sc-ray" />
      <circle cx={sx} cy={sy} r="7" className="sc-sun" />
      <text x="116" y="104" textAnchor="end">0°</text>
      <text x="16" y="14">90°</text>
    </svg>
  );
}
