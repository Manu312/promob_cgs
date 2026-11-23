import { useState } from 'react';
import { ROOM_MATERIAL_GROUPS, searchRoomMaterials, roomMatById } from '../domain/roomMaterials.js';
import { swatchUrl } from './roomTextures.js';
import { IconSearch } from './fields.jsx';

// Pestaña Materiales (Promob: barra de materiales): arrastrar un material al piso o a una pared
// (en pared se elige Cara o Todo). Con una pared o el piso seleccionados, un clic lo aplica.
// Herramientas: Copiar material y Cambiar tonalidad. Favoritos con la estrella.
export default function MaterialsPanel({ favs = [], onFav, target, onApply, tool, onTool, tint, onTint }) {
  const [q, setQ] = useState('');
  const [tab, setTab] = useState(favs.length ? 'favoritos' : 'pinturas');
  const list = q ? searchRoomMaterials(q) : tab === 'favoritos' ? favs.map(roomMatById).filter(Boolean) : searchRoomMaterials('').filter((m) => m.group === tab);
  const swatch = (m) => {
    const url = swatchUrl(m.id);
    return url ? { backgroundImage: `url(${url})` } : { background: m.color };
  };
  return (
    <aside className="module-list materials-panel">
      <div className="ml-head"><b>Materiales</b></div>
      <p className="hint">Arrastrá un material al piso o a una pared{target ? ', o hacé clic para aplicarlo a la superficie seleccionada' : ''}.</p>
      <label className="rm-search"><IconSearch /><input placeholder="Buscar material" value={q} onChange={(e) => setQ(e.target.value)} /></label>
      {!q && (
        <div className="rm-tabs">
          {[['favoritos', '★ Favoritos'], ...ROOM_MATERIAL_GROUPS].map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}
        </div>
      )}
      <div className="rm-grid">
        {list.map((m) => (
          <div key={m.id} className="rm-item" role="button" tabIndex={0} draggable title={m.label}
            onDragStart={(e) => { e.dataTransfer.setData('text/x-room-mat', m.id); e.dataTransfer.effectAllowed = 'copy'; }}
            onClick={() => target && onApply(m.id)}>
            <i className="rm-swatch" style={swatch(m)} />
            <span>{m.label}</span>
            <button className={`rm-fav${favs.includes(m.id) ? ' on' : ''}`} onClick={(e) => { e.stopPropagation(); onFav(m.id); }} title="Favorito" aria-label="Favorito">★</button>
          </div>
        ))}
        {!list.length && <p className="hint">{tab === 'favoritos' && !q ? 'Marcá materiales con la estrella para tenerlos acá.' : 'Sin resultados.'}</p>}
      </div>
      <div className="rm-tools">
        <button className={tool?.kind === 'copy' ? 'active' : ''} onClick={() => onTool(tool?.kind === 'copy' ? null : { kind: 'copy', source: null })}
          title="Copiar material: clic en la superficie (o módulo) de origen y después en los destinos. M o Esc termina.">Copiar material</button>
        <button className={tool?.kind === 'tint' ? 'active' : ''} onClick={() => onTool(tool?.kind === 'tint' ? null : { kind: 'tint' })}
          title="Cambiar tonalidad: elegí el color y hacé clic en las superficies. M o Esc termina.">Cambiar tonalidad</button>
        <input type="color" value={tint} onChange={(e) => onTint(e.target.value)} title="Tonalidad" />
      </div>
      {tool?.kind === 'copy' && <p className="hint rm-tool-hint">{tool.source ? 'Ahora hacé clic en las superficies o módulos destino.' : 'Hacé clic en la superficie o el módulo de origen.'}</p>}
      {tool?.kind === 'tint' && <p className="hint rm-tool-hint">Hacé clic en una pared o en el piso para teñirla.</p>}
    </aside>
  );
}
