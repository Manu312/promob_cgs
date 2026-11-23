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

// Clima: sol y cielo (#100)
import { CLIMAS, DEFAULT_CLIMA, normalizeClima, applyClima, sunDirection, lightRig, azimuthFromPoint, altitudeFromPoint } from '../src/domain/render.js';

test('clima: presets como Promob y "No aplicar"; elegir amanecer o atardecer baja el sol', () => {
  assert.deepEqual(CLIMAS.map((c) => c.label), ['Luz blanca', 'Nublado', 'Amanecer', 'Neblina', 'Soleado', 'Atardecer', 'No aplicar']);
  const a = applyClima(DEFAULT_CLIMA, 'atardecer');
  assert.equal(a.preset, 'atardecer');
  assert.ok(a.altitude <= 15);
  assert.equal(applyClima(DEFAULT_CLIMA, 'xx'), DEFAULT_CLIMA);
});

test('clima: normaliza azimut (0–359) y altitud (0–90) e intensidades (0–300 %)', () => {
  const c = normalizeClima({ azimuth: -90, altitude: 120, sunIntensity: 999, skyIntensity: 'x', preset: 'raro' });
  assert.deepEqual([c.azimuth, c.altitude, c.sunIntensity, c.skyIntensity, c.preset], [270, 90, 300, 100, 'blanca']);
  assert.equal(normalizeClima({ azimuth: 725 }).azimuth, 5);
});

test('dirección del sol: azimut 0 = fondo (−z), 90 = derecha (+x); altitud 90 = cenit', () => {
  const near = (a, b) => a.every((v, i) => Math.abs(v - b[i]) < 1e-9);
  assert.ok(near(sunDirection(0, 0), [0, 0, -1]));
  assert.ok(near(sunDirection(90, 0), [1, 0, 0]));
  assert.ok(near(sunDirection(123, 90), [0, 1, 0]));
});

test('luces: intensidades en % del preset; sol apagado o "No aplicar" no ilumina', () => {
  const r = lightRig({ preset: 'soleado', sunIntensity: 50, skyIntensity: 200 });
  const p = CLIMAS.find((c) => c.id === 'soleado');
  assert.ok(Math.abs(r.sun.intensity - p.sunI / 2) < 1e-9);
  assert.ok(Math.abs(r.sky.intensity - p.skyI * 2) < 1e-9);
  assert.equal(lightRig({ sun: false }).sun.on, false);
  const n = lightRig({ preset: 'ninguno' });
  assert.deepEqual([n.sun.on, n.sky.intensity, n.ambient], [false, 0, 1]);
  assert.equal(lightRig({ ambient: false }).ambient, 0);
});

test('controles visuales: brújula (0° arriba, horario) y arco de altitud (0° horizonte, 90° cenit)', () => {
  assert.equal(azimuthFromPoint(50, 50, 50, 0), 0);
  assert.equal(azimuthFromPoint(50, 50, 100, 50), 90);
  assert.equal(azimuthFromPoint(50, 50, 50, 100), 180);
  assert.equal(azimuthFromPoint(50, 50, 0, 50), 270);
  assert.equal(altitudeFromPoint(0, 100, 100, 100), 0);
  assert.equal(altitudeFromPoint(0, 100, 0, 0), 90);
  assert.equal(altitudeFromPoint(0, 100, 50, 50), 45);
  assert.equal(altitudeFromPoint(0, 100, -10, 120), 0);
  assert.equal(altitudeFromPoint(0, 100, -10, 20), 90);
});
