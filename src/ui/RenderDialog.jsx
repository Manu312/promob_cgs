import { useEffect, useState } from 'react';
import { QUALITIES, SIZE_PRESETS, SIZE_MODES, MIN_SIDE, MAX_SIDE, renderSize, setCustomSide } from '../domain/render.js';
import { NumField } from './fields.jsx';

// Diálogo "Configuración del render" (como el de Promob): pestañas con la calidad y la dimensión,
// el clima, el fondo, la marca de agua y el 360°. Cada cambio se guarda en el proyecto.
export const RENDER_TABS = [['general', 'Calidad y dimensión']];

export default function RenderDialog({ config, view, onChange, onRender, onClose }) {
  const [tab, setTab] = useState('general');
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  const size = renderSize(config, view);
  const setSize = (patch) => onChange((r) => ({ ...r, size: { ...r.size, ...patch } }));
  const q = QUALITIES.find((x) => x.id === config.quality);
  return (
    <div className="render-dialog" role="dialog" aria-label="Configuración del render">
      <header>
        <h3>Configuración del render</h3>
        <button className="icon-btn" onClick={onClose} title="Cerrar (Esc)">✕</button>
      </header>
      <nav className="rd-tabs">
        {RENDER_TABS.map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}
      </nav>
      {tab === 'general' && (
        <div className="rd-body">
          <fieldset>
            <legend>Calidad</legend>
            {QUALITIES.map((x) => (
              <label key={x.id} className="radio" title={x.hint}>
                <input type="radio" name="rd-quality" checked={config.quality === x.id} onChange={() => onChange((r) => ({ ...r, quality: x.id }))} /> {x.label}
              </label>
            ))}
            <p className="hint">{q?.hint}</p>
            {q?.pathTrace && (
              <div className="rd-row">
                <NumField label="Muestras" value={config.samples[q.id]} min={10} max={20000} step={50}
                  onChange={(v) => onChange((r) => ({ ...r, samples: { ...r.samples, [q.id]: v } }))} />
                <NumField label="Rebotes de luz" value={config.bounces[q.id]} min={1} max={30}
                  onChange={(v) => onChange((r) => ({ ...r, bounces: { ...r.bounces, [q.id]: v } }))} />
              </div>
            )}
          </fieldset>
          <fieldset>
            <legend>Dimensión</legend>
            {SIZE_MODES.map(([k, l]) => (
              <label key={k} className="radio">
                <input type="radio" name="rd-size" checked={config.size.mode === k} onChange={() => setSize({ mode: k })} /> {l}
              </label>
            ))}
            {config.size.mode === 'preset' && (
              <select className="rd-preset" value={config.size.preset} onChange={(e) => setSize({ preset: e.target.value })}>
                {SIZE_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            )}
            {config.size.mode === 'custom' && (
              <div className="rd-row">
                <NumField label="Ancho" unit="px" value={config.size.width} min={MIN_SIDE} max={MAX_SIDE}
                  onChange={(v) => onChange((r) => ({ ...r, size: setCustomSide(r.size, 'width', v) }))} />
                <NumField label="Alto" unit="px" value={config.size.height} min={MIN_SIDE} max={MAX_SIDE}
                  onChange={(v) => onChange((r) => ({ ...r, size: setCustomSide(r.size, 'height', v) }))} />
                <label className="check rd-lock" title="Mantener la proporción entre ancho y alto">
                  <input type="checkbox" checked={config.size.lock} onChange={(e) => setSize({ lock: e.target.checked })} /> Mantener proporción
                </label>
              </div>
            )}
            <p className="rd-size">Tamaño de la imagen: <b>{size.width} × {size.height}</b> px</p>
            <label className="check">
              <input type="checkbox" checked={config.showArea} onChange={(e) => onChange((r) => ({ ...r, showArea: e.target.checked }))} /> Mostrar el área del render en la vista
            </label>
          </fieldset>
        </div>
      )}
      <footer>
        <button onClick={onClose}>Cerrar</button>
        <button className="active" onClick={onRender}>Renderizar</button>
      </footer>
    </div>
  );
}

// Recuadro del área que se va a renderizar (lo de afuera queda oscurecido).
export function RenderArea({ rect, size }) {
  return (
    <div className="render-area" style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}>
      <span>{size.width} × {size.height}</span>
    </div>
  );
}
