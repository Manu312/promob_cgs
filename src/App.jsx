import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_SETTINGS, mergeSettings } from './domain/catalog.js';
import { newModule, footprint, snapPosition, resizeModule, uid } from './domain/modules.js';
import { moveWall, moveNode, setWallLength, setWallAngle, updateWall, splitWall, deleteWalls } from './domain/wallEdit.js';
import { WallContextMenu, WallDeleteDialog } from './ui/WallMenus.jsx';
import { applyDimEdit } from './domain/dimensions.js';
import { updateOpening, setOpeningDim, moveColumn, removeOpening, removeColumn } from './domain/openings.js';
import { addWall, segmentEnd } from './domain/drawWalls.js';
import { absAngle } from './domain/walls.js';
import DrawHud from './ui/DrawHud.jsx';
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
import { describeSelection } from './domain/selection.js';

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
  const [autoLower, setAutoLower] = useState(true); // Auto Rebajar (como Promob)
  const [rawSettings, setSettings] = usePersistent('mueblesapp.settings', DEFAULT_SETTINGS);
  const settings = useMemo(() => mergeSettings(rawSettings), [rawSettings]);
  const [tab, setTab] = useState('diseno');
  // Selección única: { kind: 'module' | 'wall', id } (Fase 1 suma aberturas, columnas y cotas).
  const [selection, setSelection] = useState(null);
  const selectedId = selection?.kind === 'module' ? selection.id : null;
  const selectedWallId = selection?.kind === 'wall' ? selection.id : null;
  const setSelectedId = useCallback((id) => setSelection(id ? { kind: 'module', id } : null), []);
  const selectWall = useCallback((id) => setSelection(id ? { kind: 'wall', id } : null), []);
  const selectedOpeningId = selection?.kind === 'opening' ? selection.id : null;
  const selectedColumnId = selection?.kind === 'column' ? selection.id : null;
  const selectOpening = useCallback((id) => setSelection(id ? { kind: 'opening', id } : null), []);
  const selectColumn = useCallback((id) => setSelection(id ? { kind: 'column', id } : null), []);
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
    ...p, modules: p.modules.map((m) => (m.id === id ? fn(m) : m)),
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

  // Arrastre de paredes y vértices: cada movimiento parte del ambiente que había al
  // empezar el arrastre (sin acumular errores) y todo el arrastre es un paso de deshacer.
  const projectRef = useRef(project);
  projectRef.current = project;
  const baseRoomRef = useRef(null);
  const onDragStart = useCallback(() => { baseRoomRef.current = projectRef.current.room; history.begin(); }, [history.begin]);
  const onMoveWall = useCallback((id, dx, dz) => setProject((p) => ({ ...p, room: moveWall(baseRoomRef.current || p.room, id, dx, dz) })), [setProject]);
  const onMoveNode = useCallback((id, x, z) => setProject((p) => ({ ...p, room: moveNode(p.room, id, x, z) })), [setProject]);
  const recenter = () => setView((v) => ({ ...v, tick: v.tick + 1 }));
  // Aberturas (a lo largo de su pared) y columnas (imán a paredes y grilla).
  const onMoveOpening = useCallback((id, offset) => setProject((p) => ({ ...p, room: updateOpening(p.room, id, { offset }) })), [setProject]);
  const onMoveColumn = useCallback((id, x, z) => setProject((p) => ({ ...p, room: moveColumn(p.room, id, x, z, gridStep) })), [setProject, gridStep]);
  const onOpeningDim = (id, which, value) => setProject((p) => ({ ...p, room: setOpeningDim(p.room, id, which, value) }));
  // Flechas de redimensionar: siempre desde el módulo como estaba al empezar el arrastre.
  const onResize = useCallback((start, handle, delta) => setProject((p) => ({
    ...p, modules: p.modules.map((m) => (m.id === start.id ? resizeModule(start, handle, delta) : m)),
  })), [setProject]);

  // Cotas editables: la distancia del módulo mueve el módulo; el largo de pared cambia la pared.
  const onDimEdit = (dim, value) => selectedId && mapModule(selectedId, (m) => ({ ...m, ...applyDimEdit(m, dim, value) }));
  const onWallLength = (id, value) => setProject((p) => normalizeProject({ ...p, room: setWallLength(p.room, id, value) }));
  const onWallAngle = (id, value) => setProject((p) => normalizeProject({ ...p, room: setWallAngle(p.room, id, value, 'rel') }));

  // Construir paredes: estado del trazo (punto inicial o esquina desde la que sigue,
  // esquina donde empezó la cadena y ángulo del último tramo). Cada tramo es un paso de deshacer.
  const [drawing, setDrawing] = useState(null);
  const [drawLen, setDrawLen] = useState('');
  const [drawAng, setDrawAng] = useState('');
  const drawCursorRef = useRef(null);
  const lenRef = useRef(null), angRef = useRef(null);
  const freshDraw = { start: null, fromNodeId: null, chainStartId: null, prevAbs: null, segs: 0, confirmClose: false };
  const startDrawWalls = () => {
    setDrawing(freshDraw); setDrawLen(''); setDrawAng(''); setSelection(null);
    if (view.name !== 'planta') { setView((v) => ({ name: 'planta', tick: v.tick + 1 })); setShowDims(true); }
    setTimeout(() => lenRef.current?.focus(), 50);
  };
  const stopDrawWalls = () => { setDrawing(null); drawCursorRef.current = null; };
  // Si se deshace un tramo mientras se dibuja, la esquina de partida puede desaparecer.
  useEffect(() => {
    if (drawing?.fromNodeId && !project.room.nodes.some((n) => n.id === drawing.fromNodeId)) setDrawing(freshDraw);
  }, [project.room]); // eslint-disable-line react-hooks/exhaustive-deps
  const drawFrom = () => {
    if (drawing.fromNodeId) { const n = projectRef.current.room.nodes.find((o) => o.id === drawing.fromNodeId); return n && [n.x, n.z]; }
    return drawing.start;
  };
  const commitWall = (to) => {
    const from = drawing.fromNodeId ? { nodeId: drawing.fromNodeId } : { point: drawing.start };
    const res = addWall(projectRef.current.room, from, to);
    if (res.startNodeId === res.endNodeId) return;
    setProject((p) => normalizeProject({ ...p, room: res.room }));
    const a = res.room.nodes.find((n) => n.id === res.startNodeId), b = res.room.nodes.find((n) => n.id === res.endNodeId);
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    setDrawLen(''); setDrawAng('');
    if (res.closed) { stopDrawWalls(); return; }
    setDrawing({ ...freshDraw, fromNodeId: res.endNodeId, chainStartId: drawing.chainStartId ?? res.startNodeId, prevAbs: absAngle([(b.x - a.x) / len, (b.z - a.z) / len]), segs: drawing.segs + 1 });
    setTimeout(() => lenRef.current?.focus(), 0);
  };
  const onDrawPoint = (c) => {
    if (!drawing) return;
    if (!drawing.start && !drawing.fromNodeId) {
      setDrawing({ ...drawing, ...(c.nodeId ? { fromNodeId: c.nodeId, chainStartId: c.nodeId } : { start: c.end }) });
      setTimeout(() => lenRef.current?.focus(), 0);
      return;
    }
    if (c.nodeId && c.nodeId === drawing.chainStartId && drawing.segs >= 2) { setDrawing({ ...drawing, confirmClose: true }); return; }
    commitWall(c.nodeId ? { nodeId: c.nodeId } : { point: c.end });
  };
  // Tramo por teclado: largo y ángulo escritos (o los que marca el mouse si quedan vacíos).
  const commitTyped = () => {
    const from = drawFrom();
    if (!from) return;
    const cur = drawCursorRef.current;
    const num = (s) => { const v = Number(String(s).replace(',', '.')); return s !== '' && Number.isFinite(v) ? v : null; };
    const len = num(drawLen) ?? cur?.len;
    if (!(len > 0)) return;
    const a = num(drawAng);
    const abs = a != null ? (drawing.prevAbs == null ? a : drawing.prevAbs + (a - 180)) : (cur?.abs ?? (drawing.prevAbs == null ? 0 : drawing.prevAbs - 90));
    commitWall({ point: segmentEnd(from, len, abs) });
  };

  // Menú contextual y eliminación de paredes. Cada acción es un paso de deshacer.
  const [wallMenu, setWallMenu] = useState(null); // { wallId, offset, x, y }
  const [deleteDlg, setDeleteDlg] = useState(null); // { wallId }
  const onWallContext = (m) => { selectWall(m.wallId); setWallMenu(m); };
  const doSplit = (wallId, offset) => {
    const res = splitWall(projectRef.current.room, wallId, offset);
    if (res.newWallId) setProject((p) => ({ ...p, room: res.room }));
  };
  const wallAction = (action) => {
    const { wallId, offset } = wallMenu;
    setWallMenu(null);
    const w = projectRef.current.room.walls.find((x) => x.id === wallId);
    if (!w) return;
    if (action === 'lowered' || action === 'transparent') setProject((p) => ({ ...p, room: updateWall(p.room, wallId, { [action]: !w[action] }) }));
    else if (action === 'split') doSplit(wallId, offset);
    else if (action === 'delete') setDeleteDlg({ wallId });
  };
  const confirmDelete = (mode, withModules) => {
    const { room, removedModuleIds } = deleteWalls(projectRef.current.room, deleteDlg.wallId, mode, projectRef.current.modules, { withModules });
    setProject((p) => ({ ...p, room, modules: p.modules.filter((m) => !removedModuleIds.includes(m.id)) }));
    setDeleteDlg(null);
    setSelection(null);
  };

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
    const copy = { ...selected, id: uid(), x: selected.x + footprint(selected).fw, params: { ...selected.params }, mats: { ...selected.mats } };
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
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'p') { e.preventDefault(); startDrawWalls(); return; }
      if (tab !== 'diseno' || inField) return;
      if (drawing) { // los números van directo al largo, como en Promob
        if (e.key === 'Escape') stopDrawWalls();
        else if (/^[0-9.,]$/.test(e.key)) { e.preventDefault(); setDrawLen((s) => s + e.key); lenRef.current?.focus(); }
        else if (e.key === 'Enter') commitTyped();
        return;
      }
      if (e.key === 'Escape') setSelectedId(null);
      if (selectedWallId && (e.key === 'Delete' || e.key === 'Backspace')) { e.preventDefault(); setDeleteDlg({ wallId: selectedWallId }); return; }
      if ((selectedOpeningId || selectedColumnId) && (e.key === 'Delete' || e.key === 'Backspace')) {
        e.preventDefault();
        setProject((p) => ({ ...p, room: selectedOpeningId ? removeOpening(p.room, selectedOpeningId) : removeColumn(p.room, selectedColumnId) }));
        setSelection(null);
        return;
      }
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
      setProject(normalizeProject(p)); setSelectedId(null); recenter();
    } catch { window.alert('El archivo no es un proyecto válido.'); }
  };
  const newProject = () => { if (window.confirm('¿Empezar un proyecto vacío? (exportá el actual si lo querés guardar)')) { setProject(emptyProject()); setSelectedId(null); recenter(); } };

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
                selectedWallId={selectedWallId} onSelectWall={selectWall}
                onMoveWall={onMoveWall} onMoveNode={onMoveNode} onResize={onResize} step={gridStep}
                onDimEdit={onDimEdit} onWallLength={onWallLength} onWallAngle={onWallAngle}
                onDragStart={onDragStart} onDragEnd={history.commit}
                drawing={drawing} drawCursorRef={drawCursorRef} onDrawPoint={onDrawPoint} onDrawFinish={stopDrawWalls}
                onWallContext={onWallContext}
                onRestoreWall={(id) => setProject((p) => ({ ...p, room: updateWall(p.room, id, { lowered: false }) }))}
                selectedOpeningId={selectedOpeningId} onSelectOpening={selectOpening} onMoveOpening={onMoveOpening} onOpeningDim={onOpeningDim}
                selectedColumnId={selectedColumnId} onSelectColumn={selectColumn} onMoveColumn={onMoveColumn}
                renderMode={renderMode || photoreal} photoreal={photoreal} maxSamples={maxSamples} onProgress={setSamples}
                view={view} captureRef={captureRef} showDims={showDims} autoHideWalls={autoLower} />
            </ErrorBoundary>
            <div className="vp-toolbar">
              {[['perspectiva', 'Perspectiva'], ['frente', 'Frente'], ['planta', 'Planta']].map(([k, l]) => (
                <button key={k} className={view.name === k ? 'active-soft' : ''} onClick={() => { setView((v) => ({ name: k, tick: v.tick + 1 })); if (k === 'planta') setShowDims(true); else stopDrawWalls(); }}>{l}</button>
              ))}
              <button className={showDims ? 'active-soft' : ''} onClick={() => setShowDims((s) => !s)} title="Mostrar medidas de paredes y módulos">Cotas</button>
              <button className={autoLower ? 'active-soft' : ''} onClick={() => setAutoLower((s) => !s)} title="Auto Rebajar: las paredes que tapan la vista bajan a zócalo">Auto rebajar</button>
              <button className={drawing ? 'active' : ''} onClick={() => (drawing ? stopDrawWalls() : startDrawWalls())} title="Construir paredes (Ctrl+Shift+P)">✏ Paredes</button>
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
                {photoreal ? '■ Detener render final' : 'Render final'}
              </button>
              {photoreal && (
                <span className="pt-progress">
                  {samples >= maxSamples ? '✓ Listo' : 'Calculando…'} {samples}/{maxSamples}
                  <select value={maxSamples} onChange={(e) => setMaxSamples(+e.target.value)} title="Calidad (muestras)">
                    <option value={150}>Borrador</option><option value={400}>Normal</option><option value={1000}>Alta</option>
                  </select>
                </span>
              )}
              <button onClick={exportImage} title="Exportar imagen (PNG)">⤓ Imagen</button>
            </div>
            {drawing && (
              <DrawHud draw={drawing} len={drawLen} setLen={setDrawLen} ang={drawAng} setAng={setDrawAng} lenRef={lenRef} angRef={angRef}
                onCommit={commitTyped} onCancel={stopDrawWalls}
                onClose={(yes) => (yes ? commitWall({ nodeId: drawing.chainStartId }) : setDrawing({ ...drawing, confirmClose: false }))} />
            )}
            {wallMenu && <WallContextMenu menu={wallMenu} wall={project.room.walls.find((w) => w.id === wallMenu.wallId)} onAction={wallAction} onClose={() => setWallMenu(null)} />}
            {deleteDlg && <WallDeleteDialog label={`Pared ${project.room.walls.findIndex((w) => w.id === deleteDlg.wallId) + 1}`} onConfirm={confirmDelete} onCancel={() => setDeleteDlg(null)} />}
            <div className="statusbar">
              <span className="sb-sel">{describeSelection(project, selection) || 'Sin selección'}</span>
              <span className="sb-stats">{project.modules.length} módulos · {cut.rows.reduce((a, r) => a + r.qty, 0)} piezas · {nesting.reduce((a, n) => a + n.sheets.length, 0)} placas</span>
            </div>
          </section>
          <Inspector project={project} settings={settings} selected={selected} built={selected ? builtById.get(selected.id) : null}
            selectedWallId={selectedWallId} onSelectWall={selectWall} onDrawWalls={startDrawWalls}
            onDeleteWall={(id) => setDeleteDlg({ wallId: id })} onSplitWall={doSplit}
            selectedOpeningId={selectedOpeningId} selectedColumnId={selectedColumnId} onSelectItem={setSelection}
            onParams={(patch) => mapModule(selectedId, (m) => ({ ...m, params: { ...m.params, ...patch } }))}
            onUpdate={(patch) => mapModule(selectedId, (m) => ({ ...m, ...patch }))}
            onDelete={deleteSelected} onDuplicate={duplicateSelected} onRotate={rotateSelected}
            onProject={(fn) => setProject((p) => normalizeProject(fn(p)))} />
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
