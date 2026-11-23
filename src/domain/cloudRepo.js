// Proyectos en Supabase (Fase 8 S2) y repositorio sincronizado: nube + copia local.
// - Repositorio Supabase: misma interfaz que el local (list, all, get, save, remove, duplicate) sobre
//   la tabla `projects` (ver supabase/001_proyectos.sql). `db` es el cliente de supabase-js.
// - Repositorio sincronizado: cada guardado va primero a la copia local (al instante) y después a la
//   nube; si no hay conexión queda pendiente y se reintenta. Estado: 'guardado' | 'guardando' |
//   'sin-conexion'. Si dos personas editan el mismo proyecto, gana el último guardado.

import { normalizeMeta, queryProjects, duplicateMeta } from './projectsRepo.js';
import { extractAssets, injectAssets, assetRefs } from './assets.js';

export function metaToRow(m) {
  return {
    id: m.id, name: m.name, client: m.client, type: m.type, status: m.status, stage: m.stage,
    close_by: m.closeBy || null, delivery: m.delivery || null, notes: m.notes, tags: m.tags,
    created_at: m.createdAt, updated_at: m.updatedAt, updated_by: m.updatedBy || '',
  };
}
export function rowToMeta(r) {
  return normalizeMeta({
    id: r.id, name: r.name, client: r.client, type: r.type, status: r.status, stage: r.stage,
    closeBy: r.close_by || '', delivery: r.delivery || '', notes: r.notes, tags: r.tags,
    createdAt: r.created_at, updatedAt: r.updated_at, updatedBy: r.updated_by,
  });
}
const META_COLS = 'id,name,client,type,status,stage,close_by,delivery,notes,tags,created_at,updated_at,updated_by';

// `files` (opcional, S3): { upload(ruta, contenido), download(ruta), removeFolder(id) } sobre Storage.
// Con él, las imágenes y modelos pesados viajan como archivos aparte y el proyecto guarda la ruta.
export function createSupabaseRepo(db, { now = () => new Date().toISOString(), user = '', files = null } = {}) {
  const table = () => db.from('projects');
  const ok = ({ data, error }) => { if (error) throw error; return data; };
  const uploaded = new Set(); // en esta sesión: no se vuelve a subir lo mismo en cada guardado
  return {
    kind: 'supabase',
    async all() { return ok(await table().select(META_COLS)).map(rowToMeta); },
    async list(q = {}) { return queryProjects(await this.all(), q); },
    async get(id) {
      const rows = ok(await table().select('*').eq('id', id).limit(1));
      if (!rows[0]) return null;
      let data = rows[0].data;
      const refs = data && files ? assetRefs(data) : [];
      if (refs.length) { // si un archivo no baja, falla todo y el sincronizado usa la copia local
        const got = await Promise.all(refs.map(async (p) => [p, await files.download(p)]));
        got.forEach(([p]) => uploaded.add(p));
        data = injectAssets(data, new Map(got));
      }
      return { meta: rowToMeta(rows[0]), data };
    },
    async save(meta0, data) {
      const t = now();
      const meta = normalizeMeta({ ...meta0, updatedAt: t, updatedBy: user || meta0.updatedBy }, t);
      const row = metaToRow(meta);
      if (data !== undefined) {
        let body = { ...data, name: meta.name };
        if (files) {
          const ex = extractAssets(body, meta.id);
          for (const f of ex.files) {
            if (uploaded.has(f.path)) continue;
            await files.upload(f.path, f.content);
            uploaded.add(f.path);
          }
          body = ex.project;
        }
        row.data = body;
      }
      ok(await table().upsert(row, { onConflict: 'id' }));
      return meta;
    },
    async remove(id) {
      ok(await table().delete().eq('id', id));
      if (files?.removeFolder) await files.removeFolder(id).catch(() => {});
    },
    async duplicate(id) {
      const src = await this.get(id);
      if (!src) return null;
      const meta = duplicateMeta(src.meta, now());
      return this.save(meta, { ...(src.data || {}), name: meta.name });
    },
  };
}

// ---- Sincronizado: nube + copia local con pendientes ----
const PENDING = 'mueblesapp.projects.pendientes';

export function createSyncedRepo(remote, local, pendingStore, { onStatus = () => {} } = {}) {
  let status = 'guardado';
  const setStatus = (s) => { if (s !== status) { status = s; onStatus(s); } };
  const readPending = async () => { try { return JSON.parse((await pendingStore.getItem(PENDING)) || '[]'); } catch { return []; } };
  const writePending = (list) => pendingStore.setItem(PENDING, JSON.stringify(list));
  // un pendiente por proyecto: el último (guardar o borrar) reemplaza al anterior
  const markPending = async (id, op = 'save') => {
    try { await writePending([...(await readPending()).filter((p) => p.id !== id), { id, op }]); } catch { /* sin lugar */ }
  };

  // Sube a la nube lo que quedó pendiente (guardados y borrados hechos sin conexión).
  async function flush() {
    const pend = await readPending();
    if (!pend.length) { setStatus('guardado'); return true; }
    setStatus('guardando');
    const left = [];
    for (const p of pend) {
      try {
        if (p.op === 'remove') await remote.remove(p.id);
        else {
          const r = await local.get(p.id);
          if (r) await remote.save(r.meta, r.data ?? undefined);
        }
      } catch { left.push(p); }
    }
    await writePending(left);
    setStatus(left.length ? 'sin-conexion' : 'guardado');
    return !left.length;
  }

  return {
    kind: 'sincronizado',
    get status() { return status; },
    flush,
    async all() {
      try { const metas = await remote.all(); return metas; } catch { setStatus('sin-conexion'); return local.all(); }
    },
    async list(q = {}) { return queryProjects(await this.all(), q); },
    async get(id) {
      try {
        const r = await remote.get(id);
        if (r) { await local.save(r.meta, r.data ?? undefined).catch(() => {}); return r; }
        return local.get(id); // todavía no subió (creado sin conexión)
      } catch { setStatus('sin-conexion'); return local.get(id); }
    },
    async save(meta, data) {
      const saved = await local.save(meta, data);
      setStatus('guardando');
      try {
        await remote.save(saved, data);
        await flush();
      } catch {
        await markPending(saved.id, 'save');
        setStatus('sin-conexion');
      }
      return saved;
    },
    async remove(id) {
      await local.remove(id);
      try { await remote.remove(id); } catch { await markPending(id, 'remove'); setStatus('sin-conexion'); }
    },
    async duplicate(id) {
      const src = await this.get(id);
      if (!src) return null;
      const meta = duplicateMeta(src.meta);
      return this.save(meta, { ...(src.data || {}), name: meta.name });
    },
    // La primera vez con la nube: sube los proyectos locales que la nube no tiene (o tiene más viejos).
    async uploadLocal() {
      const [mine, theirs] = await Promise.all([local.all(), remote.all()]);
      const byId = new Map(theirs.map((m) => [m.id, m]));
      let n = 0;
      for (const m of mine) {
        const r = byId.get(m.id);
        if (r && r.updatedAt >= m.updatedAt) continue;
        const full = await local.get(m.id);
        await remote.save(full.meta, full.data ?? undefined);
        n++;
      }
      return n;
    },
  };
}
