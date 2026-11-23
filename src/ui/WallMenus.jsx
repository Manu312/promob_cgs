import { useEffect, useState } from 'react';

// Menú contextual de pared (clic derecho), como en Promob.
export function WallContextMenu({ menu, wall, onAction, onClose }) {
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  if (!wall) return null;
  const item = (action, label) => <button key={action} onClick={() => onAction(action)}>{label}</button>;
  return (
    <div className="menu-backdrop" onPointerDown={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }}>
      <div className="wall-menu" style={{ left: menu.x, top: menu.y }} onPointerDown={(e) => e.stopPropagation()}>
        {item('lowered', wall.lowered ? 'Restaurar (subir)' : 'Rebajar')}
        {item('transparent', wall.transparent ? 'Opaca' : 'Transparente')}
        {item('split', 'Dividir aquí')}
        {item('delete', 'Eliminar…')}
      </div>
    </div>
  );
}

// Diálogo de eliminar pared(es): Solo este tramo · Todas · Conservar la seleccionada.
export function WallDeleteDialog({ label, onConfirm, onCancel }) {
  const [mode, setMode] = useState('tramo');
  const [withModules, setWithModules] = useState(false);
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onCancel]);
  const opt = (v, text) => (
    <label key={v} className="radio"><input type="radio" name="del-mode" checked={mode === v} onChange={() => setMode(v)} /> {text}</label>
  );
  return (
    <div className="menu-backdrop dim" onPointerDown={onCancel}>
      <div className="wall-dialog" onPointerDown={(e) => e.stopPropagation()}>
        <h3>Eliminar · {label}</h3>
        {opt('tramo', 'Solo este tramo')}
        {opt('todas', 'Todas las paredes')}
        {opt('conservar', 'Conservar solo la seleccionada')}
        <label className="radio"><input type="checkbox" checked={withModules} onChange={(e) => setWithModules(e.target.checked)} /> Eliminar también los módulos apoyados en esas paredes</label>
        <div className="row-btns">
          <button className="danger" onClick={() => onConfirm(mode, withModules)}>Eliminar</button>
          <button onClick={onCancel}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

// Menú contextual del módulo (clic derecho): tamaño máximo hasta el obstáculo y acciones rápidas.
export function ModuleContextMenu({ menu, canMax, onAction, onClose, canGroup, canUngroup }) {
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  const item = (action, label, disabled) => <button key={action} disabled={disabled} onClick={() => onAction(action)}
    title={disabled ? 'Solo con el módulo a escuadra (0, 90, 180 o 270°)' : undefined}>{label}</button>;
  return (
    <div className="menu-backdrop" onPointerDown={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }}>
      <div className="wall-menu module-menu" style={{ left: menu.x, top: menu.y }} onPointerDown={(e) => e.stopPropagation()}>
        {item('max-width', 'Ancho máximo', !canMax)}
        {item('max-height', 'Alto máximo')}
        {item('max-depth', 'Profundidad máxima', !canMax)}
        <hr />
        {item('rotate', 'Rotar 90°')}
        {item('duplicate', 'Duplicar')}
        <hr />
        <button disabled={!canGroup} onClick={() => onAction('group')} title="Agrupar los módulos seleccionados (U)">Agrupar</button>
        <button disabled={!canUngroup} onClick={() => onAction('ungroup')} title="Desagrupar (Ctrl+U)">Desagrupar</button>
        <hr />
        {item('delete', 'Eliminar')}
      </div>
    </div>
  );
}
