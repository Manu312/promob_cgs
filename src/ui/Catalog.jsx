import { MODULE_TYPES } from '../domain/modules.js';

const CATS = ['Cocina', 'Placares', 'Baño', 'Oficina'];

export default function Catalog({ onAdd }) {
  return (
    <aside className="catalog">
      <h3>Módulos</h3>
      {CATS.map((cat) => (
        <div key={cat} className="cat">
          <h4>{cat}</h4>
          {Object.entries(MODULE_TYPES).filter(([, d]) => d.cat === cat).map(([type, d]) => (
            <button key={type} className="mod-btn" onClick={() => onAdd(type)} title="Agregar al ambiente">
              <span>{d.label}</span>
              <small>{d.defaults.width}×{d.defaults.height}×{d.defaults.depth}</small>
            </button>
          ))}
        </div>
      ))}
    </aside>
  );
}
