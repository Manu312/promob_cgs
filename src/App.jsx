import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_SETTINGS, mergeSettings } from './domain/catalog.js';
import { newModule, footprint, snapPosition, resizeModule, uid, isSquare, MODULE_TYPES, fieldsFor, localAxes } from './domain/modules.js';
import { insertPose } from './domain/insert.js';
import { collideMove, collideLift } from './domain/collision.js';
import { nudgeTarget, rotateAboutCenter, lockAxis, restingHeight } from './domain/movement.js';
import { withItem } from './domain/library.js';
import { ToolsNav, MovementPanel } from './ui/MovementPanel.jsx';
import ModelsPanel from './ui/ModelsPanel.jsx';
import AggregatesPanel from './ui/AggregatesPanel.jsx';
import AutoInsertPanel from './ui/AutoInsertPanel.jsx';
import AperturasPanel from './ui/AperturasPanel.jsx';
import TiradorPanel from './ui/TiradorPanel.jsx';
import { frontsOf, invertHinge } from './domain/fronts.js';
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
import { absAngle, wallGeometry } from './domain/walls.js';
import DrawHud from './ui/DrawHud.jsx';
import { buildAll, computeCutList, resolveRules } from './domain/cutlist.js';
import { nestAll } from './domain/nesting.js';
import { computeBudget } from './domain/budget.js';
import { sampleProject, emptyProject, normalizeProject } from './domain/project.js';
import Scene3D from './ui/Scene3D.jsx';
import RenderDialog, { RenderArea } from './ui/RenderDialog.jsx';
import RenderWindow from './ui/RenderWindow.jsx';
import { normalizeRender, normalizeWatermark, qualityOf, renderSize, fitRect, lightRig } from './domain/render.js';
import CatalogBar from './ui/CatalogBar.jsx';
import QuickFind from './ui/QuickFind.jsx';
import ModuleList from './ui/ModuleList.jsx';
import MultiSelectionPanel from './ui/MultiSelectionPanel.jsx';
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
import { toggleId, selectAllIds, moveGroup, rotateGroup, describeMulti } from './domain/multiSelect.js';
import { expandToGroups, groupModules, ungroupModules, selectionGroup, pruneGroups } from './domain/groups.js';
import { pasteModules, sideOffset } from './domain/clipboard.js';
import { replaceModule, findItemForModule } from './domain/replace.js';
import { toExtreme, centerX, invertModule, shiftRotation } from './domain/moveExtras.js';
import { VIEWS, pushView, backView, fwdView } from './domain/views.js';
import { sagittaFromPoint } from './domain/curvedWalls.js';
import { joinWalls, angleFrom304050, pointOnWall, projectOnAngle } from './domain/wallJoin.js';
import { fitFloor, standardFloor, setFloorShape, setFloorGrid, floorGridOf, snapToFloorGrid } from './domain/floor.js';
import { FloorShapeEditor, FloorGridEditor } from './ui/FloorEditors.jsx';
import { rulerGroups, wallRulers, snapToRulers } from './domain/rulers.js';
import { makeFavorite, placeFavorite, removeFavorite, exportFavorites, importFavorites, favoriteGroups } from './domain/favorites.js';
import FavoriteDialog from './ui/FavoriteDialog.jsx';
import { prefsOf, applyPrefsToNewProject } from './domain/prefs.js';
import { remapEvent } from './domain/shortcuts.js';
import PrefsDialog from './ui/PrefsDialog.jsx';
import { parseDxf, segmentsToWalls } from './domain/dxf.js';
import { validateExternal, addExternal, updateExternal, removeExternal } from './domain/externals.js';
import { DxfImportDialog, ExternalsPanel } from './ui/ImportDialogs.jsx';
import { rid as wallRid } from './domain/walls.js';
import { normalizeRoom } from './domain/room.js';
import { INSERT_DIRECTIONS, INSERT_ORIENTATIONS, placeRelative, orientItem, changePlane, detachModule } from './domain/insertion.js';
import RulersDialog from './ui/RulersDialog.jsx';
import { modulesOnWall } from './domain/wallEdit.js';
import { FILL_MODES, fillMode, nextFillMode } from './domain/fillModes.js';
import { applyRoomMaterial, copyFinish, setFinishProps, finishesOf } from './domain/roomMaterials.js';
import MaterialsPanel from './ui/MaterialsPanel.jsx';
import { StripEditor, RegionEditor } from './ui/SurfaceEditors.jsx';
import TamponamentoEditor from './ui/TamponamentoEditor.jsx';
import LightsEditor from './ui/LightsEditor.jsx';
import { linearItemFor, DEFAULT_TOP_ITEMS } from './domain/tamponamento.js';
import { setHole, GEOMETRY_KINDS, newGeometry, addGeometry, updateGeometry, removeGeometry, moveGeometry, outlineOf, boundsOf, resizeGeometry, regularPolygon, snapSegment, nextPoint, rectPts, convertGeometry, geometryBudgetLines } from './domain/geometry.js';
import { GeometryHud, LinealDialog, GeometryPanel } from './ui/GeometryPanels.jsx';
import { planeFrame } from './ui/Geometry3D.jsx';
import { stripsOf, cellAt, applyStripMaterial, updateRegion } from './domain/strips.js';
import { roomWalls } from './domain/room.js';
import ReposicionarDialog from './ui/ReposicionarDialog.jsx';

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
  const tool = ['movimiento', 'modelos', 'agregados', 'aperturas', 'tirador'].includes(ui.tool) ? ui.tool : 'propiedades'; // botonera Herramientas
  // Aperturas: qué frentes están abiertos (solo de la vista: no se guarda ni va al historial).
  const [openFronts, setOpenFronts] = useState({}); // { [moduleId]: { open: { [k]: true }, cascade } }
  const toggleFront = (id, k) => setOpenFronts((o) => { const st = o[id] || {}; return { ...o, [id]: { open: { ...(st.open || {}), [k]: !st.open?.[k] }, cascade: false } }; });
  const setTool = (t) => setUi((u) => ({ ...u, tool: t }));
  // Traba de eje al arrastrar (teclas X / Y de Promob): 'x' o 'z'.
  const [axisLock, setAxisLock] = useState(null);
  const [rawSettings, setSettings] = usePersistent('mueblesapp.settings', DEFAULT_SETTINGS);
  const settings = useMemo(() => mergeSettings(rawSettings), [rawSettings]);
  const [tab, setTab] = useState('diseno');
  // Selección única: { kind: 'module' | 'wall', id } (Fase 1 suma aberturas, columnas y cotas).
  const [selection, setSelection] = useState(null);
  const selectedId = selection?.kind === 'module' ? selection.id : null;
  // Varios módulos (Ctrl+clic, Ctrl+T): `id` es el último elegido; `ids` todos los seleccionados.
  const selectedIds = useMemo(() => (selection?.kind === 'module' ? (selection.ids || [selection.id]) : []), [selection]);
  const multiSel = selectedIds.length > 1;
  const selectIds = useCallback((ids) => setSelection(ids.length ? { kind: 'module', id: ids[ids.length - 1], ids } : null), []);
  const groupsRef = useRef(null);
  const toggleSelect = useCallback((id) => setSelection((s) => {
    const cur = s?.kind === 'module' ? (s.ids || [s.id]) : [];
    const members = groupsRef.current ? expandToGroups(groupsRef.current, [id]) : [id];
    const ids = cur.includes(id) ? cur.filter((x) => !members.includes(x)) : [...cur, ...members.filter((x) => !cur.includes(x))];
    return ids.length ? { kind: 'module', id: ids[ids.length - 1], ids } : null;
  }), []);
  // Clic en un módulo: si es de un grupo, queda seleccionado el grupo entero (Promob).
  const selectModule = useCallback((id) => {
    if (!id) { setSelection(null); return; }
    const ids = groupsRef.current ? expandToGroups(groupsRef.current, [id]) : [id];
    setSelection({ kind: 'module', id, ids });
  }, []);
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
  // Render (Fase 7): diálogo de configuración, ventana de render y tamaño de la vista 3D.
  const [renderDlg, setRenderDlg] = useState(false);
  // Marca de agua: se guarda en el navegador y se reutiliza en todos los renders (como Promob).
  const [rawWatermark, setWatermark] = usePersistent('mueblesapp.render.watermark', null);
  const watermark = useMemo(() => normalizeWatermark(rawWatermark), [rawWatermark]);
  const [renderJob, setRenderJob] = useState(null); // { size, quality } mientras la ventana está abierta
  const renderRef = useRef(null);
  const vpRef = useRef(null);
  const [vpSize, setVpSize] = useState({ width: 1000, height: 600 });
  const [view, setView] = useState({ name: 'perspectiva', tick: 0 });
  const captureRef = useRef(null);
  const fileRef = useRef(null);

  // La geometría no depende de la posición: no recalcular corte/presupuesto al arrastrar.
  const buildKey = JSON.stringify([project.modules.map((m) => [m.id, m.type, m.params, m.mats, m.rules, m.aggs]), project.defaults, project.rules, (project.geometries || []).filter((g) => g.hole?.on && g.plane.kind === 'module')]);
  const built = useMemo(() => buildAll(project, settings), [buildKey, settings]); // eslint-disable-line react-hooks/exhaustive-deps
  const builtById = useMemo(() => new Map(built.map((b) => [b.id, b])), [built]);
  const cut = useMemo(() => computeCutList(built), [built]);
  const nesting = useMemo(() => nestAll(cut.rows, settings), [cut, settings]);
  const geoBudget = useMemo(() => geometryBudgetLines(project), [project.geometries]); // eslint-disable-line react-hooks/exhaustive-deps
  const budget = useMemo(() => computeBudget(cut, nesting, settings, geoBudget), [cut, nesting, settings, geoBudget]);

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
    let pos = magnet && !m.detached ? snapPosition({ ...m, x, z }, p.modules.filter((o) => o.id !== id), p.room, 40, gridStep) : { x: Math.round(x), z: Math.round(z) };
    // Grilla del piso con "Atraer": los bordes del módulo se pegan a sus líneas
    const fg = floorGridOf(p.room);
    if (fg.attract) { const { fw, fd } = footprint(m); pos = snapToFloorGrid(pos.x, pos.z, fw, fd, fg); }
    // Apoyado: se mueve a la altura de lo que tiene debajo en el destino (sube a la mesada, baja al piso).
    const mm = m.rest ? { ...m, y: restingHeight({ ...m, ...pos }, p.modules) } : m;
    if (ui.collision !== false) pos = collideMove(mm, pos.x, pos.z, p.room, p.modules);
    if (lock === 'x') pos = { ...pos, z: m.z };
    if (lock === 'z') pos = { ...pos, x: m.x };
    if (m.rest) pos = { ...pos, y: restingHeight({ ...m, ...pos }, p.modules) };
    if (pos.x === m.x && pos.z === m.z && (pos.y ?? m.y) === m.y) return p;
    return { ...p, modules: p.modules.map((o) => (o.id === id ? { ...o, ...pos } : o)) };
  }, [gridStep, ui.collision]);
  // Arrastrar un módulo de una selección múltiple mueve todo el conjunto (desde donde estaba al empezar).
  const onMove = useCallback((id, x, z) => setProject((p) => {
    if (selectedIds.length > 1 && selectedIds.includes(id)) {
      const base = baseModsRef.current || p.modules;
      const m0 = base.find((m) => m.id === id);
      if (!m0) return p;
      const { x: lx, z: lz } = lockAxis(m0, x, z, axisLock);
      return moveGroup(p, selectedIds, lx - m0.x, lz - m0.z, { collision: ui.collision !== false, base });
    }
    return placeModule(p, id, x, z, ui.magnets !== false, axisLock);
  }), [setProject, placeModule, ui.magnets, ui.collision, axisLock, selectedIds]);
  // Panel Movimiento: un paso por eje (con Colisión no atraviesa nada) y giro sobre el centro.
  const nudgeSelected = (axis, sign, step = ui.moveStep ?? 10) => selectedId && setProject((p) => {
    if (multiSel && axis !== 'h') {
      const d = nudgeTarget({ x: 0, z: 0, rot: 0 }, axis, sign, step, false);
      return moveGroup(p, selectedIds, d.x, d.z, { collision: ui.collision !== false });
    }
    if (multiSel) return { ...p, modules: p.modules.map((o) => (selectedIds.includes(o.id) ? { ...o, y: Math.max(0, (o.y || 0) + sign * step) } : o)) };
    const m = p.modules.find((o) => o.id === selectedId);
    if (!m) return p;
    const t = nudgeTarget(m, axis, sign, step, ui.relative !== false);
    if (axis !== 'h') return placeModule(p, m.id, t.x, t.z, false);
    let ty = t.y;
    const rg = rulerGroupFor(m, p.room); // reglas de la pared: atraen (salvo si ya está pegado a una)
    const onRuler = rg && rg.rulers.some((r) => r.value === (m.y || 0) || r.value === (m.y || 0) + m.params.height);
    if (rg && !onRuler) ty = snapToRulers(ty, m.params.height, rg);
    const y = ui.collision !== false ? collideLift(m, ty, p.room, p.modules) : ty;
    return y === (m.y || 0) ? p : { ...p, modules: p.modules.map((o) => (o.id === m.id ? { ...o, y } : o)) };
  });
  const rotateBy = (deg) => selectedId && (multiSel
    ? setProject((p) => rotateGroup(p, selectedIds, deg))
    : mapModule(selectedId, (m) => ({ ...m, ...rotateAboutCenter(m, deg) })));
  const setGrid = (patch) => setProject((p) => ({ ...p, room: { ...p.room, grid: { ...grid, ...patch } } }));

  // Arrastre de paredes y vértices: cada movimiento parte del ambiente que había al
  // empezar el arrastre (sin acumular errores) y todo el arrastre es un paso de deshacer.
  const projectRef = useRef(project);
  projectRef.current = project;
  groupsRef.current = project;
  const baseRoomRef = useRef(null), baseModsRef = useRef(null);
  const onDragStart = useCallback(() => { baseRoomRef.current = projectRef.current.room; baseModsRef.current = projectRef.current.modules; history.begin(); }, [history.begin]);
  // Los módulos apoyados en la pared la acompañan.
  const onMoveWall = useCallback((id, dx, dz) => setProject((p) => {
    const base = baseRoomRef.current || p.room;
    return { ...p, room: moveWall(base, id, dx, dz), modules: followWall(base, id, baseModsRef.current || p.modules, dx, dz, p.modules) };
  }), [setProject]);
  const onMoveNode = useCallback((id, x, z) => setProject((p) => ({ ...p, room: moveNode(p.room, id, x, z) })), [setProject]);
  const recenter = () => setView((v) => ({ ...v, tick: v.tick + 1 }));
  // Vistas (Promob): ir a una vista guarda la anterior para Volver / Avanzar vista (últimas 20).
  const [viewHist, setViewHist] = useState({ back: [], fwd: [] });
  const goView = (next) => {
    const nv = { name: next.name, wallId: next.wallId, ortho: next.name === 'planta' ? false : (next.ortho ?? view.ortho ?? false) };
    setViewHist((h) => pushView(h, view, nv));
    setView((v) => ({ ...nv, tick: v.tick + 1 }));
    if (nv.name === 'planta') setShowDims(true); else { stopDrawWalls(); stopAnnotate(); stopScale(); }
  };
  const viewBack = () => { const r = backView(viewHist, view); if (r) { setViewHist(r.hist); setView((v) => ({ ...r.view, tick: v.tick + 1 })); } };
  const viewFwd = () => { const r = fwdView(viewHist, view); if (r) { setViewHist(r.hist); setView((v) => ({ ...r.view, tick: v.tick + 1 })); } };
  const toggleOrtho = () => view.name !== 'planta' && goView({ ...view, ortho: !view.ortho });
  // Herramientas de navegación (Promob): Pan (P), Zoom (Z), Zoom Ventana (W), Caminar (C); M vuelve a Seleccionar.
  const [navTool, setNavTool] = useState('select');
  // Modo de relleno (Promob: Exibir > Preenchimento; F10 el siguiente, Ctrl+F10 Presentación).
  const fill = fillMode(ui.fill).id;
  const setFill = (id) => setUi((u) => ({ ...u, fill: id }));
  const navRef = useRef(null);
  const [zoomBox, setZoomBox] = useState(null); // recuadro del Zoom Ventana (px dentro de la vista)
  const walkRef = useRef(null);
  const navToggle = (t) => setNavTool((cur) => (cur === t ? 'select' : t));
  const navOverlay = (navTool === 'zoomWin' || navTool === 'walk') ? {
    onPointerDown: (e) => {
      if (e.button !== 0) return;
      const r = e.currentTarget.getBoundingClientRect();
      e.currentTarget.setPointerCapture?.(e.pointerId);
      if (navTool === 'zoomWin') setZoomBox({ x0: e.clientX - r.left, y0: e.clientY - r.top, x1: e.clientX - r.left, y1: e.clientY - r.top, w: r.width, h: r.height });
      else walkRef.current = { x: e.clientX, y: e.clientY };
    },
    onPointerMove: (e) => {
      if (navTool === 'zoomWin' && zoomBox) { const r = e.currentTarget.getBoundingClientRect(); setZoomBox((z) => ({ ...z, x1: e.clientX - r.left, y1: e.clientY - r.top })); }
      if (navTool === 'walk' && walkRef.current) {
        const dx = e.clientX - walkRef.current.x, dy = e.clientY - walkRef.current.y;
        walkRef.current = { x: e.clientX, y: e.clientY };
        navRef.current?.walk(-dy * 0.01, dx * 0.15); // arrastrar hacia arriba avanza; a los costados gira
      }
    },
    onPointerUp: () => {
      if (navTool === 'zoomWin' && zoomBox) {
        const z = zoomBox;
        setZoomBox(null);
        if (Math.abs(z.x1 - z.x0) > 6 && Math.abs(z.y1 - z.y0) > 6) {
          navRef.current?.zoomWindow({ x0: Math.min(z.x0, z.x1) / z.w, x1: Math.max(z.x0, z.x1) / z.w, y0: Math.min(z.y0, z.y1) / z.h, y1: Math.max(z.y0, z.y1) / z.h });
          setNavTool('select');
        }
      }
      walkRef.current = null;
    },
  } : null;
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
  const [drawLock, setDrawLock] = useState(false); // Bloquear ángulo (Promob, Editor de Paredes)
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
    setDrawLen(''); if (!drawLock) setDrawAng('');
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
    const lockedAbs = drawLockAbs();
    if (lockedAbs != null && !c.nodeId) { commitWall({ point: projectOnAngle(drawFrom(), c.end, lockedAbs).point }); return; }
    commitWall(c.nodeId ? { nodeId: c.nodeId } : { point: c.end });
  };
  // Ángulo trabado (absoluto en planta) a partir del ángulo escrito, si "Bloquear ángulo" está tildado.
  const drawLockAbs = () => {
    if (!drawLock) return null;
    const a = Number(String(drawAng).replace(',', '.'));
    if (drawAng === '' || !Number.isFinite(a)) return null;
    return drawing.prevAbs == null ? a : drawing.prevAbs + (a - 180);
  };
  // Construir con referencia: empezar a una distancia medida desde el inicio de una pared existente.
  const startFromReference = (wallId, dist) => {
    const pt = pointOnWall(project.room, wallId, dist);
    if (pt) { setDrawing({ ...drawing, start: pt }); setTimeout(() => lenRef.current?.focus(), 0); }
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
    else if (action === 'join-canto' || action === 'join-t') setJoinTool({ movingId: wallId, mode: action === 'join-t' ? 't' : 'canto' });
    else if (action === '304050') setDlg304({ wallId, A: 300, B: 400, C: 500 });
    else if (action === 'rulers') setRulersDlg({ wallId });
    else if (action === 'strips') setStripDlg({ wallId });
    else if (action === 'regions') setRegionDlg({ surface: { kind: 'wall', wallId } });
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
    else if (action === 'reposition') duplicateSelected(true);
    else if (action === 'locate') locateSelected();
    else if (action === 'tampon') setTamponDlg({ ids: selectedIds });
    else if (action === 'favorite') setFavDlg({ ids: expandToGroups(project, selectedIds) });
    else if (action === 'detach') setProject((p) => ({ ...p, modules: p.modules.map((m) => (selectedIds.includes(m.id) ? (m.detached ? { ...m, detached: false } : detachModule(m)) : m)) }));
    else if (action === 'delete') deleteSelected();
    else if (action === 'group') groupSelected();
    else if (action === 'ungroup') ungroupSelected();
  };
  // Agrupar (U) y Desagrupar (Ctrl+U), como Promob.
  const groupSelected = () => selectedIds.length > 1 && setProject((p) => groupModules(p, selectedIds));
  const ungroupSelected = () => {
    if (!selectedIds.length) return;
    setProject((p) => ungroupModules(p, selectedIds));
    setSelectedId(selectedId);
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
  // Materiales del ambiente (Promob): soltar sobre el piso lo aplica; sobre una pared pregunta Cara / Todo.
  const surfaceRef = useRef(null);
  const [matMenu, setMatMenu] = useState(null); // { matId, wallId, x, y }
  const [roomTool, setRoomTool] = useState(null); // { kind: 'copy', source } | { kind: 'tint' }
  const [tint, setTint] = useState('#d9c7a7');
  // Editores de franjas y de regiones (Promob: Editar Faixas / Editar Regiões).
  const [stripDlg, setStripDlg] = useState(null);
  const [joinTool, setJoinTool] = useState(null); // Encuentro de paredes: { movingId, mode }
  // Réguas: grupos (guardados para todos los proyectos) y el de cada pared
  const [rulersDlg, setRulersDlg] = useState(null);
  // Módulos favoritos (guardados para todos los proyectos)
  const [favDlg, setFavDlg] = useState(null);
  const [prefsOpen, setPrefsOpen] = useState(false);
  // Importar: planta DXF (referencia o paredes) y modelos 3D (entidades externas)
  const [dxfDlg, setDxfDlg] = useState(null); // { dxf, fileName }
  const [importMsg, setImportMsg] = useState(null);
  const [importsOpen, setImportsOpen] = useState(false);
  const dxfInput = useRef(null), modelInput = useRef(null);
  const onDxfFile = async (f) => {
    if (!f) return;
    if (f.size > 8 * 1024 * 1024) { setImportMsg('El DXF pesa más de 8 MB.'); return; }
    const d = parseDxf(await f.text());
    if (d.error) { setImportMsg(d.error); return; }
    if (!d.entities.length) { setImportMsg('El DXF no tiene líneas, arcos, círculos ni polilíneas.'); return; }
    setDxfDlg({ dxf: d, fileName: f.name });
  };
  const acceptDxf = ({ segments, mode }) => {
    if (mode === 'walls') {
      const { nodes, walls } = segmentsToWalls(segments, { id: (p) => wallRid(p) });
      if (!walls.length) { setImportMsg('No hay tramos rectos para convertir en paredes.'); return; }
      setProject((p) => ({ ...p, room: normalizeRoom({ ...p.room, nodes, walls: walls.map((w) => ({ ...w, t: p.room.t, h0: p.room.h, h1: p.room.h })), openings: [] }) }));
    } else setProject((p) => ({ ...p, planDxf: { segments, visible: true, x: 0, z: 0 } }));
    setImportsOpen(true);
  };
  const onModelFile = async (f) => {
    if (!f) return;
    const isText = /\.(obj|gltf)$/i.test(f.name);
    const text = isText ? await f.text() : null;
    const v = validateExternal({ name: f.name, size: f.size, text });
    if (v.error) { setImportMsg(v.error); return; }
    const data = isText ? text : await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(f); });
    setProject((p) => addExternal(p, { name: f.name.replace(/\.[^.]+$/, ''), format: v.format, data, units: v.format === 'stl' || v.format === 'obj' ? 'mm' : 'm' }));
    setImportsOpen(true);
  };
  const prefs = prefsOf(ui);
  const show = { planos: true, flechas: true, hotpoints: false, insercion: true, invisibles: false, ...(ui.show || {}) }; // menú Mostrar
  const favorites = ui.favorites || [];
  const [favMsg, setFavMsg] = useState(null);
  // Cambiar de plano (clic derecho durante el arrastre): piso, arriba de un módulo o una pared.
  const onChangePlane = useCallback((id, cx, cy) => {
    const t = surfaceRef.current?.(cx, cy);
    if (!t) return;
    setProject((p) => {
      const m = p.modules.find((o) => o.id === id);
      if (!m) return p;
      let target = t.kind === 'module' && t.id !== id ? { kind: 'module', id: t.id } : t.kind === 'floor' ? { kind: 'floor' } : null;
      if (t.kind === 'wall') {
        const g = wallGeometry(p.room).find((w) => w.id === t.wallId);
        if (g) {
          const { fw, fd } = footprint(m);
          const c = [m.x + fw / 2, m.z + fd / 2];
          const s = Math.max(0, Math.min(g.len, (c[0] - g.a[0]) * g.u[0] + (c[1] - g.a[1]) * g.u[1]));
          target = { kind: 'wall', point: [g.a[0] + g.u[0] * s, g.a[1] + g.u[1] * s] };
        }
      }
      if (!target) return p;
      const n = changePlane(m, target, p);
      return n === m ? p : { ...p, modules: p.modules.map((o) => (o.id === id ? n : o)) };
    });
  }, [setProject]);
  const groupsR = rulerGroups(ui.rulerGroups);
  const rulerGroupFor = (m, room) => {
    for (const w of room.walls) {
      if (!w.rulerGroup) continue;
      if (modulesOnWall(room, w.id, [m]).length) return wallRulers(w, groupsR);
    }
    return null;
  };
  // Piso: menú del clic derecho, forma y grilla
  const [floorMenu, setFloorMenu] = useState(null);
  const [floorDlg, setFloorDlg] = useState(null); // 'shape' | 'grid'
  const floorAction = (a) => {
    setFloorMenu(null);
    if (a === 'fit') setProject((p) => ({ ...p, room: fitFloor(p.room) }));
    else if (a === 'std') setProject((p) => { const xs = p.room.nodes.map((n) => n.x), zs = p.room.nodes.map((n) => n.z); return { ...p, room: standardFloor(p.room, Math.min(0, ...xs), Math.min(0, ...zs)) }; });
    else setFloorDlg(a);
  };
  const [dlg304, setDlg304] = useState(null); // 30-40-50: { wallId, A, B, C }
  const [regionDlg, setRegionDlg] = useState(null);
  // Cara: el material cubre toda la cara (saca el de las franjas); Todo: todas las paredes.
  const applyMat = (target, matId, scope = 'cara') => setProject((p) => {
    let room = applyRoomMaterial(p.room, target, matId, scope);
    if (target.kind === 'wall' && room.stripFinishes) {
      if (scope === 'todo') room = { ...room, stripFinishes: {} };
      else { const { [target.wallId]: _x, ...rest } = room.stripFinishes; room = { ...room, stripFinishes: rest }; } // eslint-disable-line no-unused-vars
    }
    return { ...p, room };
  });
  // Material en una celda de franjas: Región (la celda), Perfil horizontal (fila) o vertical (columna).
  const applyStrip = (wallId, u, v, matId, scope) => setProject((p) => {
    const g = roomWalls(p.room).find((w) => w.id === wallId);
    if (!g) return p;
    const H = Math.max(g.wall.h0 ?? p.room.h, g.wall.h1 ?? p.room.h);
    const c = cellAt(stripsOf(p.room, wallId, g.len, H), g.len, H, u, v);
    return c ? { ...p, room: applyStripMaterial(p.room, wallId, g.len, H, c.id, matId, scope) } : p;
  });
  const wallHasStrips = (wallId) => {
    const g = roomWalls(project.room).find((w) => w.id === wallId);
    if (!g) return false;
    const s = stripsOf(project.room, wallId, g.len, Math.max(g.wall.h0 ?? project.room.h, g.wall.h1 ?? project.room.h));
    return s.h.length + s.v.length > 0;
  };
  const roomTarget = selectedWallId ? { kind: 'wall', wallId: selectedWallId } : selection?.kind === 'floor' ? { kind: 'floor' } : null;
  // Con Copiar material o Cambiar tonalidad activos, el clic en una superficie o módulo es de la herramienta.
  const roomToolClick = (t) => {
    if (!roomTool) return false;
    if (roomTool.kind === 'tint') {
      if (t.kind !== 'module') setProject((p) => {
        const has = t.kind === 'floor' ? finishesOf(p.room).floor : finishesOf(p.room).walls[t.wallId];
        const room = has ? p.room : applyRoomMaterial(p.room, t, 'pint-blanco');
        return { ...p, room: setFinishProps(room, t, { tint }) };
      });
      return true;
    }
    if (!roomTool.source) { setRoomTool({ kind: 'copy', source: t }); return true; }
    const s = roomTool.source;
    if (s.kind === 'module' && t.kind === 'module') {
      setProject((p) => { const src = p.modules.find((m) => m.id === s.id); return src ? { ...p, modules: p.modules.map((m) => (m.id === t.id ? { ...m, mats: { ...src.mats } } : m)) } : p; });
    } else if (s.kind !== 'module' && t.kind !== 'module') setProject((p) => ({ ...p, room: copyFinish(p.room, s, t) }));
    return true;
  };
  // Tamponamentos (Promob): tapas y laterales para los módulos seleccionados.
  const [tamponDlg, setTamponDlg] = useState(null);
  const [lightsDlg, setLightsDlg] = useState(false);
  const insertModules = (list) => {
    const mods = list.filter(Boolean).map((m) => ({ id: uid(), mats: {}, ...m }));
    if (!mods.length) return;
    setProject((p) => ({ ...p, modules: [...p.modules, ...mods] }));
    selectIds(mods.map((m) => m.id));
  };
  // Ítems lineales (tapa, estante): arrastrados sobre varios módulos, los cubren a todos.
  const LINEAR = { tapa: DEFAULT_TOP_ITEMS[0], estante: DEFAULT_TOP_ITEMS[2] };
  const linearRef = useRef(null); // ids de los módulos por los que pasó el arrastre
  const linearGhost = (e) => {
    const d = dragItemRef.current;
    if (!d || !LINEAR[d.item.type]) return null;
    const t = surfaceRef.current?.(e.clientX, e.clientY);
    const ids = linearRef.current || [];
    if (t?.kind === 'module' && !ids.includes(t.id)) {
      const m = project.modules.find((o) => o.id === t.id);
      const first = project.modules.find((o) => o.id === ids[0]);
      if (m && m.type !== 'tapa' && m.type !== 'estante' && (!first || (first.rot || 0) === (m.rot || 0))) linearRef.current = [...ids, t.id];
    }
    const mods = project.modules.filter((o) => (linearRef.current || []).includes(o.id));
    if (!mods.length) return null;
    const lin = linearItemFor(mods, LINEAR[d.item.type]);
    // conserva lo propio del ítem (p. ej. la tapa para bacha); las medidas son las de los módulos
    return { id: 'ghost', mats: {}, ...lin, params: { ...lin.params, ...(d.item.params || {}), width: lin.params.width, depth: lin.params.depth, height: lin.params.height } };
  };
  // Geometrías (Promob: Construir Geometria). El plano por defecto es el piso; clic derecho en una
  // pared o en un módulo (antes del primer punto) lo cambia.
  const selectedGeoId = selection?.kind === 'geometry' ? selection.id : null;
  const selectedGeo = (project.geometries || []).find((g) => g.id === selectedGeoId) || null;
  const [geoTool, setGeoTool] = useState(null); // { kind, plane, pts, cursor, opts }
  const [linealDlg, setLinealDlg] = useState(null);
  const [geoMsg, setGeoMsg] = useState(null);
  const [geoMenu, setGeoMenu] = useState(null); // clic derecho en una geometría: Perforar, Eliminar
  const startGeometry = (kind) => {
    stopDrawWalls(); stopAnnotate(); stopScale();
    const d = ui.geoDefaults || {};
    setGeoTool({ kind, plane: { kind: 'floor' }, pts: [], cursor: null, opts: { height: d.height ?? 150, offset: d.offset ?? 0, thickness: d.thickness ?? 18, incL: d.incL ?? 50, incA: d.incA ?? 5, sides: 6, arc: 360, base: 0 } });
  };
  const geoPlaneY = (plane) => (plane.kind === 'module' ? planeFrame({ plane }, project.room, project.modules)?.y || 0 : 0);
  const geoProject = (plane, cx, cy) => {
    if (plane.kind === 'wall') return surfaceRef.wallPoint?.(cx, cy, plane.wallId) || null;
    return pickRef.current?.(cx, cy, geoPlaneY(plane)) || null;
  };
  const geoData = (t, cursor) => { // figura según el tipo y los puntos (para la vista previa y para crearla)
    const p0 = t.pts[0], o = t.opts;
    if (t.kind === 'rect') return p0 && cursor ? { pts: rectPts(p0[0], p0[1], cursor[0], cursor[1]) } : null;
    if (t.kind === 'circ') return p0 && cursor ? { cx: p0[0], cy: p0[1], radius: Math.hypot(cursor[0] - p0[0], cursor[1] - p0[1]), arc: o.arc || 360, baseAngle: o.base || 0 } : null;
    if (t.kind === 'poly') return p0 && cursor ? { pts: regularPolygon(p0[0], p0[1], o.sides || 6, { circ: Math.hypot(cursor[0] - p0[0], cursor[1] - p0[1]) }), sides: o.sides || 6, radius: Math.hypot(cursor[0] - p0[0], cursor[1] - p0[1]) } : null;
    const pts = cursor ? [...t.pts, cursor] : t.pts;
    if (t.kind === 'lineal') return pts.length >= 2 ? { pts } : null;
    return pts.length >= 3 ? { pts } : null;
  };
  const geoOpts = (t) => ({ height: t.opts.height || 150, offset: t.opts.offset || 0, thickness: t.opts.thickness || 18 });
  const createGeometry = (t, data) => {
    if (t.opts.asDefault) setUi((u) => ({ ...u, geoDefaults: { height: t.opts.height, offset: t.opts.offset, thickness: t.opts.thickness, incL: t.opts.incL, incA: t.opts.incA } }));
    if (t.kind === 'lineal') { setLinealDlg({ t, data }); setGeoTool(null); return; }
    const g = newGeometry(t.kind, t.plane, data, geoOpts(t));
    setProject((p) => addGeometry(p, g));
    setSelection({ kind: 'geometry', id: g.id });
    setGeoTool(null);
  };
  const finishLineal = ({ align, color, segments, convert }) => {
    const { t, data } = linealDlg;
    setLinealDlg(null);
    const make = (pts) => ({ ...newGeometry('lineal', t.plane, { pts }, geoOpts(t)), align, color });
    const list = segments ? data.pts.slice(0, -1).map((p, i) => make([p, data.pts[i + 1]])) : [make(data.pts)];
    if (convert) {
      const out = list.map((g) => convertGeometry(g, convert));
      const bad = out.find((r) => r.error);
      if (bad) { setGeoMsg(bad.error); }
      else { insertModules(out.map((r) => ({ ...r.module, params: { ...(MODULE_TYPES[r.module.type]?.defaults || {}), ...r.module.params } }))); return; }
    }
    setProject((p) => list.reduce(addGeometry, p));
    setSelection({ kind: 'geometry', id: list[0].id });
  };
  const geoClick = (cx, cy) => {
    const t = geoTool;
    const p = geoProject(t.plane, cx, cy);
    if (!p) return;
    if (t.kind === 'libre' || t.kind === 'lineal') {
      if (t.kind === 'libre' && t.pts.length >= 3 && Math.hypot(p[0] - t.pts[0][0], p[1] - t.pts[0][1]) < 60) { createGeometry(t, { pts: t.pts }); return; }
      const q = t.pts.length ? snapSegment(t.pts.at(-1), p, t.opts.incL || 1, t.opts.incA || 1).point : p;
      setGeoTool({ ...t, pts: [...t.pts, q] });
      return;
    }
    if (!t.pts.length) { setGeoTool({ ...t, pts: [p] }); return; }
    const data = geoData(t, p);
    if (data) createGeometry(t, data);
  };
  const geoEnter = () => {
    const t = geoTool;
    if (!t) return;
    const o = t.opts, p0 = t.pts[0];
    if ((t.kind === 'libre' || t.kind === 'lineal') && t.pts.length && o.len) {
      setGeoTool({ ...t, pts: [...t.pts, nextPoint(t.pts.at(-1), o.len, o.ang || 0)], opts: { ...o, len: null } });
    } else if (t.kind === 'rect' && p0 && o.w && o.d) createGeometry(t, { pts: rectPts(p0[0], p0[1], p0[0] + o.w, p0[1] + o.d) });
    else if ((t.kind === 'circ' || t.kind === 'poly') && p0 && o.r) createGeometry(t, geoData(t, [p0[0] + o.r, p0[1]]));
  };
  const geoFinish = () => {
    const t = geoTool;
    if (t && (t.kind === 'libre' ? t.pts.length >= 3 : t.kind === 'lineal' && t.pts.length >= 2)) createGeometry(t, { pts: t.pts });
  };
  const geoOverlay = geoTool ? {
    onContextMenu: (e) => {
      e.preventDefault();
      if (!geoTool.pts.length) { // clic derecho: elegir el plano de construcción
        const s = surfaceRef.current?.(e.clientX, e.clientY);
        const plane = s?.kind === 'wall' ? { kind: 'wall', wallId: s.wallId } : s?.kind === 'module' ? { kind: 'module', id: s.id } : { kind: 'floor' };
        setGeoTool({ ...geoTool, plane });
      } else geoFinish();
    },
    onPointerMove: (e) => { const c = geoProject(geoTool.plane, e.clientX, e.clientY); if (c) setGeoTool((t) => (t ? { ...t, cursor: c } : t)); },
    onPointerDown: (e) => { if (e.button === 0) geoClick(e.clientX, e.clientY); },
  } : null;
  const geoDraft = geoTool && geoTool.cursor ? (() => {
    const d = geoData(geoTool, geoTool.cursor);
    return d ? { ...newGeometry(geoTool.kind, geoTool.plane, d, geoOpts(geoTool)), id: 'draft' } : null;
  })() : null;
  const onMoveGeometry = useCallback((id, x, z) => setProject((p) => {
    const g = (p.geometries || []).find((o) => o.id === id);
    if (!g) return p;
    const b = boundsOf(outlineOf(g));
    if (b.x0 === x && b.y0 === z) return p;
    return updateGeometry(p, id, moveGeometry(g, x - b.x0, z - b.y0));
  }), [setProject]);
  const vpDrag = {
    onDragOver: (e) => {
      if (e.dataTransfer?.types?.includes('text/x-room-mat')) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; return; }
      if (!dragItemRef.current) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      const lin = linearGhost(e);
      if (lin) { setGhost((g) => (g && g.x === lin.x && g.z === lin.z && g.params.width === lin.params.width ? g : lin)); return; }
      const m = ghostAt(e.clientX, e.clientY);
      setGhost((g) => (m && g && g.x === m.x && g.z === m.z && g.rot === m.rot ? g : m));
    },
    onDragLeave: (e) => { if (!e.currentTarget.contains(e.relatedTarget)) { setGhost(null); linearRef.current = null; } },
    onDrop: (e) => {
      const matId = e.dataTransfer?.getData?.('text/x-room-mat');
      if (matId) {
        e.preventDefault();
        const t = surfaceRef.current?.(e.clientX, e.clientY);
        if (t?.kind === 'floor') applyMat(t, matId);
        else if (t?.kind === 'region') setProject((p) => ({ ...p, room: updateRegion(p.room, t.id, { finish: { mat: matId } }) }));
        else if (t?.kind === 'geometry') setProject((p) => updateGeometry(p, t.id, { finish: { mat: matId, scaleX: 1, scaleY: 1, rot: 0 } }));
        else if (t?.kind === 'wall') setMatMenu({ matId, wallId: t.wallId, u: t.u, v: t.v, strips: wallHasStrips(t.wallId), x: e.clientX, y: e.clientY });
        return;
      }
      const d = dragItemRef.current;
      if (!d) return;
      e.preventDefault();
      const lin = linearGhost(e);
      linearRef.current = null;
      if (lin) { // cubre los módulos por los que pasó (ajusta sus medidas a ellos)
        dragItemRef.current = null;
        setGhost(null);
        countUse(d.item);
        const { id: _g, ...mod } = lin; // eslint-disable-line no-unused-vars
        insertModules([withItem({ ...mod, id: uid() }, d.item, project.modules)].map((m) => ({ ...m, rest: undefined })));
        return;
      }
      const m = ghostAt(e.clientX, e.clientY);
      dragItemRef.current = null;
      setGhost(null);
      if (!m) return;
      if (d.item.compose) { countUse(d.item); insertModules(composeAt(d.item, m)); return; }
      if (d.item.favorite) { countUse(d.item); insertModules(placeFavorite(d.item.favorite, { x: m.x, z: m.z, y: m.y, rot: m.rot }, uid)); return; }
      const mod = withAutoInsert(withItem({ ...m, id: uid() }, d.item, project.modules), project, (x) => resolveRules(x, project));
      countUse(d.item);
      setProject((p) => ({ ...p, modules: [...p.modules, mod] }));
      setSelectedId(mod.id);
    },
  };
  // Sustitución rápida (S / Ctrl+Shift+K): el ítem marcado en la barra reemplaza a lo seleccionado.
  const [picked, setPicked] = useState(null); // { item, variant }
  const replaceSelected = () => {
    if (!picked || !selectedIds.length) return;
    const { item, variant } = picked;
    setProject((p) => ({
      ...p,
      modules: p.modules.map((m) => {
        if (!selectedIds.includes(m.id)) return m;
        const fresh = withAutoInsert(withItem(newModule(item.type, p, itemParams(item, variant), item.y), item, p.modules), p, (x) => resolveRules(x, p));
        return replaceModule(m, fresh);
      }),
    }));
    countUse(item);
  };
  // Ubicar en el catálogo (Ctrl+Shift+L): la barra de modulación va al ítem del módulo seleccionado.
  const locateSelected = () => {
    const m = project.modules.find((o) => o.id === selectedId);
    const hit = m && findItemForModule(m);
    if (hit) setUi((u) => ({ ...u, catalogPath: [...hit.path, hit.item.id] }));
  };
  // Composición: los módulos del conjunto, corridos a lo ancho desde la posición del primero, agrupados.
  const composeAt = (item, base) => {
    const gid = `g${uid()}`;
    return item.compose.map((c) => {
      const m = newModule(c.type, project, c.params, c.y ?? MODULE_TYPES[c.type].y);
      const { ex } = localAxes(base.rot || 0);
      return { ...m, x: Math.round(base.x + ex[0] * c.dx), z: Math.round(base.z + ex[1] * c.dx), rot: base.rot || 0, groupId: gid };
    });
  };
  // Orientación de inserción (placas) y Dirección de inserción (al lado del seleccionado).
  const oriented = (item, variant) => {
    const o = orientItem(item.type, { ...(MODULE_TYPES[item.type]?.defaults || {}), ...itemParams(item, variant) }, ui.insertOrient || '');
    return o.type === item.type && !ui.insertOrient ? { type: item.type, params: itemParams(item, variant), y: item.y } : { type: o.type, params: o.params, y: item.y };
  };
  const insertItem = (item, variant = null) => {
    if (item.favorite) { // el conjunto guardado, en la posición libre de su primer módulo
      countUse(item);
      const m0 = item.favorite.modules[0];
      const b = newModule(m0.type, project, m0.params, item.favorite.y0);
      insertModules(placeFavorite(item.favorite, { x: b.x, z: b.z, y: item.favorite.y0, rot: 0 }, uid));
      setTab('diseno');
      return;
    }
    const base = ui.insertDir && project.modules.find((o) => o.id === selectedId);
    if (base && !item.compose) {
      countUse(item);
      const o = oriented(item, variant);
      const fresh = withItem(newModule(o.type, project, o.params, o.y), item, project.modules);
      const m = withAutoInsert(placeRelative(base, fresh, ui.insertDir), project, (x) => resolveRules(x, project));
      setProject((p) => ({ ...p, modules: [...p.modules, m] }));
      setSelectedId(m.id);
      setTab('diseno');
      return;
    }
    if (item.compose) { countUse(item); const base = newModule(item.compose[0].type, project, item.compose[0].params); insertModules(composeAt(item, base)); setTab('diseno'); return; }
    countUse(item);
    const o = oriented(item, variant);
    const m = withAutoInsert(withItem(newModule(o.type, project, o.params, o.y), item, project.modules), project, (x) => resolveRules(x, project));
    setProject((p) => ({ ...p, modules: [...p.modules, m] }));
    setSelectedId(m.id);
    setTab('diseno');
  };
  const deleteSelected = () => {
    if (!selectedId) return;
    setProject((p) => pruneGroups(removeModules(p, selectedIds)));
    setSelectedId(null);
  };
  // Duplicar (Ctrl+D): la primera vez pregunta el desplazamiento (ventana Reposicionar) y lo recuerda.
  const [dupOffset, setDupOffset] = useState(null);
  const [reposDlg, setReposDlg] = useState(null);
  const selectedMods = () => project.modules.filter((m) => selectedIds.includes(m.id));
  const duplicateWith = (offset) => {
    const mods = selectedMods();
    if (!mods.length) return;
    const r = pasteModules(project, mods, offset);
    setProject(r.project);
    selectIds(r.ids);
  };
  const duplicateSelected = (ask = false) => {
    if (!selectedIds.length) return;
    if (dupOffset && !ask) { duplicateWith(dupOffset); return; }
    setReposDlg({ initial: dupOffset || sideOffset(selectedMods()) });
  };
  // Copiar / Cortar / Pegar (Ctrl+C / Ctrl+X / Ctrl+V). Pegar deja la copia al lado de lo copiado
  // (o en el mismo lugar si se cortó), y cada pegado siguiente se corre otro tanto.
  const clipRef = useRef(null);
  const copySelected = (cut = false) => {
    const mods = selectedMods();
    if (!mods.length) return;
    clipRef.current = { mods: JSON.parse(JSON.stringify(mods)), n: cut ? 0 : 1, step: sideOffset(mods) };
    if (cut) { setProject((p) => pruneGroups(removeModules(p, selectedIds))); setSelectedId(null); }
  };
  const pasteClipboard = () => {
    const c = clipRef.current;
    if (!c) return;
    const r = pasteModules(project, c.mods, { dx: c.step.dx * c.n, dz: 0, dy: 0 });
    c.n += 1;
    setProject(r.project);
    selectIds(r.ids);
  };
  const rotateSelected = () => rotateBy(90);

  useEffect(() => {
    const onKey = (e0) => {
      const inField = ['INPUT', 'SELECT', 'TEXTAREA'].includes(e0.target.tagName);
      // Configurar atajos: una combinación propia actúa como la de por defecto de su acción
      const rm = inField ? { kind: 'pass' } : remapEvent(e0, ui.shortcuts);
      if (rm.kind === 'block') return;
      const e = rm.kind === 'as' ? { ...rm.init, target: e0.target, preventDefault: () => e0.preventDefault(), stopPropagation: () => e0.stopPropagation() } : e0;
      if ((e.ctrlKey || e.metaKey) && !inField) {
        const k = e.key.toLowerCase();
        if (k === 'z' && !e.shiftKey) { e.preventDefault(); history.undo(); return; }
        if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); history.redo(); return; }
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'p') { e.preventDefault(); startDrawWalls(); return; }
      if (e.key === 'F8' && tab === 'diseno') { e.preventDefault(); toggleOrtho(); return; } // Ortogonal / Perspectiva
      if (e.key === 'F6' && tab === 'diseno') { e.preventDefault(); navRef.current?.fitAll(); return; } // Zoom total
      if (e.key === 'F10' && tab === 'diseno') { e.preventDefault(); setFill(e.ctrlKey ? (fill === 'presentacion' ? 'texturas' : 'presentacion') : nextFillMode(fill)); return; }
      if ((e.key === 'F5' || e.key === 'F7') && tab === 'diseno') { e.preventDefault(); if (selectedIds.length) navRef.current?.fitModules(selectedIds); return; } // Zoom total entidad
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'l' && tab === 'diseno' && !inField) { e.preventDefault(); locateSelected(); return; }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'k' && tab === 'diseno' && !inField) { e.preventDefault(); replaceSelected(); return; }
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'l' && tab === 'diseno') { e.preventDefault(); setQuickFind(true); return; }
      if (tab !== 'diseno' || inField) return;
      const plain = !e.ctrlKey && !e.metaKey && !e.altKey;
      const key = e.key.toLowerCase();
      if (plain && key === 'b') { toggleUi('collision'); return; }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && key === 'm') { e.preventDefault(); setTool('movimiento'); return; }
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && key === 'd') { e.preventDefault(); duplicateSelected(); return; }
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && key === 'c') { e.preventDefault(); copySelected(false); return; } // Copiar
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && key === 'x') { e.preventDefault(); copySelected(true); return; } // Cortar
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && key === 'v') { e.preventDefault(); pasteClipboard(); return; } // Pegar
      if (plain && key === 'e') { setTool('propiedades'); return; }
      if (plain && key === 'a') { setTool('agregados'); return; } // Agregados
      if (plain && key === 'o' && selectedId) { setProject((p) => toggleHidden(p, selectedIds)); return; } // visible / oculto
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && key === 't') { e.preventDefault(); selectIds(selectAllIds(project)); return; } // Seleccionar todo
      if (plain && key === 'u') { groupSelected(); return; } // Agrupar
      if (plain && key === 's') { replaceSelected(); return; } // Sustituir
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && key === 'u') { e.preventDefault(); ungroupSelected(); return; } // Desagrupar
      if (plain && key === 'x') { setAxisLock((l) => (l === 'x' ? null : 'x')); return; }
      if (plain && key === 'y') { setAxisLock((l) => (l === 'z' ? null : 'z')); return; }
      if (plain && key === 'm') { stopDrawWalls(); stopAnnotate(); stopScale(); setNavTool('select'); setRoomTool(null); return; } // Seleccionar / Mover
      if (plain && key === 'p') { navToggle('pan'); return; } // Pan
      if (plain && key === 'z') { navToggle('zoom'); return; } // Zoom
      if (plain && key === 'w') { navToggle('zoomWin'); return; } // Zoom Ventana
      if (plain && key === 'c' && view.name !== 'planta' && !view.ortho) { navToggle('walk'); return; } // Caminar (solo perspectiva)
      if (plain && key === 'h') { navToggle('hotpoint'); return; } // Mover HotPoint: curvar paredes
      if (plain && key === 'd' && !drawing && !annotating && !scaling) { startAnnotate(); return; } // calcular distancia
      if (annotating) { if (e.key === 'Escape') stopAnnotate(); return; }
      if (scaling) {
        if (e.key === 'Escape') stopScale();
        else if (scaling.points.length === 2 && /^[0-9.,]$/.test(e.key)) { e.preventDefault(); setScaleLen((v) => v + e.key); scaleRef.current?.focus(); }
        else if (scaling.points.length === 2 && e.key === 'Enter') applyScale();
        return;
      }
      if (geoTool) {
        if (e.key === 'Escape') setGeoTool(null);
        else if (e.key === 'Enter') geoEnter();
        else if (/^[0-9]$/.test(e.key)) { // los números van al primer campo (largo, ancho o radio), como en Promob
          e.preventDefault();
          const k = geoTool.kind === 'rect' ? 'w' : geoTool.kind === 'circ' || geoTool.kind === 'poly' ? 'r' : 'len';
          setGeoTool((t) => ({ ...t, opts: { ...t.opts, [k]: Number(String(t.opts[k] ?? '') + e.key) } }));
          setTimeout(() => document.querySelector(`.geo-hud .gh-${k}`)?.focus(), 0);
        }
        return;
      }
      if (selectedGeoId && (e.key === 'Delete' || e.key === 'Backspace')) { e.preventDefault(); setProject((p) => removeGeometry(p, selectedGeoId)); setSelection(null); return; }
      if (selectedDimId && (e.key === 'Delete' || e.key === 'Backspace')) { e.preventDefault(); setProject((p) => removeAnnotation(p, selectedDimId)); setSelection(null); return; }
      if (drawing) { // los números van directo al largo, como en Promob
        if (e.key === 'Escape') stopDrawWalls();
        else if (/^[0-9.,]$/.test(e.key)) { e.preventDefault(); setDrawLen((s) => s + e.key); lenRef.current?.focus(); }
        else if (e.key === 'Enter') commitTyped();
        return;
      }
      if (e.key === 'Escape') { setSelectedId(null); setNavTool('select'); setRoomTool(null); setJoinTool(null); }
      if (selectedWallId && (e.key === 'Delete' || e.key === 'Backspace')) { e.preventDefault(); setDeleteDlg({ wallId: selectedWallId }); return; }
      if ((selectedOpeningId || selectedColumnId) && (e.key === 'Delete' || e.key === 'Backspace')) {
        e.preventDefault();
        setProject((p) => ({ ...p, room: selectedOpeningId ? removeOpening(p.room, selectedOpeningId) : removeColumn(p.room, selectedColumnId) }));
        setSelection(null);
        return;
      }
      if (!selectedId) return;
      // Ctrl+flechas: hasta el obstáculo más cercano; Ctrl+Inicio: centrar a lo ancho (Promob).
      const EXT = { ArrowRight: '+x', ArrowLeft: '-x', ArrowUp: '-z', ArrowDown: '+z' };
      if ((e.ctrlKey || e.metaKey) && (EXT[e.key] || e.key === 'Home')) {
        e.preventDefault();
        setProject((p) => ({
          ...p,
          modules: p.modules.map((m) => {
            if (m.id !== selectedId) return m;
            const pos = e.key === 'Home' ? centerX(m, p.room, p.modules) : toExtreme(m, p.room, p.modules, EXT[e.key]);
            return { ...m, ...pos };
          }),
        }));
        return;
      }
      if (plain && key === 'i') { // Invertir: espeja el módulo (lado del esquinero, bisagras)
        setProject((p) => ({ ...p, modules: p.modules.map((m) => (selectedIds.includes(m.id) ? invertModule(m, builtById.get(m.id) ? frontsOf(builtById.get(m.id)) : []) : m)) }));
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSelected(); }
      else if (e.key === 'r' || e.key === 'R') rotateSelected();
      else if (e.key === 'PageUp' || e.key === 'PageDown') { e.preventDefault(); nudgeSelected('h', e.key === 'PageUp' ? 1 : -1, e.shiftKey ? 100 : 10); }
      else if (e.key.startsWith('Arrow')) {
        e.preventDefault();
        const st = e.shiftKey ? 100 : 10;
        const dx = e.key === 'ArrowLeft' ? -st : e.key === 'ArrowRight' ? st : 0;
        const dz = e.key === 'ArrowUp' ? -st : e.key === 'ArrowDown' ? st : 0;
        if (multiSel) { setProject((p) => moveGroup(p, selectedIds, dx, dz, { collision: ui.collision !== false })); return; }
        setProject((p) => { const m = p.modules.find((o) => o.id === selectedId); return m ? placeModule(p, selectedId, m.x + dx, m.z + dz, false) : p; });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Shift + mover el mouse sobre la vista: gira el módulo seleccionado (Promob). Todo el giro
  // es un paso de deshacer.
  const shiftRot = useRef(null);
  useEffect(() => {
    const onMoveMouse = (e) => {
      const s = shiftRot.current;
      if (!e.shiftKey || !selectedId || multiSel || drawing || annotating || e.buttons) { if (s) { shiftRot.current = null; history.commit(); } return; }
      if (!vpRef.current?.contains(e.target)) return;
      if (!s) {
        const m0 = project.modules.find((m) => m.id === selectedId);
        if (!m0) return;
        shiftRot.current = { x0: e.clientX, m0 };
        history.begin();
        return;
      }
      const rot = shiftRotation(s.m0.rot || 0, e.clientX - s.x0);
      setProject((p) => ({ ...p, modules: p.modules.map((m) => (m.id === s.m0.id ? { ...m, ...rotateAboutCenter(s.m0, rot - (s.m0.rot || 0)) } : m)) }));
    };
    const onUp = (e) => { if (e.key === 'Shift' && shiftRot.current) { shiftRot.current = null; history.commit(); } };
    window.addEventListener('mousemove', onMoveMouse);
    window.addEventListener('keyup', onUp);
    return () => { window.removeEventListener('mousemove', onMoveMouse); window.removeEventListener('keyup', onUp); };
  });

  // Tamaño de la vista 3D (Ambiente 3D y área del render).
  useEffect(() => {
    const el = vpRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => setVpSize({ width: Math.round(el.clientWidth), height: Math.round(el.clientHeight) }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [tab]);
  const renderCfg = useMemo(() => normalizeRender(project.render), [project.render]);
  const renderOut = renderSize(renderCfg, vpSize);
  const startRender = () => {
    if (!renderRef.current) return;
    setSelectedId(null);
    setRenderDlg(false);
    setRenderJob({ size: renderOut, quality: qualityOf(renderCfg), rig: lightRig(renderCfg.clima), background: renderCfg.background, watermark, panorama: renderCfg.panorama.on ? renderCfg.panorama : null });
  };

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
  const newProject = () => { if (window.confirm('¿Empezar un proyecto vacío? (exportá el actual si lo querés guardar)')) { setProject(applyPrefsToNewProject(emptyProject(), prefs)); setSelectedId(null); recenter(); } };

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
          <button onClick={() => setPrefsOpen(true)} title="Preferencias y atajos">Preferencias</button>
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
            <button className={`side-tab${side === 'materiales' ? ' on' : ''}`} onClick={() => setSide('materiales')}>Materiales</button>
          </div>
          {side === 'auto' && (
            <AutoInsertPanel autoInsert={project.autoInsert} hasSelection={!!selectedId}
              onAutoInsert={(ai) => setProject((p) => ({ ...p, autoInsert: ai }))}
              onAmbiente={(cat, ids, on, onlySel) => setProject((p) => applyAuto(p, cat, ids, on, (m) => resolveRules(m, p), onlySel ? (selectedId ? [selectedId] : []) : null))} />
          )}
          {side === 'materiales' && (
            <MaterialsPanel favs={ui.matFavs || []} onFav={(id) => setUi((u) => ({ ...u, matFavs: (u.matFavs || []).includes(id) ? u.matFavs.filter((x) => x !== id) : [...(u.matFavs || []), id] }))}
              target={roomTarget} onApply={(id) => roomTarget && applyMat(roomTarget, id)} tool={roomTool} onTool={setRoomTool} tint={tint} onTint={setTint}
              onStrips={selectedWallId ? () => setStripDlg({ wallId: selectedWallId }) : null}
              onRegions={roomTarget ? () => setRegionDlg({ surface: roomTarget }) : null} />
          )}
          {side === 'lista' && (
            <ModuleList project={project} selectedIds={selectedIds} onSelect={(id, add) => (add ? toggleSelect(id) : selectModule(id))}
              onToggleHidden={(ids) => setProject((p) => toggleHidden(p, ids))}
              onRemove={(ids) => { setProject((p) => removeModules(p, ids)); setSelectedId(null); }} />
          )}
          <section className="viewport">
            <CatalogBar favorites={favorites}
              onRemoveFavorite={(id) => setUi((u) => ({ ...u, favorites: removeFavorite(u.favorites || [], id) }))}
              onExportFavorites={() => download('favoritos.mueblesapp.json', new Blob([exportFavorites(favorites)], { type: 'application/json' }))}
              onImportFavorites={(text) => { const r = importFavorites(text, favorites); if (r.error) setFavMsg(r.error); else { setUi((u) => ({ ...u, favorites: r.list })); setFavMsg(`Se importaron ${r.added} favorito${r.added === 1 ? '' : 's'}.`); } }}
              nav={ui.catalogPath} setNav={(p) => setUi((u) => ({ ...u, catalogPath: p }))} counts={ui.catalogUse} onInsert={insertItem} thumbCtx={thumbCtx}
              onDragItem={(item, variant) => { dragItemRef.current = item ? { item, variant } : null; if (!item) setGhost(null); }}
              onFind={() => setQuickFind(true)} onPick={(item, variant) => setPicked({ item, variant })}
              onReplace={replaceSelected} canReplace={!!picked && selectedIds.length > 0} />
            {quickFind && <QuickFind thumbCtx={thumbCtx} onClose={() => setQuickFind(false)} onInsert={insertItem}
              onShow={(path, item) => setUi((u) => ({ ...u, catalogPath: [...path, item.id] }))} />}
            <div className="vp-toolbar">
              {[['perspectiva', 'Perspectiva'], ['frente', 'Frente'], ['planta', 'Planta']].map(([k, l]) => (
                <button key={k} className={view.name === k ? 'active-soft' : ''} onClick={() => goView({ name: k })}>{l}</button>
              ))}
              <select className="vp-views" value={VIEWS.some((x) => x.id === view.name) ? view.name : ''} title="Vistas"
                onChange={(e) => e.target.value && goView({ name: e.target.value })}>
                {!VIEWS.some((x) => x.id === view.name) && <option value="">{view.name === 'pared' ? `Pared ${project.room.walls.findIndex((w) => w.id === view.wallId) + 1}` : 'Vistas'}</option>}
                {VIEWS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
              </select>
              <button onClick={viewBack} disabled={!viewHist.back.length} title="Volver vista" aria-label="Volver vista">◁</button>
              <button onClick={viewFwd} disabled={!viewHist.fwd.length} title="Avanzar vista" aria-label="Avanzar vista">▷</button>
              <button className={view.ortho ? 'active-soft' : ''} disabled={view.name === 'planta'} onClick={toggleOrtho} title="Ortogonal / Perspectiva (F8)">Ortogonal</button>
              <select className="vp-fill" value={fill} onChange={(e) => setFill(e.target.value)} title="Modo de relleno (F10: el siguiente; Ctrl+F10: Presentación)">
                {FILL_MODES.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
              <span className="sep" />
              <button className={`nav-tool${navTool === 'pan' ? ' active' : ''}`} onClick={() => navToggle('pan')} title="Pan (P): arrastrar mueve la vista">Pan</button>
              <button className={`nav-tool${navTool === 'zoom' ? ' active' : ''}`} onClick={() => navToggle('zoom')} title="Zoom (Z): arrastrar arriba acerca, abajo aleja">Zoom</button>
              <button className={`nav-tool${navTool === 'zoomWin' ? ' active' : ''}`} onClick={() => navToggle('zoomWin')} title="Zoom Ventana (W): marcá un recuadro">Zoom ventana</button>
              <button onClick={() => navRef.current?.fitAll()} title="Zoom Total (F6)">Zoom total</button>
              <button disabled={!selectedIds.length} onClick={() => navRef.current?.fitModules(selectedIds)} title="Zoom Total Entidad (F7): encuadra lo seleccionado">Zoom selección</button>
              <button className={`nav-tool${navTool === 'hotpoint' ? ' active' : ''}`} onClick={() => navToggle('hotpoint')} title="Mover HotPoint (H): arrastrá el punto verde de una pared para curvarla">HotPoint</button>
              <button className={`nav-tool${navTool === 'walk' ? ' active' : ''}`} disabled={view.name === 'planta' || view.ortho} onClick={() => navToggle('walk')} title="Caminar (C): arrastrar arriba/abajo avanza o retrocede; a los costados gira. Solo en perspectiva.">Caminar</button>
              <button className={drawing ? 'active' : ''} onClick={() => (drawing ? stopDrawWalls() : startDrawWalls())} title="Construir paredes (Ctrl+Shift+P)">✏ Paredes</button>
              <button className={annotating ? 'active' : ''} onClick={() => (annotating ? stopAnnotate() : startAnnotate())} title="Cota manual: lineal o angular">↔ Cota</button>
              <select className="vp-insert-dir" value={ui.insertDir || ''} title="Dirección de inserción: el ítem nuevo (clic en el catálogo) va pegado al módulo seleccionado"
                onChange={(e) => setUi((u) => ({ ...u, insertDir: e.target.value || null }))}>
                <option value="">Inserción: libre</option>
                {INSERT_DIRECTIONS.map(([k, l]) => <option key={k} value={k}>Inserción: {l.toLowerCase()}</option>)}
              </select>
              <select className="vp-insert-orient" value={ui.insertOrient || ''} title="Orientación de inserción de placas (estantes, laterales, paneles)"
                onChange={(e) => setUi((u) => ({ ...u, insertOrient: e.target.value || null }))}>
                {INSERT_ORIENTATIONS.map(([k, l]) => <option key={k} value={k}>Orientación: {l.toLowerCase()}</option>)}
              </select>
              <select className="vp-import" value="" title="Importar planta DXF o modelo 3D" onChange={(e) => { const v = e.target.value; if (v === 'dxf') dxfInput.current?.click(); else if (v === '3d') modelInput.current?.click(); else if (v === 'list') setImportsOpen(true); }}>
                <option value="">Importar…</option>
                <option value="dxf">Planta DXF…</option>
                <option value="3d">Modelo 3D (OBJ, STL, GLB)…</option>
                <option value="list">Ver importados</option>
              </select>
              <input ref={dxfInput} type="file" accept=".dxf" hidden onChange={(e) => { onDxfFile(e.target.files?.[0]); e.target.value = ''; }} />
              <input ref={modelInput} type="file" accept=".obj,.stl,.glb,.gltf" hidden onChange={(e) => { onModelFile(e.target.files?.[0]); e.target.value = ''; }} />
              <select className="vp-geometry" value={geoTool?.kind || ''} title="Construir geometría" onChange={(e) => (e.target.value ? startGeometry(e.target.value) : setGeoTool(null))}>
                <option value="">Geometría…</option>
                {GEOMETRY_KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
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
              <button className={renderMode ? 'active' : ''} onClick={() => { setRenderMode((r) => !r); setSelectedId(null); }}
                title="Vista previa con la luz del render">
                {renderMode ? '✓ Modo render' : 'Modo render'}
              </button>
              <button className={lightsDlg ? 'active' : ''} onClick={() => setLightsDlg((o) => !o)} title="Editor de luces: luminarias, color, intensidad, apertura">Luces…</button>
              <button className={renderDlg ? 'active' : ''} onClick={() => { setRenderDlg((o) => !o); setSelectedId(null); }}
                title="Configuración del render: calidad, dimensión, clima, fondo, marca de agua">Renderizar…</button>
              <button onClick={exportImage} title="Exportar imagen (PNG)">⤓</button>
            </div>
            <div className="vp-area" ref={vpRef} {...vpDrag}>
            <ErrorBoundary onReset={() => { setRenderJob(null); setRenderDlg(false); setRenderMode(false); }}>
              <Scene3D project={project} builtById={builtById} selectedId={selectedId} selectedIds={selectedIds} onSelect={(id) => { if (!(id && roomToolClick({ kind: 'module', id }))) selectModule(id); }} onToggleSelect={toggleSelect} onMove={onMove}
                selectedWallId={selectedWallId} onSelectWall={(id) => {
                  if (joinTool && id && id !== joinTool.movingId) { setProject((p) => ({ ...p, room: joinWalls(p.room, joinTool.movingId, id, joinTool.mode) })); setJoinTool(null); return; }
                  if (!(id && roomToolClick({ kind: 'wall', wallId: id }))) selectWall(id);
                }}
                onMoveWall={onMoveWall} onMoveNode={onMoveNode} onResize={onResize} step={gridStep}
                onDimEdit={onDimEdit} onWallLength={onWallLength} onWallAngle={onWallAngle}
                onDragStart={onDragStart} onDragEnd={history.commit}
                drawing={drawing} drawCursorRef={drawCursorRef} onDrawPoint={onDrawPoint} onDrawFinish={stopDrawWalls}
                onWallContext={onWallContext} onModuleContext={(m) => setModMenu({ ...m, detached: !!project.modules.find((o) => o.id === m.id)?.detached })}
                annotating={annTool} onAnnotatePoint={annotating ? onAnnotatePoint : onScalePoint} onAnnotateFinish={annotating ? stopAnnotate : stopScale}
                selectedDimId={selectedDimId} onSelectDim={selectDim}
                onRestoreWall={(id) => setProject((p) => ({ ...p, room: updateWall(p.room, id, { lowered: false }) }))}
                selectedOpeningId={selectedOpeningId} onSelectOpening={selectOpening} onMoveOpening={onMoveOpening} onOpeningDim={onOpeningDim}
                selectedColumnId={selectedColumnId} onSelectColumn={selectColumn} onMoveColumn={onMoveColumn}
                onWallDouble={(id) => goView({ name: 'pared', wallId: id })} onFloorDouble={() => goView({ name: 'planta' })}
                navTool={navTool} navRef={navRef} surfaceRef={surfaceRef}
                onFloorMenu={(ev) => setFloorMenu({ x: ev.clientX, y: ev.clientY })}
                rulersOf={ui.showRulers ? (w) => wallRulers(w, groupsR) : null}
                onChangePlane={onChangePlane}
                bg={prefs.bg} lightK={prefs.light} show={show}
                onMoveHotpoint={(id, x, z) => setProject((p) => {
                  const g = roomWalls(p.room).find((w) => w.id === id);
                  if (!g) return p;
                  const s = Math.max(-g.len / 2, Math.min(g.len / 2, Math.round(sagittaFromPoint(g.a, g.b, g.n, [x, z]) / 10) * 10));
                  return Math.abs(s) < 20 && !g.wall.flecha ? p : { ...p, room: updateWall(p.room, id, { flecha: Math.abs(s) < 20 ? 0 : s }) };
                })}
                selectedGeoId={selectedGeoId} onSelectGeometry={(id) => setSelection({ kind: 'geometry', id })} onMoveGeometry={onMoveGeometry} geoDraft={geoDraft}
                onGeometryMenu={(g, ev) => setGeoMenu({ id: g.id, x: ev.clientX, y: ev.clientY })}
                onFloorDown={side === 'materiales' || roomTool ? () => { if (!roomToolClick({ kind: 'floor' })) setSelection({ kind: 'floor' }); } : null}
                renderMode={renderMode || renderDlg || !!renderJob || fill === 'presentacion'} renderRef={renderRef} fill={fill === 'presentacion' ? 'texturas' : fill}
                view={view} captureRef={captureRef} showDims={showDims} autoHideWalls={autoLower && !renderJob?.panorama} pickRef={pickRef} ghost={ghost}
                openFronts={openFronts} onToggleFront={toggleFront} />
            </ErrorBoundary>
            {drawing && (
              <DrawHud draw={drawing} len={drawLen} setLen={setDrawLen} ang={drawAng} setAng={setDrawAng} lenRef={lenRef} angRef={angRef}
                lock={drawLock} onLock={setDrawLock} walls={roomWalls(project.room)} onReference={startFromReference}
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
            {(renderMode || renderDlg) && renderCfg.showArea && !renderCfg.panorama.on && <RenderArea rect={fitRect(renderOut.width / renderOut.height, vpSize.width, vpSize.height)} size={renderOut} watermark={watermark} />}
            {renderDlg && (
              <RenderDialog config={renderCfg} view={vpSize} onClose={() => setRenderDlg(false)}
                onChange={(fn) => setProject((p) => ({ ...p, render: normalizeRender(fn(normalizeRender(p.render))) }))}
                onRender={startRender} onBegin={history.begin} onEnd={history.commit}
                watermark={watermark} onWatermark={(patch) => setWatermark((w) => normalizeWatermark({ ...normalizeWatermark(w), ...patch }))} />
            )}
            {renderJob && <RenderWindow bridge={renderRef.current} size={renderJob.size} quality={renderJob.quality} rig={renderJob.rig} background={renderJob.background} watermark={renderJob.watermark} panorama={renderJob.panorama}
              fileName={`${project.name || 'render'}${renderJob.panorama ? '-360' : ''}.png`} onClose={() => setRenderJob(null)} />}
            {reposDlg && <ReposicionarDialog initial={reposDlg.initial} onCancel={() => setReposDlg(null)}
              onOk={(o) => { setReposDlg(null); setDupOffset(o); duplicateWith(o); }} />}
            {geoOverlay && <div className="nav-overlay geo-overlay" {...geoOverlay} />}
            {geoTool && <GeometryHud tool={geoTool} onTool={setGeoTool} onEnter={geoEnter} onFinish={geoFinish} onCancel={() => setGeoTool(null)} />}
            {linealDlg && <LinealDialog onOk={finishLineal} onCancel={() => setLinealDlg(null)} />}
            {geoMsg && <div className="menu-backdrop dim" onPointerDown={() => setGeoMsg(null)}><div className="wall-dialog"><p>{geoMsg}</p><div className="row-btns"><button className="active" onClick={() => setGeoMsg(null)}>Aceptar</button></div></div></div>}
            {geoMenu && (() => {
              const g = (project.geometries || []).find((x) => x.id === geoMenu.id);
              if (!g) return null;
              const act = (fn) => { setGeoMenu(null); fn(); };
              return (
                <div className="menu-backdrop" onPointerDown={() => setGeoMenu(null)} onContextMenu={(e) => { e.preventDefault(); setGeoMenu(null); }}>
                  <div className="wall-menu geo-menu" style={{ left: geoMenu.x, top: geoMenu.y }} onPointerDown={(e) => e.stopPropagation()}>
                    <button onClick={() => act(() => setProject((p) => updateGeometry(p, g.id, setHole(g, !g.hole?.on))))}>{g.hole?.on ? 'Quitar perforación' : 'Perforar'}</button>
                    <button onClick={() => act(() => setProject((p) => updateGeometry(p, g.id, { visible: !(g.visible !== false) })))}>{g.visible === false ? 'Mostrar' : 'Ocultar'}</button>
                    <hr />
                    <button onClick={() => act(() => { setProject((p) => removeGeometry(p, g.id)); setSelection(null); })}>Eliminar</button>
                  </div>
                </div>
              );
            })()}
            {navOverlay && <div className={`nav-overlay ${navTool}`} {...navOverlay}>
              {zoomBox && <div className="zoom-box" style={{ left: Math.min(zoomBox.x0, zoomBox.x1), top: Math.min(zoomBox.y0, zoomBox.y1), width: Math.abs(zoomBox.x1 - zoomBox.x0), height: Math.abs(zoomBox.y1 - zoomBox.y0) }} />}
            </div>}
            {matMenu && (
              <div className="menu-backdrop" onPointerDown={() => setMatMenu(null)}>
                <div className="wall-menu mat-scope" style={{ left: matMenu.x, top: matMenu.y }} onPointerDown={(e) => e.stopPropagation()}>
                  {matMenu.strips && [['region', 'Región'], ['perfil-h', 'Perfil horizontal'], ['perfil-v', 'Perfil vertical']].map(([k, l]) => (
                    <button key={k} onClick={() => { applyStrip(matMenu.wallId, matMenu.u, matMenu.v, matMenu.matId, k); setMatMenu(null); }}>{l}</button>
                  ))}
                  <button onClick={() => { applyMat({ kind: 'wall', wallId: matMenu.wallId }, matMenu.matId, 'cara'); setMatMenu(null); }} title="Solo la cara de esta pared">Cara</button>
                  <button onClick={() => { applyMat({ kind: 'wall', wallId: matMenu.wallId }, matMenu.matId, 'todo'); setMatMenu(null); }} title="Todas las paredes">Todo</button>
                </div>
              </div>
            )}
            {dxfDlg && <DxfImportDialog dxf={dxfDlg.dxf} fileName={dxfDlg.fileName} onAccept={acceptDxf} onClose={() => setDxfDlg(null)} />}
            {importMsg && <div className="menu-backdrop dim" onPointerDown={() => setImportMsg(null)}><div className="wall-dialog import-msg" role="alert"><p>{importMsg}</p><div className="row-btns"><button className="active" onClick={() => setImportMsg(null)}>Aceptar</button></div></div></div>}
            {importsOpen && <ExternalsPanel externals={project.externals || []} planDxf={project.planDxf || null}
              onChange={(id, patch) => setProject((p) => updateExternal(p, id, patch))} onRemove={(id) => setProject((p) => removeExternal(p, id))}
              onDxf={(patch) => setProject((p) => ({ ...p, planDxf: patch ? { ...p.planDxf, ...patch } : null }))} onClose={() => setImportsOpen(false)} />}
            {prefsOpen && <PrefsDialog ui={ui} onClose={() => setPrefsOpen(false)} onShortcuts={(sc) => setUi((u) => ({ ...u, shortcuts: sc }))}
              onPrefs={(patch) => setUi((u) => ({ ...u, prefs: { ...prefsOf(u), ...patch }, ...(patch.fill ? { fill: patch.fill } : {}), ...(patch.arrowStep ? { moveStep: patch.arrowStep } : {}) }))} />}
            {favDlg && <FavoriteDialog count={favDlg.ids.length} groups={favoriteGroups(favorites)} capture={() => captureRef.current?.(1)}
              onSave={(info) => { const f = makeFavorite(project.modules.filter((m) => favDlg.ids.includes(m.id)), info); if (f) setUi((u) => ({ ...u, favorites: [...(u.favorites || []), f], catalogPath: ['__fav', f.group || 'General'] })); }}
              onClose={() => setFavDlg(null)} />}
            {favMsg && <div className="menu-backdrop dim" onPointerDown={() => setFavMsg(null)}><div className="wall-dialog fav-msg" role="alert"><p>{favMsg}</p><div className="row-btns"><button className="active" onClick={() => setFavMsg(null)}>Aceptar</button></div></div></div>}
            {rulersDlg && <RulersDialog wallLabel={`Pared ${project.room.walls.findIndex((w) => w.id === rulersDlg.wallId) + 1}`}
              current={project.room.walls.find((w) => w.id === rulersDlg.wallId)?.rulerGroup || null} groups={groupsR}
              onPick={(id) => setProject((p) => ({ ...p, room: updateWall(p.room, rulersDlg.wallId, { rulerGroup: id }) }))}
              onGroups={(gs) => setUi((u) => ({ ...u, rulerGroups: gs }))} onClose={() => setRulersDlg(null)} />}
            {floorMenu && (
              <div className="menu-backdrop" onPointerDown={() => setFloorMenu(null)} onContextMenu={(e) => { e.preventDefault(); setFloorMenu(null); }}>
                <div className="wall-menu floor-menu" style={{ left: floorMenu.x, top: floorMenu.y }} onPointerDown={(e) => e.stopPropagation()}>
                  <button onClick={() => floorAction('fit')}>Ajustar límites del piso</button>
                  <button onClick={() => floorAction('std')}>Crear piso padrón (5000 × 5000)</button>
                  <button onClick={() => floorAction('shape')}>Editar forma del piso…</button>
                  <button onClick={() => floorAction('grid')}>Editar grilla del piso…</button>
                </div>
              </div>
            )}
            {floorDlg === 'shape' && <FloorShapeEditor room={project.room} onApply={(pts) => setProject((p) => ({ ...p, room: setFloorShape(p.room, pts) }))} onClose={() => setFloorDlg(null)} />}
            {floorDlg === 'grid' && <FloorGridEditor room={project.room} onChange={(patch) => setProject((p) => ({ ...p, room: setFloorGrid(p.room, patch) }))} onClose={() => setFloorDlg(null)} />}
            {joinTool && (
              <div className="draw-hud join-hud">
                <b>Encuentro {joinTool.mode === 't' ? 'en T' : 'en esquina'}</b>
                <span className="hint-inline">Hacé clic en la otra pared (la primera es la que se mueve) · Esc cancela</span>
                <button onClick={() => setJoinTool(null)}>Cancelar</button>
              </div>
            )}
            {dlg304 && (() => {
              const ang = angleFrom304050(dlg304.A, dlg304.B, dlg304.C);
              const set = (k) => (e) => setDlg304({ ...dlg304, [k]: +e.target.value || 0 });
              return (
                <div className="menu-backdrop dim">
                  <div className="wall-dialog dlg-304050" role="dialog" aria-label="30-40-50">
                    <h3>30 - 40 - 50 · Pared {project.room.walls.findIndex((w) => w.id === dlg304.wallId) + 1}</h3>
                    <p className="hint">Medí A sobre la pared anterior y B sobre esta, desde la esquina; C es la distancia entre las dos marcas. La pared se gira hasta ese ángulo.</p>
                    <label className="field"><span>A</span><input type="number" value={dlg304.A} onChange={set('A')} /></label>
                    <label className="field"><span>B</span><input type="number" value={dlg304.B} onChange={set('B')} /></label>
                    <label className="field"><span>C</span><input type="number" value={dlg304.C} onChange={set('C')} /></label>
                    <p className="dlg-304-ang">{ang == null ? 'Medidas imposibles' : `Ángulo de la esquina: ${ang}°`}</p>
                    <div className="row-btns">
                      <button onClick={() => setDlg304(null)}>Cancelar</button>
                      <button className="active" disabled={ang == null} onClick={() => { setProject((p) => ({ ...p, room: setWallAngle(p.room, dlg304.wallId, ang, 'rel') })); setDlg304(null); }}>Aplicar</button>
                    </div>
                  </div>
                </div>
              );
            })()}
            {stripDlg && <StripEditor room={project.room} wallId={stripDlg.wallId} onRoom={(fn) => setProject((p) => ({ ...p, room: fn(p.room) }))}
              presets={ui.stripPresets || []} onPresets={(list) => setUi((u) => ({ ...u, stripPresets: list }))} onUndo={history.undo} onRedo={history.redo}
              onRegions={() => { setRegionDlg({ surface: { kind: 'wall', wallId: stripDlg.wallId } }); setStripDlg(null); }} onClose={() => setStripDlg(null)} />}
            {regionDlg && <RegionEditor room={project.room} surface={regionDlg.surface} onRoom={(fn) => setProject((p) => ({ ...p, room: fn(p.room) }))}
              onUndo={history.undo} onRedo={history.redo} onClose={() => setRegionDlg(null)} />}
            {lightsDlg && <LightsEditor project={project} onClose={() => setLightsDlg(false)} onSelect={selectModule}
              onParams={(id, patch) => setProject((p) => ({ ...p, modules: p.modules.map((m) => (m.id === id ? { ...m, params: { ...m.params, ...patch } } : m)) }))} />}
            {tamponDlg && <TamponamentoEditor mods={project.modules.filter((m) => tamponDlg.ids.includes(m.id))}
              items={ui.topItems || []} onItems={(list) => setUi((u) => ({ ...u, topItems: list }))}
              onInsert={insertModules} onClose={() => setTamponDlg(null)} />}
            {modMenu && <ModuleContextMenu menu={modMenu} canMax={canMaxSize(project.modules.find((m) => m.id === modMenu.id) || {})} onAction={moduleAction} onClose={() => setModMenu(null)}
              canGroup={multiSel && !selectionGroup(project, selectedIds)} canUngroup={project.modules.some((m) => selectedIds.includes(m.id) && m.groupId)} />}
            {wallMenu && <WallContextMenu menu={wallMenu} wall={project.room.walls.find((w) => w.id === wallMenu.wallId)} onAction={wallAction} onClose={() => setWallMenu(null)} />}
            {deleteDlg && <WallDeleteDialog label={`Pared ${project.room.walls.findIndex((w) => w.id === deleteDlg.wallId) + 1}`} onConfirm={confirmDelete} onCancel={() => setDeleteDlg(null)} />}
            <div className="statusbar">
              <span className="sb-sel">{(multiSel ? describeMulti(project, selectedIds, !!selectionGroup(project, selectedIds)) : describeSelection(project, selection)) || 'Sin selección'}</span>
              {axisLock && <span className="sb-lock" title="X / Y cambian la traba">Movimiento trabado: solo {axisLock === 'x' ? 'ancho (X)' : 'profundidad (Y)'}</span>}
              <span className="sb-stats">{project.modules.length} módulos · {cut.rows.reduce((a, r) => a + r.qty, 0)} piezas · {nesting.reduce((a, n) => a + n.sheets.length, 0)} placas</span>
              <StatusToggles ui={ui} onToggle={toggleUi} showDims={showDims} onShowDims={setShowDims} onShowRulers={(v) => setUi((u) => ({ ...u, showRulers: v }))} show={show} onShow={(k, v) => setUi((u) => ({ ...u, show: { ...(u.show || {}), [k]: v } }))}
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
          {tool === 'tirador' && (
            <TiradorPanel selected={selected}
              onSet={(patch) => mapModule(selectedId, (m) => ({ ...m, params: { ...m.params, ...patch } }))}
              onSetAll={(patch) => setProject((p) => ({ ...p, modules: p.modules.map((m) => (fieldsFor(m.type).includes('handlePos') ? { ...m, params: { ...m.params, ...patch } } : m)) }))} />
          )}
          {tool === 'aperturas' && (
            <AperturasPanel selected={selected} built={selected ? builtById.get(selected.id) : null} state={openFronts}
              onState={(id, st) => setOpenFronts((o) => ({ ...o, [id]: st }))}
              onAll={(open) => setOpenFronts(open ? Object.fromEntries(built.map((b) => [b.id, { open: Object.fromEntries(frontsOf(b).map((f) => [f.k, true])) }])) : {})}
              onInvert={(k) => selected && setProject((p) => ({ ...p, modules: p.modules.map((m) => (m.id === selected.id ? invertHinge(m, builtById.get(m.id), k) : m)) }))} />
          )}
          {tool === 'modelos' && (
            <ModelsPanel project={project} settings={settings} selected={selected}
              onApply={(slot, id, scope) => setProject((p) => applyModel(p, slot, id, scope, selectedId ? [selectedId] : []))}
              styles={stylesOf(settings)} onStyles={(list) => setSettings((s) => ({ ...s, styles: list }))}
              onApplyStyle={(style, scope) => setProject((p) => applyStyle(p, style, scope, selectedId ? [selectedId] : []))} />
          )}
          {tool === 'propiedades' && selectedGeo && (
            <GeometryPanel g={selectedGeo} onBack={() => setSelection(null)}
              onHole={(on, depth) => setProject((p) => updateGeometry(p, selectedGeo.id, setHole(selectedGeo, on, depth)))}
              onChange={(patch) => setProject((p) => updateGeometry(p, selectedGeo.id, patch))}
              onResize={(key, v, scale) => setProject((p) => updateGeometry(p, selectedGeo.id, resizeGeometry(selectedGeo, key, v, scale)))}
              onDelete={() => { setProject((p) => removeGeometry(p, selectedGeo.id)); setSelection(null); }}
              onConvert={(type) => {
                const r = convertGeometry(selectedGeo, type);
                if (r.error) { setGeoMsg(r.error); return; }
                setProject((p) => removeGeometry(p, selectedGeo.id));
                insertModules([{ ...r.module, params: { ...(MODULE_TYPES[r.module.type]?.defaults || {}), ...r.module.params } }]);
              }} />
          )}
          {tool === 'propiedades' && multiSel && (
            <MultiSelectionPanel count={selectedIds.length} text={describeMulti(project, selectedIds)} isGroup={!!selectionGroup(project, selectedIds)}
              hasGroups={project.modules.some((m) => selectedIds.includes(m.id) && m.groupId)} onGroup={groupSelected} onUngroup={ungroupSelected}
              onDelete={deleteSelected} onHide={() => setProject((p) => toggleHidden(p, selectedIds))}
              onRotate={() => rotateBy(90)} onClear={() => setSelectedId(null)} />
          )}
          {tool === 'movimiento'
            ? <MovementPanel label={selected ? describeSelection(project, selection) : null} ui={ui} setUi={setUi} onNudge={nudgeSelected} onRotate={(sign) => rotateBy(sign * (ui.rotStep ?? 90))} />
            : tool === 'propiedades' && !multiSel && !selectedGeo && <Inspector project={project} settings={settings} selected={selected} built={selected ? builtById.get(selected.id) : null}
            selectedWallId={selectedWallId} onSelectWall={selectWall} onDrawWalls={startDrawWalls}
            onDeleteWall={(id) => setDeleteDlg({ wallId: id })} onSplitWall={doSplit}
            selectedOpeningId={selectedOpeningId} selectedColumnId={selectedColumnId} onSelectItem={setSelection} onScaleImage={startScale}
            onParams={(patch) => mapModule(selectedId, (m) => ({ ...m, params: { ...m.params, ...patch } }))}
            onUpdate={(patch) => mapModule(selectedId, (m) => ({ ...m, ...patch }))}
            onDelete={deleteSelected} onDuplicate={() => duplicateSelected()} onRotate={rotateSelected}
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
