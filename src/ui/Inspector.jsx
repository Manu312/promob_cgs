import { MODULE_TYPES, PARAM_DEFS, RULE_DEFS, DEFAULT_RULES, fieldsFor, moduleName } from '../domain/modules.js';
import { applyDecoreMaterialToType } from '../domain/decore.js';
import { NumField, SelField, TextField, num } from './fields.jsx';
import RoomEditor from './RoomEditor.jsx';
import WallPanel from './WallPanel.jsx';
import { OpeningPanel, ColumnPanel } from './RoomItemPanels.jsx';

// Reglas de construcción. Con `inherit`, cada campo puede quedar "igual al proyecto".
function RulesEditor({ rules, inherit, onChange }) {
  return Object.entries(RULE_DEFS).map(([k, d]) => {
    const v = rules?.[k];
    if (d.type === 'sel') {
      const opts = inherit ? [['', `— proyecto (${d.options.find((o) => o[0] === inherit[k])?.[1] ?? ''}) —`], ...d.options] : d.options;
      return <SelField key={k} label={d.label} value={v ?? ''} options={opts} onChange={(nv) => onChange({ ...rules, [k]: nv || undefined })} />;
    }
    return (
      <div key={k} className="rule-num">
        <NumField label={d.label} unit={d.unit} value={v ?? inherit?.[k] ?? DEFAULT_RULES[k]} min={d.min} max={d.max} step={d.step}
          onChange={(nv) => onChange({ ...rules, [k]: nv })} />
        {inherit && v !== undefined && <button className="link" onClick={() => onChange({ ...rules, [k]: undefined })}>usar valor del proyecto</button>}
      </div>
    );
  });
}

export default function Inspector({ project, settings, selected, selectedWallId, onSelectWall, onDrawWalls, onDeleteWall, onSplitWall, selectedOpeningId, selectedColumnId, onSelectItem, onScaleImage, built, onParams, onUpdate, onDelete, onDuplicate, onRotate, onRotateTo, onRest, onProject }) {
  if (selectedWallId && project.room.walls.some((w) => w.id === selectedWallId)) {
    return <WallPanel room={project.room} wallId={selectedWallId} onBack={() => onSelectWall(null)} onDelete={onDeleteWall} onSplit={onSplitWall}
      onRoom={(fn) => onProject((p) => ({ ...p, room: fn(p.room) }))} />;
  }
  const onRoom = (fn) => onProject((p) => ({ ...p, room: fn(p.room) }));
  if (selectedOpeningId && project.room.openings.some((o) => o.id === selectedOpeningId)) {
    return <OpeningPanel room={project.room} id={selectedOpeningId} onRoom={onRoom} onBack={() => onSelectItem(null)} />;
  }
  if (selectedColumnId && project.room.columns.some((c) => c.id === selectedColumnId)) {
    return <ColumnPanel room={project.room} id={selectedColumnId} onRoom={onRoom} onBack={() => onSelectItem(null)} />;
  }
  if (!selected) {
    const { room } = project;
    return (
      <aside className="inspector">
        <h3>Proyecto</h3>
        <TextField label="Nombre" value={project.name} onChange={(v) => onProject((p) => ({ ...p, name: v }))} />
        <h4>Ambiente</h4>
        <RoomEditor room={room} onChange={(r) => onProject((p) => ({ ...p, room: r }))} onSelectWall={onSelectWall} onDrawWalls={onDrawWalls} onSelectItem={onSelectItem}
          planImage={project.planImage} onPlanImage={(fn) => onProject((p) => ({ ...p, planImage: fn(p.planImage) }))} onScaleImage={onScaleImage} />
        <h4>Materiales</h4>
        <p className="hint">Se eligen en <b>Herramientas · Modelos</b> (Todos o Selección).</p>
        <h4>Construcción del proyecto</h4>
        <RulesEditor rules={{ ...DEFAULT_RULES, ...project.rules }} onChange={(r) => onProject((p) => ({ ...p, rules: r }))} />
        <p className="hint">Estas reglas aplican a todos los módulos; cada módulo puede tener las suyas.</p>
        <p className="hint">Elegí un módulo del catálogo para agregarlo. Hacé clic en un módulo para editarlo; arrastralo para moverlo (se pega a paredes y vecinos). Hacé clic en una pared para ver sus propiedades.</p>
        <p className="hint">Atajos: <b>R</b> rotar · <b>Supr</b> borrar · <b>flechas</b> mover 10mm (Shift 100mm) · <b>Esc</b> deseleccionar.</p>
      </aside>
    );
  }

  const def = MODULE_TYPES[selected.type];
  const p = selected.params;
  const nParts = built?.parts.length || 0;
  return (
    <aside className="inspector">
      <h3>{moduleName(selected)}</h3>
      <div className="row-btns">
        <button onClick={onRotate}>⟳ Rotar 90°</button>
        <button onClick={onDuplicate}>Duplicar</button>
        <button className="danger" onClick={onDelete}>Borrar</button>
      </div>
      <h4>Medidas y configuración</h4>
      {fieldsFor(selected.type).map((k) => {
        const d = PARAM_DEFS[k];
        if (p[k] === undefined) return null;
        return d.type === 'num'
          ? <NumField key={k} label={d.label} unit={d.unit} value={p[k]} min={d.min} max={d.max} step={d.step} onChange={(v) => onParams({ [k]: v })} />
          : <SelField key={k} label={d.label} value={p[k]} options={d.options} onChange={(v) => onParams({ [k]: v })} />;
      })}
      {MODULE_TYPES[selected.type]?.cat === 'Decore' && onProject && (
        <div className="row-btns">
          <button onClick={() => onProject((p) => applyDecoreMaterialToType(p, selected.type, selected.params.material))}
            title="Aplica este material a todos los objetos iguales del proyecto (Promob: En todos de este tipo)">Material en todos de este tipo</button>
        </div>
      )}
      <h4>Posición</h4>
      <NumField label="X (desde pared izq.)" unit="mm" value={selected.x} step={10} onChange={(v) => onUpdate({ x: v })} />
      <NumField label="Z (desde pared fondo)" unit="mm" value={selected.z} step={10} onChange={(v) => onUpdate({ z: v })} />
      <NumField label="Altura desde el piso" unit="mm" value={selected.y || 0} min={0} max={3000} step={10} onChange={(v) => onUpdate({ y: v })} />
      <NumField label="Rotación" unit="°" value={Math.round((selected.rot || 0) * 10) / 10} min={-360} max={360} step={15} onChange={(v) => onRotateTo(v)} />
      <label className="radio check-row" title="Al moverlo se apoya sobre la mesada o el módulo que tenga debajo (o en el piso)">
        <input type="checkbox" checked={!!selected.rest} onChange={(e) => onRest(e.target.checked)} /> Apoyar sobre lo de abajo
      </label>
      <p className="hint">Materiales de este módulo: <b>Herramientas · Modelos → Selección</b>.</p>
      {def.kind === 'caja' && (
        <>
          <h4>Construcción de este módulo</h4>
          <RulesEditor rules={selected.rules || {}} inherit={{ ...DEFAULT_RULES, ...project.rules }} onChange={(r) => onUpdate({ rules: r })} />
        </>
      )}
      <p className="hint">{num(nParts)} piezas en este módulo.</p>
    </aside>
  );
}
