import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSupabaseRepo, createSyncedRepo, metaToRow, rowToMeta } from '../src/domain/cloudRepo.js';
import { createLocalRepo, normalizeMeta } from '../src/domain/projectsRepo.js';

const memStorage = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};
let clock = 0;
const now = () => new Date(Date.UTC(2026, 10, 23, 12, 0, clock++)).toISOString();

// Supabase de mentira: la parte de supabase-js que usa el repositorio, con "sin conexión".
function fakeDb() {
  const rows = new Map();
  const st = { offline: false, calls: 0 };
  const res = (data) => (st.offline ? { data: null, error: new Error('Failed to fetch') } : { data, error: null });
  const from = () => {
    let filter = null, cols = '*';
    const q = {
      select(c) { cols = c; return q; },
      eq(k, v) { filter = [k, v]; return q; },
      limit() { return q; },
      then(ok, ko) {
        st.calls++;
        let list = [...rows.values()];
        if (filter) list = list.filter((r) => r[filter[0]] === filter[1]);
        if (cols !== '*') list = list.map((r) => Object.fromEntries(cols.split(',').map((k) => [k, r[k]])));
        return Promise.resolve(res(list)).then(ok, ko);
      },
      upsert(row) { st.calls++; if (!st.offline) rows.set(row.id, { ...(rows.get(row.id) || {}), ...row }); return Promise.resolve(res([row])); },
      delete() { return { eq: (k, v) => { st.calls++; if (!st.offline) rows.delete(v); return Promise.resolve(res(null)); } }; },
    };
    return q;
  };
  return { from, rows, st };
}

test('ficha ↔ fila de la tabla', () => {
  const m = normalizeMeta({ id: 'a', name: 'Cocina', client: 'Ana', closeBy: '2026-12-01', tags: ['roble'] });
  const r = metaToRow(m);
  assert.deepEqual([r.close_by, r.delivery, r.tags], ['2026-12-01', null, ['roble']]);
  assert.deepEqual(rowToMeta(r), m);
});

test('repositorio Supabase: guardar, listar, abrir, guardar solo la ficha, duplicar, borrar', async () => {
  const db = fakeDb();
  const repo = createSupabaseRepo(db, { now, user: 'ana@mail.com' });
  const a = await repo.save(normalizeMeta({ name: 'Cocina' }), { name: 'x', modules: [1] });
  await repo.save(normalizeMeta({ name: 'Placard' }), { modules: [] });
  assert.equal((await repo.list()).total, 2);
  const got = await repo.get(a.id);
  assert.deepEqual([got.meta.name, got.meta.updatedBy, got.data.modules, got.data.name], ['Cocina', 'ana@mail.com', [1], 'Cocina']);
  await repo.save({ ...got.meta, status: 'Vendido' });
  const again = await repo.get(a.id);
  assert.deepEqual([again.meta.status, again.data.modules], ['Vendido', [1]], 'la ficha sola no borra el contenido');
  const c = await repo.duplicate(a.id);
  assert.equal((await repo.get(c.id)).data.modules[0], 1);
  await repo.remove(a.id);
  assert.equal(await repo.get(a.id), null);
});

test('sincronizado: guarda local al instante y en la nube; sin conexión queda pendiente y se sube después', async () => {
  const db = fakeDb();
  const remote = createSupabaseRepo(db, { now });
  const local = createLocalRepo(memStorage(), { now });
  const states = [];
  const repo = createSyncedRepo(remote, local, memStorage(), { onStatus: (s) => states.push(s) });
  const a = await repo.save(normalizeMeta({ name: 'Cocina' }), { modules: [1] });
  assert.equal(repo.status, 'guardado');
  assert.ok(db.rows.has(a.id), 'subió a la nube');
  db.st.offline = true;
  const b = await repo.save(normalizeMeta({ name: 'Sin conexión' }), { modules: [2] });
  assert.equal(repo.status, 'sin-conexion');
  assert.ok(!db.rows.has(b.id), 'no llegó a la nube');
  assert.deepEqual((await repo.get(b.id)).data.modules, [2], 'se sigue pudiendo abrir desde la copia local');
  assert.equal((await repo.list()).total, 2, 'la lista sale de la copia local');
  await repo.remove(a.id);
  db.st.offline = false;
  assert.equal(await repo.flush(), true);
  assert.equal(repo.status, 'guardado');
  assert.ok(db.rows.has(b.id), 'al volver la conexión se sube');
  assert.ok(!db.rows.has(a.id), 'y se aplica el borrado pendiente');
  assert.ok(states.includes('sin-conexion') && states.at(-1) === 'guardado');
});

// Storage de mentira
function fakeFiles() {
  const m = new Map();
  const st = { uploads: 0, offline: false };
  return {
    m, st,
    async upload(p, c) { if (st.offline) throw new Error('Failed to fetch'); st.uploads++; if (!m.has(p)) m.set(p, c); },
    async download(p) { if (st.offline || !m.has(p)) throw new Error('not found'); return m.get(p); },
    async removeFolder(id) { for (const k of [...m.keys()]) if (k.startsWith(`${id}/`)) m.delete(k); },
  };
}
const bigImg = `data:image/png;base64,${'A'.repeat(6000)}`;

test('Storage: la imagen va como archivo, la fila queda liviana, y vuelve al abrir', async () => {
  const db = fakeDb();
  const files = fakeFiles();
  const repo = createSupabaseRepo(db, { now, files });
  const a = await repo.save(normalizeMeta({ name: 'Con plano' }), { name: 'x', planImage: { src: bigImg, x: 0 } });
  const row = db.rows.get(a.id);
  assert.ok(row.data.planImage.src.startsWith('asset:'), 'la fila guarda la ruta');
  assert.ok(JSON.stringify(row.data).length < 500, 'fila liviana');
  assert.equal(files.m.size, 1);
  await repo.save(a, { name: 'x', planImage: { src: bigImg, x: 10 } });
  assert.equal(files.st.uploads, 1, 'el mismo archivo no se sube de nuevo');
  assert.equal((await repo.get(a.id)).data.planImage.src, bigImg, 'al abrir vuelve la imagen');
  await repo.remove(a.id);
  assert.equal(files.m.size, 0, 'al borrar el proyecto se borran sus archivos');
});

test('Storage sin conexión: abrir usa la copia local completa', async () => {
  const db = fakeDb();
  const files = fakeFiles();
  const remote = createSupabaseRepo(db, { now, files });
  const local = createLocalRepo(memStorage(), { now });
  const repo = createSyncedRepo(remote, local, memStorage());
  const a = await repo.save(normalizeMeta({ name: 'Con plano' }), { planImage: { src: bigImg } });
  files.st.offline = true; // la tabla responde pero los archivos no bajan
  assert.equal((await repo.get(a.id)).data.planImage.src, bigImg);
});

test('primera vez con la nube: sube los proyectos que estaban solo en esta compu', async () => {
  const db = fakeDb();
  const remote = createSupabaseRepo(db, { now });
  const local = createLocalRepo(memStorage(), { now });
  const x = await local.save(normalizeMeta({ name: 'Viejo' }), { modules: [9] });
  const repo = createSyncedRepo(remote, local, memStorage());
  assert.equal(await repo.uploadLocal(), 1);
  assert.deepEqual(db.rows.get(x.id).data.modules, [9]);
  assert.equal(await repo.uploadLocal(), 0, 'no vuelve a subir lo que ya está');
});
