import { useEffect, useRef, useState } from 'react';
import { QUALITIES, SIZE_PRESETS, SIZE_MODES, MIN_SIDE, MAX_SIDE, CLIMAS, BG_MODES, BG_IMAGE_MAX, WM_POSITIONS, WM_IMAGE_MAX, PANO_SIZES, PANO_CENTERS, renderSize, setCustomSide, applyClima, watermarkRect } from '../domain/render.js';
import { Compass, AltitudeArc } from './SunControls.jsx';
import { readImageFile } from './imageFile.js';
import { NumField } from './fields.jsx';
import { cssImageUrl } from '../domain/safeData.js';

// Diálogo "Configuración del render" (como el de Promob): pestañas con la calidad y la dimensión,
// el clima, el fondo, la marca de agua y el 360°. Cada cambio se guarda en el proyecto.
export const RENDER_TABS = [['general', 'Calidad y dimensión'], ['clima', 'Clima'], ['fondo', 'Fondo'], ['marca', 'Marca de agua'], ['360', '360°']];

export default function RenderDialog({ config, view, onChange, onRender, onClose, onBegin, onEnd, watermark, onWatermark }) {
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
            <p className="rd-size">Tamaño de la imagen: <b>{size.width} × {size.height}</b> px{config.panorama.on && ' (panorama 360°)'}</p>
            <label className="check">
              <input type="checkbox" checked={config.showArea} onChange={(e) => onChange((r) => ({ ...r, showArea: e.target.checked }))} /> Mostrar el área del render en la vista
            </label>
          </fieldset>
        </div>
      )}
      {tab === 'clima' && <ClimaTab clima={config.clima} onClima={(fn) => onChange((r) => ({ ...r, clima: fn(r.clima) }))} onBegin={onBegin} onEnd={onEnd} />}
      {tab === 'fondo' && <FondoTab bg={config.background} onBg={(patch) => onChange((r) => ({ ...r, background: { ...r.background, ...patch } }))} />}
      {tab === 'marca' && <MarcaTab wm={watermark} onWm={onWatermark} />}
      {tab === '360' && <PanoTab pano={config.panorama} onPano={(patch) => onChange((r) => ({ ...r, panorama: { ...r.panorama, ...patch } }))} />}
      <footer>
        <button onClick={onClose}>Cerrar</button>
        <button className="active" onClick={onRender}>Renderizar</button>
      </footer>
    </div>
  );
}

// Recuadro del área que se va a renderizar (lo de afuera queda oscurecido).
// Si hay marca de agua, se ve en su lugar (a escala) dentro del área.
export function RenderArea({ rect, size, watermark }) {
  const [wmSize, setWmSize] = useState(null);
  const wm = watermark?.use && watermark.image ? watermark : null;
  const k = rect.w / size.width;
  const r = wm && wmSize && watermarkRect(wmSize.w, wmSize.h, size.width, size.height, wm.position, wm.offset);
  return (
    <div className="render-area" style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}>
      {wm && (
        <img className="render-area-wm" src={wm.image} alt="" onLoad={(e) => setWmSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
          style={r ? { left: r.x * k, top: r.y * k, width: r.w * k, height: r.h * k, opacity: 1 - wm.transparency / 100 } : { visibility: 'hidden' }} />
      )}
      <span>{size.width} × {size.height}</span>
    </div>
  );
}

// Pestaña Clima: luz natural (sol y cielo) como en Promob. "No aplicar" deja solo la luz ambiente.
function Slider({ label, value, min = 0, max = 300, unit = '%', onChange, onBegin, onEnd, disabled }) {
  return (
    <label className="rd-slider">
      <span>{label}</span>
      <input type="range" min={min} max={max} value={value} disabled={disabled}
        onPointerDown={onBegin} onPointerUp={onEnd} onChange={(e) => onChange(+e.target.value)} />
      <b>{value}{unit}</b>
    </label>
  );
}

