import { useEffect, useRef, useState } from 'react';
import { createRenderJob } from './renderEngine.js';
import { download } from './fields.jsx';

// Ventana de render: calcula la imagen al tamaño pedido y la muestra mientras se refina.
// Detener deja la imagen como está; Guardar imagen la baja en PNG.
export default function RenderWindow({ bridge, size, quality, fileName, onClose }) {
  const holder = useRef(null);
  const jobRef = useRef(null);
  const [samples, setSamples] = useState(0);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);
  const [t0] = useState(() => performance.now());
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    let job;
    try {
      job = createRenderJob({
        ...bridge(), size, quality,
        onProgress: (s) => { setSamples(s); setElapsed(performance.now() - t0); },
        onDone: () => { setRunning(false); setElapsed(performance.now() - t0); },
      });
    } catch (e) {
      setError(String(e?.message || e));
      return undefined;
    }
    jobRef.current = job;
    job.output.className = 'rw-image';
    holder.current?.appendChild(job.output);
    setRunning(true);
    // un cuadro de respiro para que se vea la ventana antes de compilar el trazador
    const id = setTimeout(() => { try { job.start(); setRunning(job.running); } catch (e) { setError(String(e?.message || e)); } }, 30);
    return () => { clearTimeout(id); job.dispose(); job.output.remove(); jobRef.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);

  const toggle = () => {
    const job = jobRef.current;
    if (!job) return;
    if (job.running) job.stop(); else job.start();
    setRunning(job.running);
  };
  const save = () => {
    const job = jobRef.current;
    if (!job) return;
    job.output.toBlob((blob) => blob && download(fileName, blob));
  };
  const target = quality.pathTrace ? quality.samples : 1;
  const done = samples >= target;
  return (
    <div className="menu-backdrop dim render-window-backdrop">
      <div className="render-window" role="dialog" aria-label="Render">
        <header>
          <h3>{quality.label} · {size.width} × {size.height} px</h3>
          <button className="icon-btn" onClick={onClose} title="Cerrar (Esc)">✕</button>
        </header>
        <div className="rw-holder" ref={holder}>{error && <p className="rw-error">No se pudo renderizar: {error}</p>}</div>
        <footer>
          <span className="rw-progress">
            {done ? '✓ Listo' : running ? 'Calculando…' : 'Detenido'}
            {quality.pathTrace && <> · <b>{samples}</b>/{target} muestras</>}
            {' · '}{(elapsed / 1000).toFixed(1)} s
            {quality.pathTrace && <progress max={target} value={samples} />}
          </span>
          {quality.pathTrace && !done && <button onClick={toggle}>{running ? 'Detener' : 'Continuar'}</button>}
          <button className="active" onClick={save} disabled={!!error}>Guardar imagen</button>
          <button onClick={onClose}>Cerrar</button>
        </footer>
      </div>
    </div>
  );
}
