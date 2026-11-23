import { useEffect } from 'react';
import { MODULE_TYPES, moduleName } from '../domain/modules.js';
import { LIGHT_KINDS } from '../domain/lights.js';
import { NumField } from './fields.jsx';

// Editor de luces (Promob): todas las luminarias del proyecto con sus propiedades. Las luces se
// ven en el Modo render y en el render.
export default function LightsEditor({ project, onParams, onSelect, onClose }) {
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  const lums = project.modules.filter((m) => MODULE_TYPES[m.type]?.light);
  return (
    <div className="render-dialog lights-editor" role="dialog" aria-label="Editor de luces">
      <header><h3>Editor de luces</h3><button className="icon-btn" onClick={onClose}>✕</button></header>
      <div className="rd-body">
        {!lums.length && <p className="hint">No hay luminarias. Insertalas desde la biblioteca Lumen.</p>}
        {lums.map((m) => {
          const def = MODULE_TYPES[m.type], p = m.params;
          const kind = LIGHT_KINDS.find(([k]) => k === def.light.kind)?.[1];
          const set = (patch) => onParams(m.id, patch);
          return (
            <fieldset key={m.id} className="le-item">
              <legend><button className="link" onClick={() => onSelect(m.id)}>{moduleName(m)}</button> · {kind}</legend>
              <label className="field"><span>Color</span><input type="color" value={p.lightColor} onChange={(e) => set({ lightColor: e.target.value })} /></label>
              <label className="rd-slider"><span>Intensidad</span><input type="range" min={0} max={2} step={0.1} value={p.lightI} onChange={(e) => set({ lightI: +e.target.value })} /><b>{(+p.lightI).toFixed(1)}</b></label>
              {def.light.kind === 'spot' && <>
                <NumField label="Apertura" unit="°" value={p.beam} min={5} max={160} step={5} onChange={(v) => set({ beam: v })} />
                <NumField label="Falloff" unit="°" value={p.falloff} min={5} max={170} step={5} onChange={(v) => set({ falloff: v })} />
                <NumField label="Inclinación" unit="°" value={p.tilt} min={-90} max={90} step={5} onChange={(v) => set({ tilt: v })} />
              </>}
              {def.light.kind !== 'lineal' && <label className="check"><input type="checkbox" checked={p.shadow !== 'no'} onChange={(e) => set({ shadow: e.target.checked ? 'si' : 'no' })} /> Sombra</label>}
              <label className="check"><input type="checkbox" checked={p.transparency !== 'no'} onChange={(e) => set({ transparency: e.target.checked ? 'si' : 'no' })} /> Ilumina transparentes</label>
            </fieldset>
          );
        })}
        <p className="hint">Las luces se ven en el Modo render y al renderizar.</p>
      </div>
    </div>
  );
}