function ClimaTab({ clima, onClima, onBegin, onEnd }) {
  const set = (patch) => onClima((c) => ({ ...c, ...patch }));
  const none = clima.preset === 'ninguno';
  const sunOff = none || !clima.sun;
  return (
    <div className="rd-body">
      <fieldset>
        <legend>Tipo de clima</legend>
        <div className="rd-climas">
          {CLIMAS.map((c) => (
            <button key={c.id} className={clima.preset === c.id ? 'on' : ''} onClick={() => onClima((x) => applyClima(x, c.id))}
              style={{ '--sky-top': c.top, '--sky-bottom': c.bottom }}>
              <i />{c.label}
            </button>
          ))}
        </div>
        {none && <p className="hint">Sin luz natural: el render usa solo la luz ambiente. Calidad, dimensión y fondo se siguen aplicando.</p>}
      </fieldset>
      <fieldset disabled={none}>
        <legend>Sol y cielo</legend>
        <label className="check"><input type="checkbox" checked={clima.sun} onChange={(e) => set({ sun: e.target.checked })} /> Activar el sol</label>
        <Slider label="Intensidad del sol" value={clima.sunIntensity} disabled={sunOff} onChange={(v) => set({ sunIntensity: v })} onBegin={onBegin} onEnd={onEnd} />
        <Slider label="Intensidad del cielo" value={clima.skyIntensity} onChange={(v) => set({ skyIntensity: v })} onBegin={onBegin} onEnd={onEnd} />
        <div className={`rd-sun${sunOff ? ' off' : ''}`}>
          <div>
            <Compass value={clima.azimuth} onChange={(v) => set({ azimuth: v })} onBegin={onBegin} onEnd={onEnd} />
            <NumField label="Azimut" unit="°" value={clima.azimuth} min={-360} max={720} onChange={(v) => set({ azimuth: ((Math.round(v) % 360) + 360) % 360 })} />
          </div>
          <div>
            <AltitudeArc value={clima.altitude} onChange={(v) => set({ altitude: v })} onBegin={onBegin} onEnd={onEnd} />
            <NumField label="Altitud" unit="°" value={clima.altitude} min={0} max={90} onChange={(v) => set({ altitude: Math.round(v) })} />
          </div>
        </div>
      </fieldset>
      <label className="check"><input type="checkbox" checked={clima.ambient} onChange={(e) => set({ ambient: e.target.checked })} /> Activar la luz ambiente</label>
    </div>
  );
}

// Pestaña Fondo: color, degradé (color principal → color gradual) o imagen. Solo se ve en la imagen renderizada.
function FondoTab({ bg, onBg }) {
  const fileRef = useRef(null);
  const [err, setErr] = useState(null);
  const pick = async (file) => {
    setErr(null);
    try { onBg({ image: await readImageFile(file, { max: BG_IMAGE_MAX }), mode: 'imagen' }); } catch (e) { setErr(e.message); }
  };
  const preview = bg.mode === 'imagen' && bg.image ? { backgroundImage: cssImageUrl(bg.image) }
    : bg.mode === 'degrade' ? { background: `linear-gradient(${bg.color}, ${bg.color2})` } : { background: bg.color };
  return (
    <div className="rd-body">
      <fieldset>
        <legend>Fondo de la imagen</legend>
        {BG_MODES.map(([k, l]) => (
          <label key={k} className="radio"><input type="radio" name="rd-bg" checked={bg.mode === k} onChange={() => onBg({ mode: k })} /> {l}</label>
        ))}
        {bg.mode !== 'imagen' && (
          <div className="rd-row">
            <label className="rd-color"><input type="color" value={bg.color} onChange={(e) => onBg({ color: e.target.value })} /> Color principal</label>
            {bg.mode === 'degrade' && <label className="rd-color"><input type="color" value={bg.color2} onChange={(e) => onBg({ color2: e.target.value })} /> Color gradual</label>}
          </div>
        )}
        {bg.mode === 'imagen' && (
          <div className="rd-row">
            <button onClick={() => fileRef.current?.click()}>{bg.image ? 'Cambiar imagen…' : 'Elegir imagen…'}</button>
            {bg.image && <button onClick={() => onBg({ image: null })}>Quitar</button>}
            <input ref={fileRef} className="rd-file" type="file" accept="image/*" hidden
              onChange={(e) => { const f = e.target.files?.[0]; if (f) pick(f); e.target.value = ''; }} />
          </div>
        )}
        {err && <p className="rw-error">{err}</p>}
        <div className="rd-bg-preview" style={preview}>{bg.mode === 'imagen' && !bg.image && 'Sin imagen: se usa el color principal'}</div>
        <p className="hint">El fondo aparece solo en la imagen renderizada, detrás del ambiente; no ilumina la escena.</p>
      </fieldset>
    </div>
  );
}

