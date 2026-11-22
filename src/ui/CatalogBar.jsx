import { useEffect, useRef, useState } from 'react';
import { LIBRARY, resolvePath, mostUsed, paginate, itemSize, variantValues } from '../domain/library.js';
import { ModelThumb, Silhouette } from './thumbnails.jsx';

const MAS = '__mas'; // pestaña "Más usados"
const ITEM_W = 122; // ancho de cada miniatura (px) para el paginado

// Barra de modulación, arriba del visor como en Promob: biblioteca → familia → ítems →
// subfamilia, con atrás/adelante y "Más usados". Clic elige el ítem; doble clic lo inserta.
export default function CatalogBar({ nav, setNav, counts = {}, onInsert, onDragItem, thumbCtx }) {
  const masUsados = nav?.[0] === MAS;
  const r = resolvePath(masUsados ? [] : nav || []);
  const path = masUsados ? [MAS] : r.path;
  const [hist, setHist] = useState({ back: [], fwd: [] });
  const [page, setPage] = useState(0);
  const [picked, setPicked] = useState(null);
  const [variant, setVariant] = useState({}); // medida elegida en el desplegable, por ítem
  const [perPage, setPerPage] = useState(6);
  const boxRef = useRef(null);
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(() => setPerPage(Math.max(1, Math.floor(el.clientWidth / ITEM_W))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => setPage(0), [path.join('/')]);

  const go = (p) => {
    if (p.join('/') === path.join('/')) return;
    setHist((h) => ({ back: [...h.back, path].slice(-30), fwd: [] }));
    setNav(p);
  };
  const back = () => { if (!hist.back.length) return; const p = hist.back.at(-1); setHist((h) => ({ back: h.back.slice(0, -1), fwd: [path, ...h.fwd] })); setNav(p); };
  const fwd = () => { if (!hist.fwd.length) return; const p = hist.fwd[0]; setHist((h) => ({ back: [...h.back, path], fwd: h.fwd.slice(1) })); setNav(p); };

  const items = masUsados ? mostUsed(counts) : r.sub.items;
  const pg = paginate(items, page, perPage);
  const tab = (on, label, onClick, key) => <button key={key ?? label} className={`cb-tab${on ? ' on' : ''}`} onClick={onClick}>{label}</button>;

  return (
    <div className="catalog-bar">
      <div className="cb-row cb-libs">
        {tab(masUsados, '★ Más usados', () => go([MAS]), MAS)}
        {LIBRARY.map((l) => tab(!masUsados && l.id === r.lib.id, l.label, () => go([l.id]), l.id))}
      </div>
      {!masUsados && (
        <div className="cb-row cb-groups">
          {r.lib.groups.map((g) => tab(g.id === r.group.id, g.label, () => go([r.lib.id, g.id]), g.id))}
        </div>
      )}
      <div className="cb-items-row">
        <button className="cb-page" disabled={pg.page === 0} onClick={() => setPage(pg.page - 1)} aria-label="Página anterior">◀</button>
        <div className="cb-items" ref={boxRef}>
          {pg.items.map((item) => {
            const vs = variantValues(item);
            const v = variant[item.id] ?? null;
            return (
              <div key={item.id} className={`mod-btn${picked === item.id ? ' picked' : ''}`} role="button" tabIndex={0} title="Arrastralo al 3D o hacé doble clic para insertarlo"
                onClick={() => setPicked(item.id)} onDoubleClick={() => onInsert(item, v)}
                draggable onDragStart={(e) => { e.dataTransfer.setData('text/plain', item.id); e.dataTransfer.effectAllowed = 'copy'; setPicked(item.id); onDragItem?.(item, v); }}
                onDragEnd={() => onDragItem?.(null)}>
                {thumbCtx ? <ModelThumb item={item} variant={v} ctx={thumbCtx} /> : <Silhouette item={item} />}
                <span>{item.label}</span>
                {vs.length > 0 ? (
                  <select className="cb-variant" value={v ?? ''} title="Medida a insertar"
                    onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}
                    onChange={(e) => setVariant((m) => ({ ...m, [item.id]: e.target.value === '' ? null : Number(e.target.value) }))}>
                    <option value="">{itemSize(item)}</option>
                    {vs.map((w) => <option key={w} value={w}>{itemSize(item, w)}</option>)}
                  </select>
                ) : <small>{itemSize(item)}</small>}
              </div>
            );
          })}
          {!pg.items.length && <p className="hint cb-empty">{masUsados ? 'Todavía no insertaste módulos: los más usados aparecen acá.' : 'Sin ítems.'}</p>}
        </div>
        <button className="cb-page" disabled={pg.page >= pg.pages - 1} onClick={() => setPage(pg.page + 1)} aria-label="Página siguiente">▶</button>
        <span className="cb-count">{pg.page + 1}/{pg.pages}</span>
      </div>
      <div className="cb-row cb-subs">
        <button className="cb-nav" disabled={!hist.back.length} onClick={back} title="Atrás" aria-label="Atrás">⟵</button>
        <button className="cb-nav" disabled={!hist.fwd.length} onClick={fwd} title="Adelante" aria-label="Adelante">⟶</button>
        {!masUsados && r.group.subgroups.map((s) => tab(s.id === r.sub.id, s.label, () => go([r.lib.id, r.group.id, s.id]), s.id))}
      </div>
    </div>
  );
}
