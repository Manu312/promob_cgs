// Proyectos guardados (Fase 8): una interfaz única para el Inicio y el guardado, con dos
// implementaciones: local (navegador) y Supabase (S2). Cada proyecto tiene su ficha (`meta`: nombre,
// cliente, tipo, situación, etapa, fechas, observaciones, etiquetas, creado/modificado) y su
// contenido (`data`: el proyecto del editor).

export const PROJECT_TYPES = ['Cocina', 'Placard', 'Baño', 'Living', 'Dormitorio', 'Oficina', 'Comercial', 'Otro'];
export const PROJECT_STATUS = ['Abierto', 'En negociación', 'Vendido', 'Perdido'];
export const PROJECT_STAGES = ['Diseño', 'Presupuesto enviado', 'Aprobado', 'En producción', 'Entregado'];
export const SORTS = [['modificado', 'Última modificación'], ['nombre', 'Nombre'], ['creado', 'Fecha de creación'], ['cierre', 'Previsión de cierre']];
export const PAGE_SIZE = 10;

let seq = 0;
export const newId = () => `p${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const clean = (s, n) => String(s ?? '').slice(0, n).trim();
const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
const pick = (v, list, d) => (list.includes(v) ? v : d);

// Ficha válida (lo que venga de un archivo o de la base se normaliza).
export function normalizeMeta(m = {}, now = new Date().toISOString()) {
  return {
    id: typeof m.id === 'string' && m.id ? m.id : newId(),
    name: clean(m.name, 120) || 'Proyecto sin nombre',
    client: clean(m.client, 120),
    type: pick(m.type, PROJECT_TYPES, 'Cocina'),
    status: pick(m.status, PROJECT_STATUS, 'Abierto'),
    stage: pick(m.stage, PROJECT_STAGES, 'Diseño'),
    closeBy: isDate(m.closeBy) ? m.closeBy : '',
    delivery: isDate(m.delivery) ? m.delivery : '',
    notes: clean(m.notes, 2000),
    tags: [...new Set((Array.isArray(m.tags) ? m.tags : String(m.tags || '').split(','))
      .map((t) => clean(t, 30).toLowerCase()).filter(Boolean))].slice(0, 12),
    createdAt: typeof m.createdAt === 'string' ? m.createdAt : now,
    updatedAt: typeof m.updatedAt === 'string' ? m.updatedAt : now,
    updatedBy: clean(m.updatedBy, 120),
  };
}

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Buscar (nombre, cliente, etiquetas, tipo, situación, etapa; todas las palabras), ordenar y paginar.
export function queryProjects(metas, { search = '', sort = 'modificado', page = 0, pageSize = PAGE_SIZE } = {}) {
  const words = norm(search).split(/\s+/).filter(Boolean);
  const hay = (m) => norm([m.name, m.client, m.type, m.status, m.stage, ...(m.tags || [])].join(' '));
  let list = metas.filter((m) => words.every((w) => hay(m).includes(w)));
  const by = {
    modificado: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
    creado: (a, b) => b.createdAt.localeCompare(a.createdAt),
    nombre: (a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }),
    cierre: (a, b) => (a.closeBy || '9999').localeCompare(b.closeBy || '9999'),
  }[sort] || ((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  list = [...list].sort(by);
  const pages = Math.max(1, Math.ceil(list.length / pageSize));
  const p = Math.min(Math.max(0, page), pages - 1);
  return { items: list.slice(p * pageSize, p * pageSize + pageSize), total: list.length, page: p, pages };
}

// Copia de un proyecto: ficha nueva ("(copia)"), mismo contenido.
export function duplicateMeta(meta, now = new Date().toISOString()) {
  return normalizeMeta({ ...meta, id: newId(), name: `${meta.name} (copia)`, createdAt: now, updatedAt: now }, now);
}

// ---- Repositorio local (navegador). `storage` tiene getItem / setItem / removeItem, sincrónicos
// (localStorage, memoria) o que devuelven promesas (IndexedDB, con mucho más lugar).
export const LOCAL_INDEX = 'mueblesapp.projects';
const dataKey = (id) => `mueblesapp.projects.${id}`;

export function createLocalRepo(storage, { now = () => new Date().toISOString(), user = '' } = {}) {
  const readIndex = async () => {
    try { const a = JSON.parse((await storage.getItem(LOCAL_INDEX)) || '[]'); return Array.isArray(a) ? a.map((m) => normalizeMeta(m)) : []; } catch { return []; }
  };
  const writeIndex = (list) => storage.setItem(LOCAL_INDEX, JSON.stringify(list));
  return {
    kind: 'local',
    async list(q = {}) { return queryProjects(await readIndex(), q); },
    async all() { return readIndex(); },
    async get(id) {
      const meta = (await readIndex()).find((m) => m.id === id);
      if (!meta) return null;
      let data = null;
      try { data = JSON.parse((await storage.getItem(dataKey(id))) || 'null'); } catch { data = null; }
      return { meta, data };
    },
    async save(meta0, data) {
      const t = now();
      const meta = normalizeMeta({ ...meta0, updatedAt: t, updatedBy: user || meta0.updatedBy }, t);
      if (data !== undefined) await storage.setItem(dataKey(meta.id), JSON.stringify({ ...data, name: meta.name }));
      const list = (await readIndex()).filter((m) => m.id !== meta.id);
      await writeIndex([meta, ...list]);
      return meta;
    },
    async remove(id) {
      await writeIndex((await readIndex()).filter((m) => m.id !== id));
      await storage.removeItem(dataKey(id));
    },
    async duplicate(id) {
      const src = await this.get(id);
      if (!src) return null;
      const meta = duplicateMeta(src.meta, now());
      return this.save(meta, { ...(src.data || {}), name: meta.name });
    },
  };
}

// Primera vez con el Inicio: el proyecto que estaba abierto pasa a ser el primero de la lista.
export async function adoptOpenProject(repo, openProject, { currentId = null } = {}) {
  if (currentId) return currentId;
  const all = await repo.all();
  if (all.length || !openProject) return all[0]?.id || null;
  const meta = await repo.save(normalizeMeta({ name: openProject.name || 'Mi proyecto' }), openProject);
  return meta.id;
}
