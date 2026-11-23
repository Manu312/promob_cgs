import { useEffect, useState } from 'react';
import { prefsOf } from '../domain/prefs.js';
import { shortcutsOf, conflicts, comboOfEvent } from '../domain/shortcuts.js';
import { FILL_MODES } from '../domain/fillModes.js';
import { ROOM_MATERIALS } from '../domain/roomMaterials.js';
import { NumField } from './fields.jsx';

// Preferencias y Configurar atajos (Promob).
export default function PrefsDialog({ ui, onPrefs, onShortcuts, onClose }) {
  const [tab, setTab] = useState('prefs');
  const [rec, setRec] = useState(null); // acción que está grabando su combinación
  useEffect(() => {
    const k = (e) => {
      if (rec) { // grabar la combinación
        e.preventDefault(); e.stopPropagation();
        if (e.key === 'Escape') { setRec(null); return; }
        const c = comboOfEvent(e);
        if (c) { onShortcuts({ ...(ui.shortcuts || {}), [rec]: c }); setRec(null); }
        return;
      }
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', k, true);
    return () => window.removeEventListener('keydown', k, true);
  }, [rec, ui.shortcuts, onShortcuts, onClose]);
  const p = prefsOf(ui);
  const floors = ROOM_MATERIALS.filter((m) => m.group === 'pisos');
  const clash = new Set(conflicts(ui.shortcuts || {}).flat());
  return (
    <div className="menu-backdrop dim">
      <div className="wall-dialog prefs-dialog" role="dialog" aria-label="Preferencias">
        <div className="pd-tabs">
          <button className={tab === 'prefs' ? 'active' : ''} onClick={() => setTab('prefs')}>Preferencias</button>
          <button className={tab === 'keys' ? 'active' : ''} onClick={() => setTab('keys')}>Configurar atajos</button>
        </div>
        {tab === 'prefs' ? (
          <div className="pd-body">
            <label className="field"><span>Fondo del visor</span><input type="color" value={p.bg} onChange={(e) => onPrefs({ bg: e.target.value })} /></label>
            <label className="field"><span>Relleno por defecto</span><select value={p.fill} onChange={(e) => onPrefs({ fill: e.target.value })}>{FILL_MODES.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}</select></label>
            <NumField label="Luz del visor" value={p.light} min={0.2} max={3} step={0.1} onChange={(v) => onPrefs({ light: v })} />
            <NumField label="Paso de las flechas del teclado" unit="mm" value={p.arrowStep} min={1} max={500} onChange={(v) => onPrefs({ arrowStep: v })} />
            <h4>Proyectos nuevos</h4>
            <NumField label="Espesor de paredes" unit="mm" value={p.wallT} min={50} max={600} step={5} onChange={(v) => onPrefs({ wallT: v })} />
            <NumField label="Alto de paredes" unit="mm" value={p.wallH} min={1000} max={6000} step={10} onChange={(v) => onPrefs({ wallH: v })} />
            <label className="field"><span>Piso</span><select value={p.floorMat} onChange={(e) => onPrefs({ floorMat: e.target.value })}><option value="">Sin material</option>{floors.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</select></label>
            <NumField label="Alto del rebaje de paredes" unit="mm" value={p.lowerH} min={0} max={1500} step={10} onChange={(v) => onPrefs({ lowerH: v })} />
          </div>
        ) : (
          <div className="pd-body">
            <p className="hint">Clic en una combinación y apretá la nueva (Esc cancela). En rojo, las repetidas.</p>
            <table className="pd-keys">
              <tbody>
                {shortcutsOf(ui.shortcuts || {}).map((s) => (
                  <tr key={s.id} data-action={s.id} className={clash.has(s.id) ? 'clash' : ''}>
                    <td>{s.label}</td>
                    <td><button className={rec === s.id ? 'active' : ''} onClick={() => setRec(s.id)}>{rec === s.id ? 'Apretá la combinación…' : s.combo}</button></td>
                    <td>{s.combo !== s.def && <button className="link" title={`Volver a ${s.def}`} onClick={() => { const { [s.id]: _x, ...rest } = ui.shortcuts || {}; onShortcuts(rest); }}>↺</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="row-btns"><button className="active" onClick={onClose}>Cerrar</button></div>
      </div>
    </div>
  );
}
