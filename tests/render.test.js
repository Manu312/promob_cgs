import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_RENDER, normalizeRender, qualityOf, renderSize, setCustomSide, fitRect, renderFov, MAX_SIDE, MIN_SIDE } from '../src/domain/render.js';

test('normalizeRender: proyecto viejo sin configuración toma los valores por defecto', () => {
  assert.deepEqual(normalizeRender(undefined), DEFAULT_RENDER);
  const r = normalizeRender({ quality: 'xx', size: { mode: 'raro', width: 99999, height: 3 }, samples: { final: -2 } });
  assert.equal(r.quality, 'final');
  assert.equal(r.size.mode, 'ambiente');
  assert.equal(r.size.width, MAX_SIDE);
  assert.equal(r.size.height, MIN_SIDE);
  assert.equal(r.samples.final, 400);
});

test('calidad: el rápido es rasterizado; final y profesional trazan rayos con muestras y rebotes configurables', () => {
  assert.equal(qualityOf(normalizeRender({ quality: 'rapido' })).pathTrace, false);
  const f = qualityOf(normalizeRender({ quality: 'final' }));
  assert.deepEqual([f.pathTrace, f.samples, f.bounces], [true, 400, 6]);
  const p = qualityOf(normalizeRender({ quality: 'profesional', samples: { profesional: 2000 } }));
  assert.deepEqual([p.samples, p.bounces], [2000, 10]);
});

test('dimensión: Ambiente 3D usa la vista, preconfigurado su medida, personalizada la del usuario', () => {
  const view = { width: 1000, height: 600 };
  assert.deepEqual(renderSize(normalizeRender({}), view), view);
  assert.deepEqual(renderSize(normalizeRender({ size: { mode: 'preset', preset: 'hd' } }), view), { width: 1280, height: 720 });
  assert.deepEqual(renderSize(normalizeRender({ size: { mode: 'custom', width: 800, height: 800 } }), view), { width: 800, height: 800 });
});

test('proporción trabada: cambiar el ancho ajusta el alto (y al revés); destrabada no', () => {
  const s = { mode: 'custom', width: 1920, height: 1080, lock: true };
  assert.deepEqual([setCustomSide(s, 'width', 800).width, setCustomSide(s, 'width', 800).height], [800, 450]);
  assert.equal(setCustomSide(s, 'height', 540).width, 960);
  assert.equal(setCustomSide({ ...s, lock: false }, 'width', 800).height, 1080);
  assert.equal(setCustomSide(s, 'width', 10).width, MIN_SIDE);
});

test('área del render: rectángulo más grande con la proporción pedida, centrado en la vista', () => {
  assert.deepEqual(fitRect(16 / 9, 1600, 1000), { x: 0, y: 50, w: 1600, h: 900 });
  assert.deepEqual(fitRect(1, 1600, 1000), { x: 300, y: 0, w: 1000, h: 1000 });
});

test('cámara del render: con el área a todo el alto conserva el FOV; con medio alto lo achica', () => {
  assert.ok(Math.abs(renderFov(45, 1) - 45) < 1e-9);
  const f = renderFov(45, 0.5);
  assert.ok(Math.abs(Math.tan((f * Math.PI) / 360) - Math.tan((45 * Math.PI) / 360) / 2) < 1e-9);
});
