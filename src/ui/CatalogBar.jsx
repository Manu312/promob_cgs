import { useEffect, useRef, useState } from 'react';
import { LIBRARY, resolvePath, mostUsed, paginate, itemSize, variantValues } from '../domain/library.js';
import { ModelThumb, Silhouette } from './thumbnails.jsx';
import { IconSearch } from './fields.jsx';
import { favoriteItem, favoriteGroups } from '../domain/favorites.js';

const MAS = '__mas'; // pestaña "Más usados"
const FAV = '__fav'; // pestaña "Favoritos"
const ITEM_W = 122; // ancho de cada miniatura (px) para el paginado

// Barra de modulación, arriba del visor como en Promob: biblioteca → familia → ítems →
// subfamilia, con atrás/adelante y "Más usados". Clic elige el ítem; doble clic lo inserta.
export default function CatalogBar({ favorites = null, onRemoveFavorite, onExportFavorites, onImportFavorites, nav, setNav, counts = {}, onInsert, onDragItem, onFind, thumbCtx, onPick, onReplace, canReplace }) {
  const favs = nav?.[0] === FAV;
  const masUsados = nav?.[0] === MAS || favs; // pestañas especiales (sin familias del catálogo)
  const r = resolvePath(masUsados ? [] : nav || []);
  const path = favs ? [FAV, nav?.[1] || ''] : masUsados ? [MAS] : r.path;
  const favGroups = favorites ? favoriteGroups(favorites) : [];
  const favGroup = favs ? (favGroups.includes(nav?.[1]) ? nav[1] : favGroups[0]) : null;
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
  // Localizar Rápido puede pedir un ítem puntual (4º elemento de la ruta): se marca y se va a su página.
  const focusId = masUsados ? null : nav?.[3];
  useEffect(() => {
    if (!focusId) return;
    const i = r.sub.items.findIndex((x) => x.id === focusId);
    if (i >= 0) { setPicked(focusId); setPage(Math.floor(i / perPage)); onPick?.(r.sub.items[i], null); }
  }, [focusId, perPage]); // eslint-disable-line react-hooks/exhaustive-deps

  const go = (p) => {
    if (p.join('/') === path.join('/')) return;
    setHist((h) => ({ back: [...h.back, path].slice(-30), fwd: [] }));
    setNav(p);
  };
  const back = () => { if (!hist.back.length) return; const p = hist.back.at(-1); setHist((h) => ({ back: h.back.slice(0, -1), fwd: [path, ...h.fwd] })); setNav(p); };
  const fwd = () => { if (!hist.fwd.length) return; const p = hist.fwd[0]; setHist((h) => ({ back: [...h.back, path], fwd: h.fwd.slice(1) })); setNav(p); };

  const items = favs ? favorites.filter((f) => (f.group || 'General') === favGroup).map(favoriteItem) : masUsados ? mostUsed(counts) : r.sub.items;
  const pg = paginate(items, page, perPage);
  const tab = (on, label, onClick, key) => <button key={key ?? label} className={`cb-tab${on ? ' on' : ''}`} onClick={onClick}>{label}</button>;

  return (
    <div className="catalog-bar">
      <div className="cb-row cb-libs">
        {tab(masUsados && !favs, '★ Más usados', () => go([MAS]), MAS)}
        {favorites && tab(favs, '♥ Favoritos', () => go([FAV]), FAV)}
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
                onClick={() => { setPicked(item.id); onPick?.(item, v); }} onDoubleClick={() => onInsert(item, v)}
                draggable onDragStart={(e) => { e.dataTransfer.setData('text/plain', item.id); e.dataTransfer.effectAllowed = 'copy'; setPicked(item.id); onDragItem?.(item, v); }}
                onDragEnd={() => onDragItem?.(null)}>
                {item.favorite ? (item.image ? <img className="fav-thumb" src={item.image} alt="" title={item.desc || ''} /> : <Silhouette item={item} />)
                  : thumbCtx ? <ModelThumb item={item} variant={v} ctx={thumbCtx} /> : <Silhouette item={item} />}
                {item.favorite && onRemoveFavorite && <button className="fav-del" title="Quitar de favoritos" aria-label="Quitar de favoritos"
                  onClick={(e) => { e.stopPropagation(); onRemoveFavorite(item.favorite.id); }} onDoubleClick={(e) => e.stopPropagation()}>✕</button>}
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
          {!pg.items.length && <p className="hint cb-empty">{favs ? 'Sin favoritos: clic derecho en un módulo → Agregar a favoritos.' : masUsados ? 'Todavía no insertaste módulos: los más usados aparecen acá.' : 'Sin ítems.'}</p>}
        </div>
        <button className="cb-page" disabled={pg.page >= pg.pages - 1} onClick={() => setPage(pg.page + 1)} aria-label="Página siguiente">▶</button>
        <span className="cb-count">{pg.page + 1}/{pg.pages}</span>
      </div>
      <div className="cb-row cb-subs">
        <button className="cb-nav" disabled={!hist.back.length} onClick={back} title="Atrás" aria-label="Atrás">⟵</button>
        <button className="cb-nav" disabled={!hist.fwd.length} onClick={fwd} title="Adelante" aria-label="Adelante">⟶</button>
        {onFind && <button className="cb-nav" onClick={onFind} title="Localizar Rápido (Ctrl+L)" aria-label="Localizar Rápido"><IconSearch /></button>}
        {onReplace && <button className="cb-nav cb-replace" disabled={!canReplace} onClick={onReplace}
          title="Sustitución rápida (S): reemplaza el módulo seleccionado por el ítem marcado en la barra" aria-label="Sustitución rápida">⇄</button>}
        {!masUsados && r.group.subgroups.map((s) => tab(s.id === r.sub.id, s.label, () => go([r.lib.id, r.group.id, s.id]), s.id))}
        {favs && favGroups.map((g) => tab(g === favGroup, g, () => go([FAV, g]), 'fg' + g))}
        {favs && <span className="cb-fav-io">
          <button className="cb-nav" disabled={!favorites.length} onClick={onExportFavorites} title="Exportar los favoritos a un archivo">Exportar</button>
          <label className="cb-nav cb-import" title="Importar favoritos de un archivo">Importar<input type="file" accept=".json,application/json" hidden
            onChange={(e) => { const f = e.target.files?.[0]; if (f) f.text().then(onImportFavorites); e.target.value = ''; }} /></label>
        </span>}
      </div>
    </div>
  );
}
