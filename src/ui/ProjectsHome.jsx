import { useCallback, useEffect, useState } from 'react';
import { SORTS, PROJECT_TYPES, PROJECT_STATUS, PROJECT_STAGES, normalizeMeta } from '../domain/projectsRepo.js';

const fmt = (iso) => { try { return new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }); } catch { return ''; } };
const fmtDate = (d) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString('es-AR') : '—');

// Inicio (Promob): proyectos con búsqueda, orden y páginas; abrir, datos, duplicar, exportar, borrar.
export default function ProjectsHome({ repo, currentId, refreshKey, onOpen, onNew, onData, onExport, onChanged }) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('modificado');
  const [page, setPage] = useState(0);
  const [res, setRes] = useState({ items: [], total: 0, page: 0, pages: 1 });
  const [confirmDel, setConfirmDel] = useState(null);
  const [error, setError] = useState(null);
  const load = useCallback(async () => {
    try { setRes(await repo.list({ search, sort, page })); setError(null); } catch (e) { setError('No se pudo leer la lista de proyectos.'); }
  }, [repo, search, sort, page]);
  useEffect(() => { load(); }, [load, refreshKey]);
  useEffect(() => setPage(0), [search, sort]);
  const act = async (fn) => { try { await fn(); await load(); onChanged?.(); } catch { setError('No se pudo completar la acción.'); } };
  return (
    <div className="page projects-home">
      <div className="page-head">
        <h2>Proyectos</h2>
        <div className="row-btns"><button className="active" onClick={onNew}>+ Proyecto nuevo</button></div>
      </div>
      <div className="ph-bar">
        <input className="ph-search" placeholder="Buscar por nombre, cliente, etiqueta…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <label>Ordenar <select value={sort} onChange={(e) => setSort(e.target.value)}>{SORTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        <span className="hint">{res.total} proyecto{res.total === 1 ? '' : 's'}</span>
      </div>
      {error && <p className="auth-msg">{error}</p>}
      <div className="table-wrap">
        <table className="ph-table">
          <thead><tr><th>Proyecto</th><th>Cliente</th><th>Tipo</th><th>Situación</th><th>Etapa</th><th>Cierre</th><th>Modificado</th><th /></tr></thead>
          <tbody>
            {res.items.map((m) => (
              <tr key={m.id} data-id={m.id} className={m.id === currentId ? 'current' : ''}>
                <td><button className="link ph-open" onClick={() => onOpen(m.id)}>{m.name}</button>{m.tags.length > 0 && <div className="ph-tags">{m.tags.map((t) => <span key={t}>{t}</span>)}</div>}</td>
                <td>{m.client || '—'}</td>
                <td>{m.type}</td>
                <td>{m.status}</td>
                <td>{m.stage}</td>
                <td>{fmtDate(m.closeBy)}</td>
                <td title={m.updatedBy ? `por ${m.updatedBy}` : ''}>{fmt(m.updatedAt)}</td>
                <td className="ph-actions">
                  <button onClick={() => onOpen(m.id)}>Abrir</button>
                  <button onClick={() => onData(m)}>Datos</button>
                  <button onClick={() => act(() => repo.duplicate(m.id))}>Duplicar</button>
                  <button onClick={() => onExport(m.id)}>Exportar</button>
                  <button className="danger" onClick={() => setConfirmDel(m)}>Borrar</button>
                </td>
              </tr>
            ))}
            {!res.items.length && <tr><td colSpan={8} className="hint">{search ? 'Ningún proyecto coincide con la búsqueda.' : 'Todavía no hay proyectos.'}</td></tr>}
          </tbody>
        </table>
      </div>
      {res.pages > 1 && (
        <div className="ph-pages">
          <button disabled={res.page === 0} onClick={() => setPage(res.page - 1)}>◀</button>
          <span>Página {res.page + 1} de {res.pages}</span>
          <button disabled={res.page >= res.pages - 1} onClick={() => setPage(res.page + 1)}>▶</button>
        </div>
      )}
      {confirmDel && (
        <div className="menu-backdrop dim">
          <div className="wall-dialog" role="dialog" aria-label="Borrar proyecto">
            <h3>¿Borrar «{confirmDel.name}»?</h3>
            <p className="hint">No se puede deshacer. Si querés guardar una copia, exportalo antes.</p>
            <div className="row-btns">
              <button onClick={() => setConfirmDel(null)}>Cancelar</button>
              <button className="danger" onClick={() => { const id = confirmDel.id; setConfirmDel(null); act(() => repo.remove(id)); }}>Borrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Proyecto nuevo: nombre y cliente (la ficha completa del cliente llega más adelante, #173).
export function NewProjectDialog({ onCreate, onClose }) {
  const [name, setName] = useState('');
  const [client, setClient] = useState('');
  const [type, setType] = useState('Cocina');
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="menu-backdrop dim">
      <form className="wall-dialog new-project" role="dialog" aria-label="Proyecto nuevo" onSubmit={(e) => { e.preventDefault(); onCreate(normalizeMeta({ name: name || 'Proyecto nuevo', client, type })); }}>
        <h3>Proyecto nuevo</h3>
        <label className="field"><span>Nombre</span><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Cocina Pérez" autoFocus /></label>
        <label className="field"><span>Cliente</span><input value={client} onChange={(e) => setClient(e.target.value)} placeholder="Nombre del cliente" /></label>
        <label className="field"><span>Tipo</span><select value={type} onChange={(e) => setType(e.target.value)}>{PROJECT_TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
        <div className="row-btns">
          <button type="button" onClick={onClose}>Cancelar</button>
          <button className="active">Crear</button>
        </div>
      </form>
    </div>
  );
}

// Datos del proyecto (ficha): tipo, situación, etapa, fechas, observaciones y etiquetas.
export function ProjectDataDialog({ meta, onSave, onClose }) {
  const [m, setM] = useState(meta);
  const set = (patch) => setM((x) => ({ ...x, ...patch }));
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  const sel = (label, k, list) => <label className="field"><span>{label}</span><select value={m[k]} onChange={(e) => set({ [k]: e.target.value })}>{list.map((t) => <option key={t}>{t}</option>)}</select></label>;
  return (
    <div className="menu-backdrop dim">
      <form className="wall-dialog project-data" role="dialog" aria-label="Datos del proyecto" onSubmit={(e) => { e.preventDefault(); onSave(normalizeMeta(m)); }}>
        <h3>Datos del proyecto</h3>
        <label className="field"><span>Nombre</span><input value={m.name} onChange={(e) => set({ name: e.target.value })} /></label>
        <label className="field"><span>Cliente</span><input value={m.client} onChange={(e) => set({ client: e.target.value })} /></label>
        {sel('Tipo', 'type', PROJECT_TYPES)}
        {sel('Situación', 'status', PROJECT_STATUS)}
        {sel('Etapa', 'stage', PROJECT_STAGES)}
        <label className="field"><span>Previsión de cierre</span><input type="date" value={m.closeBy} onChange={(e) => set({ closeBy: e.target.value })} /></label>
        <label className="field"><span>Entrega</span><input type="date" value={m.delivery} onChange={(e) => set({ delivery: e.target.value })} /></label>
        <label className="field"><span>Etiquetas</span><input value={Array.isArray(m.tags) ? m.tags.join(', ') : m.tags} onChange={(e) => set({ tags: e.target.value })} placeholder="urgente, roble" /></label>
        <label className="field"><span>Observaciones</span><textarea rows={3} value={m.notes} onChange={(e) => set({ notes: e.target.value })} /></label>
        <p className="hint">Creado {fmt(meta.createdAt)} · modificado {fmt(meta.updatedAt)}{meta.updatedBy ? ` por ${meta.updatedBy}` : ''}</p>
        <div className="row-btns">
          <button type="button" onClick={onClose}>Cancelar</button>
          <button className="active">Guardar</button>
        </div>
      </form>
    </div>
  );
}
