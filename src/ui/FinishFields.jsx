import { roomMatById } from '../domain/roomMaterials.js';
import { NumField } from './fields.jsx';
import { swatchUrl } from './roomTextures.js';

// Propiedades del material de una superficie (pared o piso): escala, rotación, espejado, tonalidad.
export default function FinishFields({ finish, onProps, onClear, title = 'Material' }) {
  const m = finish && roomMatById(finish.mat);
  return (
    <div className="finish-fields">
      <h4>{title}</h4>
      {!m && <p className="hint">Sin material: arrastrá uno desde la pestaña Materiales (o elegí la superficie y hacé clic en un material).</p>}
      {m && (
        <>
          <div className="finish-cur">
            <i className="rm-swatch" style={swatchUrl(m.id) ? { backgroundImage: `url(${swatchUrl(m.id)})` } : { background: finish.tint || m.color }} />
            <b>{m.label}</b>
            <button className="danger" onClick={onClear}>Quitar</button>
          </div>
          {m.kind !== 'pintura' && (
            <>
              <NumField label="Escalar en X" value={finish.scaleX} min={0.1} max={20} step={0.1} onChange={(v) => onProps({ scaleX: v })} />
              <NumField label="Escalar en Y" value={finish.scaleY} min={0.1} max={20} step={0.1} onChange={(v) => onProps({ scaleY: v })} />
              <NumField label="Rotación" unit="°" value={finish.rot} min={-360} max={720} step={15} onChange={(v) => onProps({ rot: v })} />
              <label className="check"><input type="checkbox" checked={finish.mirrorX} onChange={(e) => onProps({ mirrorX: e.target.checked })} /> Espejar X</label>
              <label className="check"><input type="checkbox" checked={finish.mirrorY} onChange={(e) => onProps({ mirrorY: e.target.checked })} /> Espejar Y</label>
            </>
          )}
          <label className="field"><span>Tonalidad</span>
            <span className="tint-row">
              <input type="color" value={finish.tint || (m.kind === 'pintura' ? m.color : '#ffffff')} onChange={(e) => onProps({ tint: e.target.value })} />
              {finish.tint && <button onClick={() => onProps({ tint: null })}>Original</button>}
            </span>
          </label>
        </>
      )}
    </div>
  );
}
