// Panel de Propiedades con varios módulos seleccionados (Ctrl+clic o Ctrl+T).
export default function MultiSelectionPanel({ count, text, isGroup, hasGroups, onGroup, onUngroup, onDelete, onHide, onRotate, onClear }) {
  return (
    <aside className="inspector multi-sel">
      <h3>{isGroup ? 'Grupo' : 'Selección múltiple'}</h3>
      <p className="multi-sel-count"><b>{count}</b> {isGroup ? 'módulos agrupados' : 'módulos seleccionados'}</p>
      <p className="hint">{text}</p>
      <p className="hint">Arrastrá cualquiera de ellos para mover el conjunto. Ctrl+clic suma o quita un módulo; Ctrl+T selecciona todo.</p>
      <div className="row-btns">
        <button onClick={onGroup} disabled={isGroup} title="Agrupar: se seleccionan y mueven como uno (U)">Agrupar</button>
        <button onClick={onUngroup} disabled={!hasGroups} title="Desagrupar (Ctrl+U)">Desagrupar</button>
        <button onClick={onRotate} title="Girar el conjunto 90° (R)">Rotar 90°</button>
        <button onClick={onHide} title="Visible / invisible (O)">Visibilidad</button>
        <button className="danger" onClick={onDelete} title="Eliminar (Supr)">Eliminar</button>
        <button onClick={onClear} title="Esc">Deseleccionar</button>
      </div>
    </aside>
  );
}
