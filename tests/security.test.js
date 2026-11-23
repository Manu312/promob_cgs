import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isSafeImageDataUrl, cssImageUrl, safeImageOrNull } from '../src/domain/safeData.js';
import { trySave, storageUsage, STORAGE_LIMIT_CHARS, mb } from '../src/domain/storage.js';
import { normalizeProject, emptyProject } from '../src/domain/project.js';
import { normalizeBackground, normalizeWatermark } from '../src/domain/render.js';

const PNG = 'data:image/png;base64,iVBORw0KGgo=';

test('imágenes: solo data URL de imagen en base64; nada de direcciones de internet', () => {
  assert.ok(isSafeImageDataUrl(PNG));
  for (const bad of ['https://evil.example/x.png', '//evil.example/x.png', 'data:image/svg+xml;base64,PHN2Zz4=', 'data:image/png,")}body{background:red', 'data:text/html;base64,PGI+', 'javascript:alert(1)', null, 42]) {
    assert.equal(isSafeImageDataUrl(bad), false, String(bad));
  }
  assert.equal(isSafeImageDataUrl(PNG, 10), false, 'tope de tamaño');
  assert.equal(cssImageUrl(PNG), `url("${PNG}")`);
  assert.equal(cssImageUrl('x");}*{color:red'), 'none');
  assert.equal(safeImageOrNull('https://x/y.png'), null);
});

test('proyecto importado: el plano de referencia con dirección externa se descarta', () => {
  const base = emptyProject();
  const evil = normalizeProject({ ...base, planImage: { src: 'https://evil.example/plano.png', x: 0, z: 0, wPx: 100, hPx: 100, mmPerPx: 10, visible: true } });
  assert.equal(evil.planImage, null);
  const ok = normalizeProject({ ...base, planImage: { src: PNG, x: 0, z: 0, wPx: 100, hPx: 100, mmPerPx: 10, visible: true } });
  assert.equal(ok.planImage.src, PNG);
  const nan = normalizeProject({ ...base, planImage: { src: PNG, x: 'a', z: 0, wPx: 100, hPx: 100, mmPerPx: 10 } });
  assert.equal(nan.planImage, null, 'medidas inválidas');
});

test('render: fondo y marca de agua solo con imágenes seguras', () => {
  assert.equal(normalizeBackground({ mode: 'imagen', image: 'data:image/png,")}x{' }).image, null);
  assert.equal(normalizeBackground({ mode: 'imagen', image: PNG }).image, PNG);
  assert.equal(normalizeWatermark({ image: 'https://evil.example/logo.png' }).image, null);
});

// almacenamiento de mentira, con cupo
const fakeStorage = (limit) => {
  const m = new Map();
  return {
    get length() { return m.size; },
    key: (i) => [...m.keys()][i],
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => {
      const used = [...m.entries()].filter(([kk]) => kk !== k).reduce((a, [kk, vv]) => a + kk.length + vv.length, 0);
      if (used + k.length + v.length > limit) { const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e; }
      m.set(k, v);
    },
  };
};

test('guardado: avisa si no entra o si se está por llenar', () => {
  const s = fakeStorage(1000);
  const ok = trySave(s, 'p', { a: 'x'.repeat(100) });
  assert.deepEqual([ok.ok, ok.error], [true, null]);
  const full = trySave(s, 'p', { a: 'x'.repeat(2000) });
  assert.deepEqual([full.ok, full.error, full.warn], [false, 'cupo', true]);
  assert.equal(JSON.parse(s.getItem('p')).a.length, 100, 'queda lo último que entró');
  const big = fakeStorage(STORAGE_LIMIT_CHARS * 2);
  const w = trySave(big, 'p', { a: 'x'.repeat(STORAGE_LIMIT_CHARS * 0.85) });
  assert.deepEqual([w.ok, w.warn], [true, true]);
  assert.ok(storageUsage(big) > STORAGE_LIMIT_CHARS * 0.85);
  assert.equal(mb(5_000_000), 10);
});
