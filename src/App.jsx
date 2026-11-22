import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_SETTINGS, mergeSettings } from './domain/catalog.js';
import { newModule, footprint, snapPosition, clampToRoom, uid } from './domain/modules.js';
import { buildAll, computeCutList } from './domain/cutlist.js';
import { nestAll } from './domain/nesting.js';
import { computeBudget } from './domain/budget.js';
import { sampleProject, emptyProject, normalizeProject } from './domain/project.js';
import Scene3D from './ui/Scene3D.jsx';
import Catalog from './ui/Catalog.jsx';
import Inspector from './ui/Inspector.jsx';
import CutPlan from './ui/CutPlan.jsx';
import Budget from './ui/Budget.jsx';
import Settings from './ui/Settings.jsx';
import ErrorBoundary from './ui/ErrorBoundary.jsx';
import { download, money } from './ui/fields.jsx';
import { useHistoryState } from './ui/useHistoryState.js';

function usePersistent(key, init, migrate = (x) => x) {
  const [v, setV] = useState(() => {
    try { const s = localStorage.getItem(key); if (s) return migrate(JSON.parse(s)); } catch { /* sin storage */ }
    return typeof init === 'function' ? init() : init;
  });
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* sin storage */ } }, [key, v]);
  return [v, setV];
}

const TABS = [['diseno', 'Diseño 3D'], ['corte', 'Plan de corte'], ['presupuesto', 'Presupuesto'], ['precios', 'Precios']];

