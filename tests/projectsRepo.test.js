import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeMeta, queryProjects, duplicateMeta, createLocalRepo, adoptOpenProject, PAGE_SIZE } from '../src/domain/projectsRepo.js';

const memStorage = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), _m: m };
};
let clock = 0;
const now = () => new Date(Date.UTC(2026, 10, 23, 12, 0, clock++)).toISOString();

test('ficha: normaliza lo que venga (listas cerradas, fechas, etiquetas)', () => {
  const m = normalizeMeta({ name: '  Cocina Pérez ', client: 'Ana Pérez', type: 'Nave espacial', status: 'Vendido', closeBy: '2026-12-01', delivery: 'mañana', tags: 'Urgente, roble,urgente , ' });
  assert.deepEqual([m.name, m.type, m.status, m.stage, m.closeBy, m.delivery, m.tags], ['Cocina Pérez', 'Cocina', 'Vendido', 'Diseño', '2026-12-01', '', ['urgente', 'roble']]);
  assert.ok(m.id && m.createdAt && m.updatedAt);
  assert.equal(normalizeMeta({}).name, 'Proyecto sin nombre');
});

test('buscar sin acentos y en todas las palabras; ordenar; paginar', () => {
  const metas = [
    normalizeMeta({ id: 'a', name: 'Cocina Pérez', client: 'Ana', updatedAt: '2026-11-20T10:00:00Z', createdAt: '2026-11-01T00:00:00Z', tags: ['roble'] }),
    normalizeMeta({ id: 'b', name: 'Placard Gómez', client: 'Beto', type: 'Placard', updatedAt: '2026-11-22T10:00:00Z', createdAt: '2026-11-02T00:00:00Z', closeBy: '2026-12-10' }),
    normalizeMeta({ id: 'c', name: 'baño López', client: 'Carla', type: 'Baño', updatedAt: '2026-11-21T10:00:00Z', createdAt: '2026-11-03T00:00:00Z', closeBy: '2026-12-01' }),
  ];
  assert.deepEqual(queryProjects(metas).items.map((m) => m.id), ['b', 'c', 'a'], 'última modificación primero');
  assert.deepEqual(queryProjects(metas, { search: 'perez' }).items.map((m) => m.id), ['a']);
  assert.deepEqual(queryProjects(metas, { search: 'cocina roble' }).items.map((m) => m.id), ['a']);
  assert.deepEqual(queryProjects(metas, { search: 'cocina beto' }).items.map((m) => m.id), []);
  assert.deepEqual(queryProjects(metas, { sort: 'nombre' }).items.map((m) => m.id), ['c', 'a', 'b']);
  assert.deepEqual(queryProjects(metas, { sort: 'cierre' }).items.map((m) => m.id), ['c', 'b', 'a']);
  const many = Array.from({ length: 23 }, (_, i) => normalizeMeta({ id: `x${i}`, name: `P${i}` }));
  const r = queryProjects(many, { page: 2 });
  assert.deepEqual([r.pages, r.page, r.items.length, r.total], [3, 2, 23 - 2 * PAGE_SIZE, 23]);
  assert.equal(queryProjects(many, { page: 99 }).page, 2);
});

test('copia: ficha nueva con "(copia)"', () => {
  const m = normalizeMeta({ id: 'a', name: 'Cocina' });
  const d = duplicateMeta(m);
  assert.notEqual(d.id, 'a');
  assert.equal(d.name, 'Cocina (copia)');
});

test('repositorio local: guardar, listar, abrir, duplicar, borrar', async () => {
  const st = memStorage();
  const repo = createLocalRepo(st, { now, user: 'ana@mail.com' });
  const a = await repo.save(normalizeMeta({ name: 'Cocina' }), { name: 'x', modules: [1] });
  const b = await repo.save(normalizeMeta({ name: 'Placard' }), { name: 'y', modules: [] });
  assert.equal((await repo.list()).items[0].id, b.id, 'el último guardado primero');
  const got = await repo.get(a.id);
  assert.deepEqual([got.meta.name, got.data.name, got.data.modules], ['Cocina', 'Cocina', [1]], 'el nombre de la ficha manda');
  assert.equal(got.meta.updatedBy, 'ana@mail.com');
  const c = await repo.duplicate(a.id);
  assert.equal(c.name, 'Cocina (copia)');
  assert.deepEqual((await repo.get(c.id)).data.modules, [1]);
  await repo.save({ ...got.meta, status: 'Vendido' });
  assert.equal((await repo.get(a.id)).meta.status, 'Vendido');
  assert.deepEqual((await repo.get(a.id)).data.modules, [1], 'guardar solo la ficha no toca el contenido');
  await repo.remove(b.id);
  assert.equal((await repo.list()).total, 2);
  assert.equal(await repo.get(b.id), null);
  assert.ok(!st._m.has(`mueblesapp.projects.${b.id}`));
});

test('la primera vez, el proyecto abierto pasa a la lista', async () => {
  const repo = createLocalRepo(memStorage(), { now });
  const id = await adoptOpenProject(repo, { name: 'Cocina de ejemplo', modules: [] });
  const all = await repo.all();
  assert.deepEqual([all.length, all[0].id, all[0].name], [1, id, 'Cocina de ejemplo']);
  assert.equal(await adoptOpenProject(repo, { name: 'otro' }), id, 'no lo duplica');
  assert.equal(await adoptOpenProject(repo, { name: 'otro' }, { currentId: 'zz' }), 'zz');
});
