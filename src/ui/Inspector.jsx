import { MODULE_TYPES, PARAM_DEFS, RULE_DEFS, DEFAULT_RULES, fieldsFor } from '../domain/modules.js';
import { NumField, SelField, TextField, num } from './fields.jsx';

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

function MatSelect({ label, value, settings, onChange, allowInherit }) {
  const opts = settings.materials.map((m) => [m.id, m.name]);
  if (allowInherit) opts.unshift(['', '— igual al proyecto —']);
  return <SelField label={label} value={value || ''} onChange={(v) => onChange(v || undefined)} options={opts} />;
}

export default function Inspector({ project, settings, selected, built, onParams, onUpdate, onDelete, onDuplicate, onRotate, onProject }) {
  if (!selected) {
    const { room, defaults } = project;
    const setRoom = (k, v) => onProject((p) => ({ ...p, room: { ...p.room, [k]: v } }));
    const setDef = (k, v) => onProject((p) => ({ ...p, defaults: { ...p.defaults, [k]: v } }));
    return (
      <aside className="inspector">
        <h3>Proyecto</h3>
        <TextField label="Nombre" value={project.name} onChange={(v) => onProject((p) => ({ ...p, name: v }))} />
        <h4>Ambiente</h4>
        <NumField label="Ancho" unit="mm" value={room.w} min={1000} max={12000} step={50} onChange={(v) => setRoom('w', v)} />
        <NumField label="Profundidad" unit="mm" value={room.d} min={1000} max={12000} step={50} onChange={(v) => setRoom('d', v)} />
        <NumField label="Alto" unit="mm" value={room.h} min={2000} max={4000} step={50} onChange={(v) => setRoom('h', v)} />
        <h4>Materiales por defecto</h4>
        <MatSelect label="Cuerpo" value={defaults.cuerpo} settings={settings} onChange={(v) => setDef('cuerpo', v)} />
        <MatSelect label="Frentes" value={defaults.frente} settings={settings} onChange={(v) => setDef('frente', v)} />
        <MatSelect label="Fondos" value={defaults.fondo} settings={settings} onChange={(v) => setDef('fondo', v)} />
        <MatSelect label="Cajones (cajas)" value={defaults.cajon || defaults.cuerpo} settings={settings} onChange={(v) => setDef('cajon', v)} />
        <h4>Construcción del proyecto</h4>
        <RulesEditor rules={{ ...DEFAULT_RULES, ...project.rules }} onChange={(r) => onProject((p) => ({ ...p, rules: r }))} />
        <p className="hint">Estas reglas aplican a todos los módulos; cada módulo puede tener las suyas.</p>
        <p className="hint">Elegí un módulo del catálogo para agregarlo. Hacé clic en un módulo para editarlo; arrastralo para moverlo (se pega a paredes y vecinos).</p>
        <p className="hint">Atajos: <b>R</b> rotar · <b>Supr</b> borrar · <b>flechas</b> mover 10mm (Shift 100mm) · <b>Esc</b> deseleccionar.</p>
      </aside>
    );
  }

  const def = MODULE_TYPES[selected.type];
  const p = selected.params;
  const nParts = built?.parts.length || 0;
  return (
    <aside className="inspector">
      <h3>{def.label}</h3>
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
      <h4>Posición</h4>
      <NumField label="X (desde pared izq.)" unit="mm" value={selected.x} step={10} onChange={(v) => onUpdate({ x: v })} />
      <NumField label="Z (desde pared fondo)" unit="mm" value={selected.z} step={10} onChange={(v) => onUpdate({ z: v })} />
      <NumField label="Altura desde el piso" unit="mm" value={selected.y || 0} min={0} max={3000} step={10} onChange={(v) => onUpdate({ y: v })} />
      <h4>Materiales del módulo</h4>
      <MatSelect label="Cuerpo" value={selected.mats?.cuerpo} settings={settings} allowInherit onChange={(v) => onUpdate({ mats: { ...selected.mats, cuerpo: v } })} />
      <MatSelect label="Frentes" value={selected.mats?.frente} settings={settings} allowInherit onChange={(v) => onUpdate({ mats: { ...selected.mats, frente: v } })} />
      <MatSelect label="Cajones" value={selected.mats?.cajon} settings={settings} allowInherit onChange={(v) => onUpdate({ mats: { ...selected.mats, cajon: v } })} />
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