export default function App() {
  const [project, setProject, history] = useHistoryState('mueblesapp.project', sampleProject, normalizeProject);
  const [showDims, setShowDims] = useState(false);
  const [autoHideWalls, setAutoHideWalls] = useState(true);
  const [rawSettings, setSettings] = usePersistent('mueblesapp.settings', DEFAULT_SETTINGS);
  const settings = useMemo(() => mergeSettings(rawSettings), [rawSettings]);
  const [tab, setTab] = useState('diseno');
  const [selectedId, setSelectedId] = useState(null);
  const [renderMode, setRenderMode] = useState(false);
  const [photoreal, setPhotoreal] = useState(false);
  const [samples, setSamples] = useState(0);
  const [maxSamples, setMaxSamples] = useState(400);
  const [view, setView] = useState({ name: 'perspectiva', tick: 0 });
  const captureRef = useRef(null);
  const fileRef = useRef(null);

  // La geometría no depende de la posición: no recalcular corte/presupuesto al arrastrar.
  const buildKey = JSON.stringify([project.modules.map((m) => [m.id, m.type, m.params, m.mats, m.rules]), project.defaults, project.rules]);
  const built = useMemo(() => buildAll(project, settings), [buildKey, settings]); // eslint-disable-line react-hooks/exhaustive-deps
  const builtById = useMemo(() => new Map(built.map((b) => [b.id, b])), [built]);
  const cut = useMemo(() => computeCutList(built), [built]);
  const nesting = useMemo(() => nestAll(cut.rows, settings), [cut, settings]);
  const budget = useMemo(() => computeBudget(cut, nesting, settings), [cut, nesting, settings]);

  const selected = project.modules.find((m) => m.id === selectedId) || null;

  const mapModule = useCallback((id, fn) => setProject((p) => ({
    ...p, modules: p.modules.map((m) => (m.id === id ? clampToRoom(fn(m), p.room) : m)),
  })), [setProject]);

  // En Planta, con grilla magnética, los arrastres se redondean al paso de la grilla.
  const grid = project.room.grid || { size: 50, magnetic: true };
  const gridStep = view.name === 'planta' && grid.magnetic ? grid.size : 10;
  const onMove = useCallback((id, x, z) => setProject((p) => {
    const m = p.modules.find((o) => o.id === id);
    if (!m) return p;
    const pos = snapPosition({ ...m, x, z }, p.modules.filter((o) => o.id !== id), p.room, 40, gridStep);
    if (pos.x === m.x && pos.z === m.z) return p;
    return { ...p, modules: p.modules.map((o) => (o.id === id ? { ...o, ...pos } : o)) };
  }), [setProject, gridStep]);
  const setGrid = (patch) => setProject((p) => ({ ...p, room: { ...p.room, grid: { ...grid, ...patch } } }));

  const addModule = (type) => {
    const m = newModule(type, project);
    setProject((p) => ({ ...p, modules: [...p.modules, m] }));
    setSelectedId(m.id);
    setTab('diseno');
  };
  const deleteSelected = () => {
    if (!selectedId) return;
    setProject((p) => ({ ...p, modules: p.modules.filter((m) => m.id !== selectedId) }));
    setSelectedId(null);
  };
  const duplicateSelected = () => {
    if (!selected) return;
    const copy = clampToRoom({ ...selected, id: uid(), x: selected.x + footprint(selected).fw, params: { ...selected.params }, mats: { ...selected.mats } }, project.room);
    setProject((p) => ({ ...p, modules: [...p.modules, copy] }));
    setSelectedId(copy.id);
  };
  const rotateSelected = () => selectedId && mapModule(selectedId, (m) => ({ ...m, rot: ((m.rot || 0) + 90) % 360 }));

  useEffect(() => {
    const onKey = (e) => {
      const inField = ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName);
      if ((e.ctrlKey || e.metaKey) && !inField) {
        const k = e.key.toLowerCase();
        if (k === 'z' && !e.shiftKey) { e.preventDefault(); history.undo(); return; }
        if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); history.redo(); return; }
      }
      if (tab !== 'diseno' || inField) return;
      if (e.key === 'Escape') setSelectedId(null);
      if (!selectedId) return;
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSelected(); }
      else if (e.key === 'r' || e.key === 'R') rotateSelected();
      else if (e.key.startsWith('Arrow')) {
        e.preventDefault();
        const st = e.shiftKey ? 100 : 10;
        const dx = e.key === 'ArrowLeft' ? -st : e.key === 'ArrowRight' ? st : 0;
        const dz = e.key === 'ArrowUp' ? -st : e.key === 'ArrowDown' ? st : 0;
        mapModule(selectedId, (m) => ({ ...m, x: m.x + dx, z: m.z + dz }));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const exportImage = () => {
    if (!captureRef.current) return;
    download(`${project.name || 'render'}.png`, dataUrlToBlob(captureRef.current(2)));
  };
  const exportProject = () => download(`${project.name || 'proyecto'}.mueble.json`, JSON.stringify(project, null, 2), 'application/json');
  const importProject = async (file) => {
    try {
      const p = JSON.parse(await file.text());
      if (!p || !Array.isArray(p.modules) || !p.room) throw new Error('formato');
      setProject(normalizeProject(p)); setSelectedId(null);
    } catch { window.alert('El archivo no es un proyecto válido.'); }
  };
  const newProject = () => { if (window.confirm('¿Empezar un proyecto vacío? (exportá el actual si lo querés guardar)')) { setProject(emptyProject()); setSelectedId(null); } };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">Muebles<b>App</b></div>
        <nav className="tabs">
          {TABS.map(([k, l]) => <button key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>{l}</button>)}
        </nav>
        <div className="top-actions">
          <span className="total-pill" title="Total del presupuesto">{money(budget.total)}</span>
          <button onClick={history.undo} disabled={!history.canUndo} title="Deshacer (Ctrl+Z)">↶ Deshacer</button>
          <button onClick={history.redo} disabled={!history.canRedo} title="Rehacer (Ctrl+Y)">↷ Rehacer</button>
          <button onClick={newProject}>Nuevo</button>
          <button onClick={() => fileRef.current?.click()}>Abrir</button>
          <button onClick={exportProject}>Guardar archivo</button>
          <input ref={fileRef} type="file" accept=".json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) importProject(f); e.target.value = ''; }} />
        </div>
      </header>

      {tab === 'diseno' && (
        <main className="design">
          <Catalog onAdd={addModule} />
          <section className="viewport">
            <ErrorBoundary onReset={() => { setPhotoreal(false); setRenderMode(false); }}>
              <Scene3D project={project} builtById={builtById} selectedId={selectedId} onSelect={setSelectedId} onMove={onMove}
                onDragStart={history.begin} onDragEnd={history.commit}
                renderMode={renderMode || photoreal} photoreal={photoreal} maxSamples={maxSamples} onProgress={setSamples}
                view={view} captureRef={captureRef} showDims={showDims} autoHideWalls={autoHideWalls} />
            </ErrorBoundary>
            <div className="vp-toolbar">
              {[['perspectiva', 'Perspectiva'], ['frente', 'Frente'], ['planta', 'Planta']].map(([k, l]) => (
                <button key={k} className={view.name === k ? 'active-soft' : ''} onClick={() => { setView((v) => ({ name: k, tick: v.tick + 1 })); if (k === 'planta') setShowDims(true); }}>{l}</button>
              ))}
              <button className={showDims ? 'active-soft' : ''} onClick={() => setShowDims((s) => !s)} title="Mostrar medidas de paredes y módulos">Cotas</button>
              <button className={autoHideWalls ? 'active-soft' : ''} onClick={() => setAutoHideWalls((s) => !s)} title="Ocultar las paredes que tapan la vista">Paredes auto</button>
              {view.name === 'planta' && (
                <span className="grid-ctl">
                  <button className={grid.magnetic ? 'active-soft' : ''} onClick={() => setGrid({ magnetic: !grid.magnetic })}
                    title="Grilla magnética: al arrastrar en Planta, las posiciones se redondean al paso de la grilla">Grilla</button>
                  <select value={grid.size} onChange={(e) => setGrid({ size: +e.target.value })} title="Paso de la grilla">
                    {[10, 25, 50, 100, 250, 500].map((v) => <option key={v} value={v}>{v} mm</option>)}
                  </select>
                </span>
              )}
              <span className="sep" />
              <button className={renderMode && !photoreal ? 'active' : ''} disabled={photoreal} onClick={() => { setRenderMode((r) => !r); setSelectedId(null); }}>
                {renderMode && !photoreal ? '✓ Modo render' : 'Modo render'}
              </button>
              <button className={photoreal ? 'active' : ''} onClick={() => { setPhotoreal((r) => !r); setSamples(0); setSelectedId(null); }}
                title="Trazado de rayos: la imagen se va refinando. Podés girar la cámara y vuelve a empezar.">
                {photoreal ? '■ Detener render final' : 'Render final (fotorrealista)'}
              </button>
              {photoreal && (
                <span className="pt-progress">
                  {samples >= maxSamples ? '✓ Listo' : 'Calculando…'} {samples}/{maxSamples}
                  <select value={maxSamples} onChange={(e) => setMaxSamples(+e.target.value)} title="Calidad (muestras)">
                    <option value={150}>Borrador</option><option value={400}>Normal</option><option value={1000}>Alta</option>
                  </select>
                </span>
              )}
              <button onClick={exportImage}>Exportar imagen</button>
            </div>
            <div className="vp-stats">{project.modules.length} módulos · {cut.rows.reduce((a, r) => a + r.qty, 0)} piezas · {nesting.reduce((a, n) => a + n.sheets.length, 0)} placas</div>
          </section>
          <Inspector project={project} settings={settings} selected={selected} built={selected ? builtById.get(selected.id) : null}
            onParams={(patch) => mapModule(selectedId, (m) => ({ ...m, params: { ...m.params, ...patch } }))}
            onUpdate={(patch) => mapModule(selectedId, (m) => ({ ...m, ...patch }))}
            onDelete={deleteSelected} onDuplicate={duplicateSelected} onRotate={rotateSelected}
            onProject={(fn) => setProject((p) => { const np = normalizeProject(fn(p)); return { ...np, modules: np.modules.map((m) => clampToRoom(m, np.room)) }; })} />
        </main>
      )}
      {tab === 'corte' && <CutPlan cut={cut} nesting={nesting} settings={settings} project={project} />}
      {tab === 'presupuesto' && <Budget budget={budget} settings={settings} project={project} built={built} />}
      {tab === 'precios' && <Settings settings={settings} setSettings={setSettings} />}
    </div>
  );
}

function dataUrlToBlob(url) {
  const [head, b64] = url.split(',');
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: head.match(/:(.*?);/)[1] });
}
