import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_SETTINGS, mergeSettings } from './domain/catalog.js';
import { newModule, footprint, snapPosition, resizeModule, uid, isSquare, MODULE_TYPES } from './domain/modules.js';
import { insertPose } from './domain/insert.js';
import { collideMove, collideLift } from './domain/collision.js';
import { nudgeTarget, rotateAboutCenter, lockAxis, restingHeight } from './domain/movement.js';
import { withItem } from './domain/library.js';
import { ToolsNav, MovementPanel } from './ui/MovementPanel.jsx';
import ModelsPanel from './ui/ModelsPanel.jsx';
import AggregatesPanel from './ui/AggregatesPanel.jsx';
import AutoInsertPanel from './ui/AutoInsertPanel.jsx';
import { applyAuto, withAutoInsert } from './domain/autoInsert.js';
import { setAgg } from './domain/aggregates.js';
import { applyModel } from './domain/models.js';
import { applyStyle, stylesOf } from './domain/styles.js';
import StatusToggles from './ui/StatusToggles.jsx';
import { moveWall, moveNode, setWallLength, setWallAngle, updateWall, splitWall, deleteWalls, followWall } from './domain/wallEdit.js';
import { WallContextMenu, WallDeleteDialog, ModuleContextMenu } from './ui/WallMenus.jsx';
import { maxSize, canMaxSize } from './domain/maxSize.js';
import { applyDimEdit } from './domain/dimensions.js';
import { updateOpening, setOpeningDim, moveColumn, removeOpening, removeColumn } from './domain/openings.js';
import { addWall, segmentEnd } from './domain/drawWalls.js';
import { addAnnotation, removeAnnotation } from './domain/annotations.js';
import { scalePlanImage } from './domain/planImage.js';
import { absAngle } from './domain/walls.js';
import DrawHud from './ui/DrawHud.jsx';
import { buildAll, computeCutList, resolveRules } from './domain/cutlist.js';
import { nestAll } from './domain/nesting.js';
import { computeBudget } from './domain/budget.js';
import { sampleProject, emptyProject, normalizeProject } from './domain/project.js';
import Scene3D from './ui/Scene3D.jsx';
import CatalogBar from './ui/CatalogBar.jsx';
import QuickFind from './ui/QuickFind.jsx';
import ModuleList from './ui/ModuleList.jsx';
import { toggleHidden, removeModules } from './domain/moduleList.js';
import { itemParams } from './domain/library.js';
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
  // Interruptores de la barra inferior (como Promob): Colisión, Acoplamientos, Auto Rebajar.
  const [ui, setUi] = usePersistent('mueblesapp.ui', { collision: true, magnets: true, autoLower: true });
  const autoLower = ui.autoLower !== false;
  const toggleUi = (k) => setUi((u) => ({ ...u, [k]: u[k] === false }));
  // Paneles laterales (pestañas verticales a la izquierda): Lista de Módulos o Inserción Automática.
  const side = ui.side ?? (ui.listOpen ? 'lista' : null);
  const setSide = (s) => setUi((u) => ({ ...u, listOpen: undefined, side: (u.side ?? (u.listOpen ? 'lista' : null)) === s ? null : s }));
  const tool = ['movimiento', 'modelos', 'agregados'].includes(ui.tool) ? ui.tool : 'propiedades'; // botonera Herramientas
  const setTool = (t) => setUi((u) => ({ ...u, tool: t }));
  // Traba de eje al arrastrar (teclas X / Y de Promob): 'x' o 'z'.
  const [axisLock, setAxisLock] = useState(null);
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
  const selectedDimId = selection?.kind === 'dim' ? selection.id : null;
  const selectDim = useCallback((id) => setSelection(id ? { kind: 'dim', id } : null), []);
  const [renderMode, setRenderMode] = useState(false);
  const [photoreal, setPhotoreal] = useState(false);
  const [samples, setSamples] = useState(0);
  const [maxSamples, setMaxSamples] = useState(400);
  const [view, setView] = useState({ name: 'perspectiva', tick: 0 });
  const captureRef = useRef(null);
  const fileRef = useRef(null);

  // La geometría no depende de la posición: no recalcular corte/presupuesto al arrastrar.
  const buildKey = JSON.stringify([project.modules.map((m) => [m.id, m.type, m.params, m.mats, m.rules, m.aggs]), project.defaults, project.rules]);
  const built = useMemo(() => buildAll(project, settings), [buildKey, settings]); // eslint-disable-line react-hooks/exhaustive-deps
  const builtById = useMemo(() => new Map(built.map((b) => [b.id, b])), [built]);
  const cut = useMemo(() => computeCutList(built), [built]);
  const nesting = useMemo(() => nestAll(cut.rows, settings), [cut, settings]);
  const budget = useMemo(() => computeBudget(cut, nesting, settings), [cut, nesting, settings]);

  const selected = project.modules.find((m) => m.id === selectedId) || null;
  // Miniaturas del catálogo: se regeneran si cambian materiales o reglas del proyecto.
  const thumbKey = JSON.stringify([project.defaults, project.rules, settings.materials.map((m) => [m.id, m.color, m.t, m.wood])]);
  const thumbCtx = useMemo(() => ({ key: thumbKey, project: { defaults: project.defaults, rules: project.rules }, settings }), [thumbKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const mapModule = useCallback((id, fn) => setProject((p) => ({
    ...p, modules: p.modules.map((m) => (m.id === id ? fn(m) : m)),
  })), [setProject]);

  // En Planta, con grilla magnética, los arrastres se redondean al paso de la grilla.
  const grid = project.room.grid || { size: 50, magnetic: true };
  const gridStep = view.name === 'planta' && grid.magnetic ? grid.size : 10;
  // Mover un módulo: imán (Acoplamientos) y, con Colisión, sin atravesar paredes ni módulos.
  const placeModule = useCallback((p, id, x0, z0, magnet, lock = null) => {
    const m = p.modules.find((o) => o.id === id);
    if (!m) return p;
    const { x, z } = lockAxis(m, x0, z0, lock);
    let pos = magnet ? snapPosition({ ...m, x, z }, p.modules.filter((o) => o.id !== id), p.room, 40, gridStep) : { x: Math.round(x), z: Math.round(z) };
    // Apoyado: se mueve a la altura de lo que tiene debajo en el destino (sube a la mesada, baja al piso).
    const mm = m.rest ? { ...m, y: restingHeight({ ...m, ...pos }, p.modules) } : m;
    if (ui.collision !== false) pos = collideMove(mm, pos.x, pos.z, p.room, p.modules);
    if (lock === 'x') pos = { ...pos, z: m.z };
    if (lock === 'z') pos = { ...pos, x: m.x };
    if (m.rest) pos = { ...pos, y: restingHeight({ ...m, ...pos }, p.modules) };
    if (pos.x === m.x && pos.z === m.z && (pos.y ?? m.y) === m.y) return p;
    return { ...p, modules: p.modules.map((o) => (o.id === id ? { ...o, ...pos } : o)) };
  }, [gridStep, ui.collision]);
  const onMove = useCallback((id, x, z) => setProject((p) => placeModule(p, id, x, z, ui.magnets !== false, axisLock)), [setProject, placeModule, ui.magnets, axisLock]);
  // Panel Movimiento: un paso por eje (con Colisión no atraviesa nada) y giro sobre el centro.
  const nudgeSelected = (axis, sign, step = ui.moveStep ?? 10) => selectedId && setProject((p) => {
    const m = p.modules.find((o) => o.id === selectedId);
    if (!m) return p;
    const t = nudgeTarget(m, axis, sign, step, ui.relative !== false);
    if (axis !== 'h') return placeModule(p, m.id, t.x, t.z, false);
    const y = ui.collision !== false ? collideLift(m, t.y, p.room, p.modules) : t.y;
    return y === (m.y || 0) ? p : { ...p, modules: p.modules.map((o) => (o.id === m.id ? { ...o, y } : o)) };
  });
  const rotateBy = (deg) => selectedId && mapModule(selectedId, (m) => ({ ...m, ...rotateAboutCenter(m, deg) }));
  const setGrid = (patch) => setProject((p) => ({ ...p, room: { ...p.room, grid: { ...grid, ...patch } } }));

  // Arrastre de paredes y vértices: cada movimiento parte del ambiente que había al
  // empezar el arrastre (sin acumular errores) y todo el arrastre es un paso de deshacer.
  const projectRef = useRef(project);
  projectRef.current = project;
  const baseRoomRef = useRef(null), baseModsRef = useRef(null);
  const onDragStart = useCallback(() => { baseRoomRef.current = projectRef.current.room; baseModsRef.current = projectRef.current.modules; history.begin(); }, [history.begin]);
  // Los módulos apoyados en la pared la acompañan.
  const onMoveWall = useCallback((id, dx, dz) => setProject((p) => {
    const base = baseRoomRef.current || p.room;
    return { ...p, room: moveWall(base, id, dx, dz), modules: followWall(base, id, baseModsRef.current || p.modules, dx, dz, p.modules) };
  }), [setProject]);
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
  // Cotas manuales: lineal (2 clics) o angular (3 clics); la herramienta sigue activa hasta Esc.
  const [annotating, setAnnotating] = useState(null); // { mode: 'lin' | 'ang', points }
  const toPlanta = () => { if (view.name !== 'planta') { setView((v) => ({ name: 'planta', tick: v.tick + 1 })); setShowDims(true); } };
  const startAnnotate = () => { setDrawing(null); setAnnotating({ mode: 'lin', points: [] }); setSelection(null); toPlanta(); };
  const stopAnnotate = () => setAnnotating(null);
  const onAnnotatePoint = (pt) => {
    const pts = [...annotating.points, pt];
    if (pts.length === (annotating.mode === 'lin' ? 2 : 3)) {
      setProject((p) => addAnnotation(p, annotating.mode, pts));
      setAnnotating({ ...annotating, points: [] });
    } else setAnnotating({ ...annotating, points: pts });
  };
  // Escalar el plano de referencia: 2 clics libres + medida real.
  const [scaling, setScaling] = useState(null); // { points }
  const [scaleLen, setScaleLen] = useState('');
  const scaleRef = useRef(null);
  const startScale = () => { setDrawing(null); setAnnotating(null); setScaling({ points: [] }); setScaleLen(''); toPlanta(); };
  const stopScale = () => setScaling(null);
  const onScalePoint = (pt) => {
    if (scaling.points.length >= 2) return;
    setScaling({ points: [...scaling.points, pt] });
    // el clic en el visor se queda con el foco después del render: enfocar la medida después
    if (scaling.points.length === 1) setTimeout(() => scaleRef.current?.focus(), 50);
  };
  const applyScale = () => {
    const v = Number(String(scaleLen).replace(',', '.'));
    if (scaling.points.length === 2 && v > 0) setProject((p) => ({ ...p, planImage: scalePlanImage(p.planImage, scaling.points[0], scaling.points[1], v) }));
    stopScale();
  };
  const annTool = annotating ?? (scaling ? { mode: 'lin', points: scaling.points, free: true } : null);

  const startDrawWalls = () => {
    setAnnotating(null); setScaling(null);
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

  // Menú del módulo (clic derecho): tamaño máximo hasta el obstáculo, rotar, duplicar, eliminar.
  const [modMenu, setModMenu] = useState(null); // { id, x, y }
  const moduleAction = (action) => {
    const id = modMenu.id;
    setModMenu(null);
    if (action.startsWith('max-')) {
      const param = action.slice(4);
      setProject((p) => ({ ...p, modules: p.modules.map((m) => (m.id === id ? maxSize(m, param, p.room, p.modules) : m)) }));
    } else if (action === 'rotate') rotateSelected();
    else if (action === 'duplicate') duplicateSelected();
    else if (action === 'delete') deleteSelected();
  };

  // Insertar desde el catálogo (doble clic): posición siguiente libre; cuenta para "Más usados".
  const countUse = (item) => setUi((u) => ({ ...u, catalogUse: { ...(u.catalogUse || {}), [item.id]: ((u.catalogUse || {})[item.id] || 0) + 1 } }));
  // Arrastrar desde el catálogo: recuadro verde en el plano de inserción (pared o piso) y soltar inserta.
  const pickRef = useRef(null);
  const dragItemRef = useRef(null);
  const [ghost, setGhost] = useState(null);
  const [quickFind, setQuickFind] = useState(false); // Localizar Rápido (Ctrl+L)
  const ghostAt = (clientX, clientY) => {
    const d = dragItemRef.current;
    const pt = d && pickRef.current?.(clientX, clientY, 0);
    if (!pt) return null;
    const params = itemParams(d.item, d.variant);
    const { wallId, ...pose } = insertPose(d.item.type, params, project.room, pt, d.item.y); // eslint-disable-line no-unused-vars
    let m = { id: '__ghost', type: d.item.type, params, ...pose, mats: {}, ...(MODULE_TYPES[d.item.type]?.rest ? { rest: true } : {}) };
    if (ui.magnets !== false && isSquare(m.rot)) m = { ...m, ...snapPosition(m, project.modules, project.room, 40, gridStep) };
    return m;
  };
  const vpDrag = {
    onDragOver: (e) => {
      if (!dragItemRef.current) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      const m = ghostAt(e.clientX, e.clientY);
      setGhost((g) => (m && g && g.x === m.x && g.z === m.z && g.rot === m.rot ? g : m));
    },
    onDragLeave: (e) => { if (!e.currentTarget.contains(e.relatedTarget)) setGhost(null); },
    onDrop: (e) => {
      const d = dragItemRef.current;
      if (!d) return;
      e.preventDefault();
      const m = ghostAt(e.clientX, e.clientY);
      dragItemRef.current = null;
      setGhost(null);
      if (!m) return;
      const mod = withAutoInsert(withItem({ ...m, id: uid() }, d.item, project.modules), project, (x) => resolveRules(x, project));
      countUse(d.item);
      setProject((p) => ({ ...p, modules: [...p.modules, mod] }));
      setSelectedId(mod.id);
    },
  };
  const insertItem = (item, variant = null) => {
    countUse(item);
    const m = withAutoInsert(withItem(newModule(item.type, project, itemParams(item, variant), item.y), item, project.modules), project, (x) => resolveRules(x, project));
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
  const rotateSelected = () => rotateBy(90);

  useEffect(() => {
    const onKey = (e) => {
      const inField = ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName);
      if ((e.ctrlKey || e.metaKey) && !inField) {
        const k = e.key.toLowerCase();
        if (k === 'z' && !e.shiftKey) { e.preventDefault(); history.undo(); return; }
        if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); history.redo(); return; }
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'p') { e.preventDefault(); startDrawWalls(); return; }
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'l' && tab === 'diseno') { e.preventDefault(); setQuickFind(true); return; }
      if (tab !== 'diseno' || inField) return;
      const plain = !e.ctrlKey && !e.metaKey && !e.altKey;
      const key = e.key.toLowerCase();
      if (plain && key === 'b') { toggleUi('collision'); return; }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && key === 'm') { e.preventDefault(); setTool('movimiento'); return; }
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && key === 'd') { e.preventDefault(); duplicateSelected(); return; }
      if (plain && key === 'e') { setTool('propiedades'); return; }
      if (plain && key === 'a') { setTool('agregados'); return; } // Agregados
      if (plain && key === 'o' && selectedId) { setProject((p) => toggleHidden(p, [selectedId])); return; } // visible / oculto
      if (plain && key === 'x') { setAxisLock((l) => (l === 'x' ? null : 'x')); return; }
      if (plain && key === 'y') { setAxisLock((l) => (l === 'z' ? null : 'z')); return; }
      if (plain && key === 'm') { stopDrawWalls(); stopAnnotate(); stopScale(); return; } // Seleccionar / Mover
      if (plain && key === 'd' && !drawing && !annotating && !scaling) { startAnnotate(); return; } // calcular distancia
      if (annotating) { if (e.key === 'Escape') stopAnnotate(); return; }
      if (scaling) {
        if (e.key === 'Escape') stopScale();
        else if (scaling.points.length === 2 && /^[0-9.,]$/.test(e.key)) { e.preventDefault(); setScaleLen((v) => v + e.key); scaleRef.current?.focus(); }
        else if (scaling.points.length === 2 && e.key === 'Enter') applyScale();
        return;
      }
      if (selectedDimId && (e.key === 'Delete' || e.key === 'Backspace')) { e.preventDefault(); setProject((p) => removeAnnotation(p, selectedDimId)); setSelection(null); return; }
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
      else if (e.key === 'PageUp' || e.key === 'PageDown') { e.preventDefault(); nudgeSelected('h', e.key === 'PageUp' ? 1 : -1, e.shiftKey ? 100 : 10); }
      else if (e.key.startsWith('Arrow')) {
        e.preventDefault();
        const st = e.shiftKey ? 100 : 10;
        const dx = e.key === 'ArrowLeft' ? -st : e.key === 'ArrowRight' ? st : 0;
        const dz = e.key === 'ArrowUp' ? -st : e.key === 'ArrowDown' ? st : 0;
        setProject((p) => { const m = p.modules.find((o) => o.id === selectedId); return m ? placeModule(p, selectedId, m.x + dx, m.z + dz, false) : p; });
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
        <main className={`design${side ? ' with-list' : ''}`}>
          <div className="side-tabs">
            <button className={`side-tab${side === 'lista' ? ' on' : ''}`} onClick={() => setSide('lista')}>Lista de Módulos</button>
            <button className={`side-tab${side === 'auto' ? ' on' : ''}`} onClick={() => setSide('auto')}>Inserción Automática</button>
          </div>
          {side === 'auto' && (
            <AutoInsertPanel autoInsert={project.autoInsert} hasSelection={!!selectedId}
              onAutoInsert={(ai) => setProject((p) => ({ ...p, autoInsert: ai }))}
              onAmbiente={(cat, ids, on, onlySel) => setProject((p) => applyAuto(p, cat, ids, on, (m) => resolveRules(m, p), onlySel ? (selectedId ? [selectedId] : []) : null))} />
          )}
          {side === 'lista' && (
            <ModuleList project={project} selectedId={selectedId} onSelect={setSelectedId}
              onToggleHidden={(ids) => setProject((p) => toggleHidden(p, ids))}
              onRemove={(ids) => { setProject((p) => removeModules(p, ids)); setSelectedId(null); }} />
          )}
          <section className="viewport">
            <CatalogBar nav={ui.catalogPath} setNav={(p) => setUi((u) => ({ ...u, catalogPath: p }))} counts={ui.catalogUse} onInsert={insertItem} thumbCtx={thumbCtx}
              onDragItem={(item, variant) => { dragItemRef.current = item ? { item, variant } : null; if (!item) setGhost(null); }}
              onFind={() => setQuickFind(true)} />
            {quickFind && <QuickFind thumbCtx={thumbCtx} onClose={() => setQuickFind(false)} onInsert={insertItem}
              onShow={(path, item) => setUi((u) => ({ ...u, catalogPath: [...path, item.id] }))} />}
            <div className="vp-area" {...vpDrag}>
            <ErrorBoundary onReset={() => { setPhotoreal(false); setRenderMode(false); }}>
              <Scene3D project={project} builtById={builtById} selectedId={selectedId} onSelect={setSelectedId} onMove={onMove}
                selectedWallId={selectedWallId} onSelectWall={selectWall}
                onMoveWall={onMoveWall} onMoveNode={onMoveNode} onResize={onResize} step={gridStep}
                onDimEdit={onDimEdit} onWallLength={onWallLength} onWallAngle={onWallAngle}
                onDragStart={onDragStart} onDragEnd={history.commit}
                drawing={drawing} drawCursorRef={drawCursorRef} onDrawPoint={onDrawPoint} onDrawFinish={stopDrawWalls}
                onWallContext={onWallContext} onModuleContext={(m) => setModMenu(m)}
                annotating={annTool} onAnnotatePoint={annotating ? onAnnotatePoint : onScalePoint} onAnnotateFinish={annotating ? stopAnnotate : stopScale}
                selectedDimId={selectedDimId} onSelectDim={selectDim}
                onRestoreWall={(id) => setProject((p) => ({ ...p, room: updateWall(p.room, id, { lowered: false }) }))}
                selectedOpeningId={selectedOpeningId} onSelectOpening={selectOpening} onMoveOpening={onMoveOpening} onOpeningDim={onOpeningDim}
                selectedColumnId={selectedColumnId} onSelectColumn={selectColumn} onMoveColumn={onMoveColumn}
                renderMode={renderMode || photoreal} photoreal={photoreal} maxSamples={maxSamples} onProgress={setSamples}
                view={view} captureRef={captureRef} showDims={showDims} autoHideWalls={autoLower} pickRef={pickRef} ghost={ghost} />
            </ErrorBoundary>
            <div className="vp-toolbar">
              {[['perspectiva', 'Perspectiva'], ['frente', 'Frente'], ['planta', 'Planta']].map(([k, l]) => (
                <button key={k} className={view.name === k ? 'active-soft' : ''} onClick={() => { setView((v) => ({ name: k, tick: v.tick + 1 })); if (k === 'planta') setShowDims(true); else { stopDrawWalls(); stopAnnotate(); stopScale(); } }}>{l}</button>
              ))}
              <button className={drawing ? 'active' : ''} onClick={() => (drawing ? stopDrawWalls() : startDrawWalls())} title="Construir paredes (Ctrl+Shift+P)">✏ Paredes</button>
              <button className={annotating ? 'active' : ''} onClick={() => (annotating ? stopAnnotate() : startAnnotate())} title="Cota manual: lineal o angular">↔ Cota</button>
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
              <button onClick={exportImage} title="Exportar imagen (PNG)">⤓</button>
            </div>
            {drawing && (
              <DrawHud draw={drawing} len={drawLen} setLen={setDrawLen} ang={drawAng} setAng={setDrawAng} lenRef={lenRef} angRef={angRef}
                onCommit={commitTyped} onCancel={stopDrawWalls}
                onClose={(yes) => (yes ? commitWall({ nodeId: drawing.chainStartId }) : setDrawing({ ...drawing, confirmClose: false }))} />
            )}
            {annotating && (
              <div className="draw-hud">
                <b>Cota manual</b>
                <label className="radio"><input type="radio" name="ann" checked={annotating.mode === 'lin'} onChange={() => setAnnotating({ mode: 'lin', points: [] })} /> Lineal</label>
                <label className="radio"><input type="radio" name="ann" checked={annotating.mode === 'ang'} onChange={() => setAnnotating({ mode: 'ang', points: [] })} /> Angular</label>
                <button onClick={stopAnnotate}>Terminar</button>
                <span className="hint-inline">{annotating.mode === 'lin' ? 'Clic en el primer punto y en el segundo' : 'Clic en un brazo, en el vértice y en el otro brazo'} · se pega a esquinas y caras · Esc o clic derecho termina</span>
              </div>
            )}
            {scaling && (
              <div className="draw-hud">
                <b>Escalar plano</b>
                {scaling.points.length < 2
                  ? <span className="hint-inline">Clic en los dos extremos de un tramo que conozcas (por ejemplo, una pared) · Esc cancela</span>
                  : <label>Medida real <input ref={scaleRef} autoFocus value={scaleLen} onChange={(e) => setScaleLen(e.target.value)} onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') applyScale(); if (e.key === 'Escape') stopScale(); }} /> mm</label>}
                {scaling.points.length === 2 && <button className="active" onClick={applyScale}>Aplicar</button>}
                <button onClick={stopScale}>Cancelar</button>
              </div>
            )}
            {modMenu && <ModuleContextMenu menu={modMenu} canMax={canMaxSize(project.modules.find((m) => m.id === modMenu.id) || {})} onAction={moduleAction} onClose={() => setModMenu(null)} />}
            {wallMenu && <WallContextMenu menu={wallMenu} wall={project.room.walls.find((w) => w.id === wallMenu.wallId)} onAction={wallAction} onClose={() => setWallMenu(null)} />}
            {deleteDlg && <WallDeleteDialog label={`Pared ${project.room.walls.findIndex((w) => w.id === deleteDlg.wallId) + 1}`} onConfirm={confirmDelete} onCancel={() => setDeleteDlg(null)} />}
            <div className="statusbar">
              <span className="sb-sel">{describeSelection(project, selection) || 'Sin selección'}</span>
              {axisLock && <span className="sb-lock" title="X / Y cambian la traba">Movimiento trabado: solo {axisLock === 'x' ? 'ancho (X)' : 'profundidad (Y)'}</span>}
              <span className="sb-stats">{project.modules.length} módulos · {cut.rows.reduce((a, r) => a + r.qty, 0)} piezas · {nesting.reduce((a, n) => a + n.sheets.length, 0)} placas</span>
              <StatusToggles ui={ui} onToggle={toggleUi} showDims={showDims} onShowDims={setShowDims}
                planImage={project.planImage} onPlanImage={(visible) => setProject((p) => ({ ...p, planImage: { ...p.planImage, visible } }))} />
            </div>
            </div>
          </section>
          <div className="tools-col">
          <ToolsNav tool={tool} onTool={setTool} />
          {tool === 'agregados' && (
            <AggregatesPanel selected={selected} rules={selected ? resolveRules(selected, project) : null}
              onAgg={(id, on, qty) => selectedId && setProject((p) => ({ ...p, modules: p.modules.map((m) => (m.id === selectedId ? setAgg(m, resolveRules(m, p), id, on, qty) : m)) }))} />
          )}
          {tool === 'modelos' && (
            <ModelsPanel project={project} settings={settings} selected={selected}
              onApply={(slot, id, scope) => setProject((p) => applyModel(p, slot, id, scope, selectedId ? [selectedId] : []))}
              styles={stylesOf(settings)} onStyles={(list) => setSettings((s) => ({ ...s, styles: list }))}
              onApplyStyle={(style, scope) => setProject((p) => applyStyle(p, style, scope, selectedId ? [selectedId] : []))} />
          )}
          {tool === 'movimiento'
            ? <MovementPanel label={selected ? describeSelection(project, selection) : null} ui={ui} setUi={setUi} onNudge={nudgeSelected} onRotate={(sign) => rotateBy(sign * (ui.rotStep ?? 90))} />
            : tool === 'propiedades' && <Inspector project={project} settings={settings} selected={selected} built={selected ? builtById.get(selected.id) : null}
            selectedWallId={selectedWallId} onSelectWall={selectWall} onDrawWalls={startDrawWalls}
            onDeleteWall={(id) => setDeleteDlg({ wallId: id })} onSplitWall={doSplit}
            selectedOpeningId={selectedOpeningId} selectedColumnId={selectedColumnId} onSelectItem={setSelection} onScaleImage={startScale}
            onParams={(patch) => mapModule(selectedId, (m) => ({ ...m, params: { ...m.params, ...patch } }))}
            onUpdate={(patch) => mapModule(selectedId, (m) => ({ ...m, ...patch }))}
            onDelete={deleteSelected} onDuplicate={duplicateSelected} onRotate={rotateSelected}
            onRotateTo={(deg) => selected && rotateBy(deg - (selected.rot || 0))}
            onRest={(on) => selectedId && setProject((p) => ({ ...p, modules: p.modules.map((m) => (m.id === selectedId ? { ...m, rest: on, ...(on ? { y: restingHeight(m, p.modules) } : {}) } : m)) }))}
            onProject={(fn) => setProject((p) => normalizeProject(fn(p)))} />}
          </div>
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
