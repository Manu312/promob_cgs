import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractAssets, injectAssets, assetRefs, contentHash, isAssetRef } from '../src/domain/assets.js';

const big = (c) => `data:image/png;base64,${c.repeat(3000)}`;

test('saca el plano, el fondo y los modelos 3D; lo chico queda adentro', () => {
  const p = {
    name: 'x',
    planImage: { src: big('A'), x: 0 },
    render: { background: { mode: 'imagen', image: big('B') } },
    externals: [{ id: 'm', format: 'obj', data: 'v 0 0 0\n'.repeat(400) }, { id: 'n', format: 'obj', data: 'v 1 1 1' }],
  };
  const { project, files } = extractAssets(p, 'p1');
  assert.equal(files.length, 3);
  assert.ok(isAssetRef(project.planImage.src) && project.planImage.src.endsWith('.png'));
  assert.ok(isAssetRef(project.render.background.image));
  assert.ok(isAssetRef(project.externals[0].data) && project.externals[0].data.endsWith('.txt'));
  assert.equal(project.externals[1].data, 'v 1 1 1', 'chico: queda adentro');
  assert.equal(p.planImage.src.startsWith('data:'), true, 'no toca el original');
  assert.ok(files.every((f) => f.path.startsWith('p1/')));
  assert.deepEqual(assetRefs(project).sort(), files.map((f) => f.path).sort());
});

test('el mismo contenido da la misma ruta (no se sube dos veces)', () => {
  const a = extractAssets({ planImage: { src: big('A') } }, 'p1').files[0].path;
  const b = extractAssets({ planImage: { src: big('A') } }, 'p1').files[0].path;
  const c = extractAssets({ planImage: { src: big('C') } }, 'p1').files[0].path;
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.notEqual(contentHash('ab'), contentHash('ba'));
});

test('al abrir vuelven los archivos; si falta uno queda vacío', () => {
  const p = { planImage: { src: big('A') }, externals: [{ data: 'v 0 0 0\n'.repeat(400) }] };
  const { project, files } = extractAssets(p, 'p1');
  const back = injectAssets(project, new Map(files.map((f) => [f.path, f.content])));
  assert.deepEqual(back, p);
  const missing = injectAssets(project, new Map());
  assert.equal(missing.planImage.src, null);
  assert.deepEqual(extractAssets({ name: 'sin archivos' }, 'p1').files, []);
});