// Pestaña Marca de agua: queda guardada para los próximos renders (en este navegador).
function MarcaTab({ wm, onWm }) {
  const fileRef = useRef(null);
  const [err, setErr] = useState(null);
  const [hover, setHover] = useState(null);
  const pick = async (file) => {
    setErr(null);
    try { onWm({ image: await readImageFile(file, { max: WM_IMAGE_MAX, type: 'image/png' }), use: true }); } catch (e) { setErr(e.message); }
  };
  const label = (id) => WM_POSITIONS.find(([k]) => k === id)?.[1];
  return (
    <div className="rd-body">
      <label className="check"><input type="checkbox" checked={wm.use} onChange={(e) => onWm({ use: e.target.checked })} /> Usar marca de agua</label>
      <fieldset disabled={!wm.use}>
        <legend>Imagen</legend>
        <div className="rd-row">
          {wm.image && <img className="rd-wm-thumb" src={wm.image} alt="Marca de agua" />}
          <button onClick={() => fileRef.current?.click()}>{wm.image ? 'Cambiar…' : 'Buscar…'}</button>
          <input ref={fileRef} className="rd-wm-file" type="file" accept="image/*" hidden
            onChange={(e) => { const f = e.target.files?.[0]; if (f) pick(f); e.target.value = ''; }} />
        </div>
        <p className="hint">Va a su propio tamaño; si no entra en el render, se achica. Un PNG con fondo transparente queda mejor.</p>
        {err && <p className="rw-error">{err}</p>}
      </fieldset>
      <fieldset disabled={!wm.use}>
        <legend>Posición</legend>
        <div className="rd-wm-pos" onMouseLeave={() => setHover(null)}>
          {WM_POSITIONS.map(([k, l]) => (
            <button key={k} className={wm.position === k ? 'on' : ''} title={l} aria-label={l}
              onMouseEnter={() => setHover(k)} onClick={() => onWm({ position: k })}><i /></button>
          ))}
        </div>
        <p className="rd-size">{label(hover || wm.position)}</p>
        <label className="rd-slider">
          <span>Transparencia</span>
          <input type="range" min={0} max={100} value={wm.transparency} onChange={(e) => onWm({ transparency: +e.target.value })} />
          <b>{wm.transparency}%</b>
        </label>
        <NumField label="Distancia al borde" unit="px" value={wm.offset} min={0} max={2000} onChange={(v) => onWm({ offset: v })} />
      </fieldset>
    </div>
  );
}

// Pestaña 360°: panorama equirectangular que se recorre arrastrando (visor en la ventana de render).
function PanoTab({ pano, onPano }) {
  return (
    <div className="rd-body">
      <label className="check"><input type="checkbox" checked={pano.on} onChange={(e) => onPano({ on: e.target.checked })} /> Panorama 360°</label>
      <fieldset disabled={!pano.on}>
        <legend>Panorama</legend>
        <label className="field"><span>Resolución</span>
          <select className="rd-pano-size" value={pano.size} onChange={(e) => onPano({ size: e.target.value })}>
            {PANO_SIZES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
        {PANO_CENTERS.map(([k, l]) => (
          <label key={k} className="radio"><input type="radio" name="rd-pano-center" checked={pano.center === k} onChange={() => onPano({ center: k })} /> {l}</label>
        ))}
        {pano.center === 'ambiente' && <NumField label="Altura de los ojos" unit="mm" value={pano.eye} min={100} max={3000} step={50} onChange={(v) => onPano({ eye: v })} />}
        <p className="hint">La imagen se mira desde ese punto hacia todos lados. Con el panorama activo, la dimensión es la de la resolución elegida.</p>
      </fieldset>
    </div>
  );
}
