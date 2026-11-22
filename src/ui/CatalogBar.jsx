import { useEffect, useRef, useState } from 'react';
import { LIBRARY, resolvePath, mostUsed, paginate, itemParams, itemSize } from '../domain/library.js';

const MAS = '__mas'; // pestaña "Más usados"
const ITEM_W = 122; // ancho de cada miniatura (px) para el paginado

// Silueta provisoria (proporcional a ancho × alto) hasta tener la miniatura del 3D.
export function Silhouette({ item }) {
  const p = itemParams(item);
  const k = 64 / Math.max(p.width, p.height);
  const w = Math.max(10, p.width * k), h = Math.max(10, p.height * k);
  return (
    <svg className="cb-thumb" viewBox="0 0 70 70" aria-hidden="true">
      <rect x={(70 - w) / 2} y={70 - h - 2} width={w} height={h} rx="1.5" fill="#d8c3a5" stroke="#8a6d4b" />
    </svg>
  );
}

// Barra de modulación, arriba del visor como en Promob: biblioteca → familia → ítems →
// subfamilia, con atrás/adelante y "Más usados". Clic elige el ítem; doble clic lo inserta.
export default function CatalogBar({ nav, setNav, counts = {}, onInsert, Thumb = Silhouette }) {
  const masUsados = nav?.[0] === MAS;
  const r = resolvePath(masUsados ? [] : nav || []);
  const path = masUsados ? [MAS] : r.path;
  const [hist, setHist] = useState({ back: [], fwd: [] });
  const [page, setPage] = useState(0);
  const [picked, setPicked] = useState(null);
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
          {pg.items.map((item) => (
            <button key={item.id} className={`mod-btn${picked === item.id ? ' picked' : ''}`} title="Doble clic para insertar"
              onClick={() => setPicked(item.id)} onDoubleClick={() => onInsert(item)}>
              <Thumb item={item} />
              <span>{item.label}</span>
              <small>{itemSize(item)}</small>
            </button>
          ))}
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
