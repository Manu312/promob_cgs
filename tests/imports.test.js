import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDxf, dxfSegments, segmentsToWalls, segsBounds, unitScale } from '../src/domain/dxf.js';
import { validateExternal, formatOf, gltfHasExternalRefs, addExternal, updateExternal, removeExternal, normalizeExternals, unitToMm } from '../src/domain/externals.js';

const dxf = (body, units = 4) => ['0', 'SECTION', '2', 'HEADER', '9', '$INSUNITS', '70', String(units), '0', 'ENDSEC', '0', 'SECTION', '2', 'ENTITIES', ...body, '0', 'ENDSEC', '0', 'EOF'].join('\n');
const LINE = (x0, y0, x1, y1, layer = 'MUROS') => ['0', 'LINE', '8', layer, '10', x0, '20', y0, '11', x1, '21', y1];

test('DXF: líneas, círculo, arco y polilínea por capa; unidades del encabezado', () => {
  const text = dxf([
    ...LINE(0, 0, 3000, 0), ...LINE(3000, 0, 3000, 2000), ...LINE(3000, 2000, 0, 2000), ...LINE(0, 2000, 0, 0),
    '0', 'CIRCLE', '8', 'MUEBLES', '10', '1500', '20', '1000', '40', '200',
    '0', 'ARC', '8', 'PUERTAS', '10', '0', '20', '0', '40', '800', '50', '0', '51', '90',
    '0', 'LWPOLYLINE', '8', 'MUEBLES', '90', '3', '70', '1', '10', '100', '20', '100', '10', '700', '20', '100', '10', '700', '20', '700',
  ]);
  const d = parseDxf(text);
  assert.equal(d.units, 'mm');
  assert.deepEqual(d.layers.sort(), ['MUEBLES', 'MUROS', 'PUERTAS']);
  assert.equal(d.entities.length, 7);
  const muros = dxfSegments(d, { layers: ['MUROS'] });
  assert.equal(muros.length, 4);
  assert.deepEqual(segsBounds(muros), { minX: 0, maxX: 3000, minZ: 0, maxZ: 2000 });
  assert.ok(dxfSegments(d).length > 4 + 20, 'círculo y arco en tramos');
  assert.equal(dxfSegments(d, { layers: ['MUROS'], units: 'cm' })[0].b[0], 30000);
  assert.equal(unitScale('m'), 1000);
});

test('DXF: el eje y se invierte (en planta, z crece hacia el frente)', () => {
  const d = parseDxf(dxf([...LINE(0, 0, 0, 1000)]));
  const [s] = dxfSegments(d);
  assert.deepEqual([s.a, s.b], [[0, 1000], [0, 0]]);
});

test('DXF: polilínea con bulge (arco) y POLYLINE/VERTEX', () => {
  const d = parseDxf(dxf([
    '0', 'LWPOLYLINE', '8', 'A', '90', '2', '70', '0', '10', '0', '20', '0', '42', '1', '10', '1000', '20', '0',
    '0', 'POLYLINE', '8', 'B', '70', '1', '0', 'VERTEX', '8', 'B', '10', '0', '20', '0', '0', 'VERTEX', '8', 'B', '10', '500', '20', '0', '0', 'VERTEX', '8', 'B', '10', '500', '20', '500', '0', 'SEQEND',
  ]));
  assert.equal(d.entities.length, 2);
  assert.ok(dxfSegments(d, { layers: ['A'] }).length > 5, 'semicírculo');
  assert.equal(dxfSegments(d, { layers: ['B'] }).length, 3, 'cerrada');
  assert.ok(parseDxf('basura').error);
});

test('convertir en paredes: une los extremos y descarta tramos cortos', () => {
  const segs = [{ a: [0, 0], b: [3000, 0] }, { a: [3005, 3], b: [3000, 2000] }, { a: [0, 0], b: [50, 0] }];
  const r = segmentsToWalls(segs);
  assert.equal(r.walls.length, 2);
  assert.equal(r.nodes.length, 3);
});

test('modelo 3D: formatos, tamaño y glTF sin archivos de afuera', () => {
  assert.equal(formatOf('silla.GLB'), 'glb');
  assert.equal(formatOf('x.fbx'), null);
  assert.ok(validateExternal({ name: 'a.fbx', size: 10 }).error);
  assert.ok(validateExternal({ name: 'a.obj', size: 10 * 1024 * 1024 }).error);
  assert.ok(gltfHasExternalRefs(JSON.stringify({ buffers: [{ uri: 'model.bin' }] })));
  assert.ok(!gltfHasExternalRefs(JSON.stringify({ buffers: [{ uri: 'data:application/octet-stream;base64,AAAA' }] })));
  assert.ok(validateExternal({ name: 'a.gltf', size: 100, text: JSON.stringify({ images: [{ uri: 'https://x/y.png' }] }) }).error);
  assert.deepEqual(validateExternal({ name: 'a.stl', size: 100 }), { format: 'stl' });
  assert.equal(unitToMm('cm'), 10);
});

test('entidades externas: agregar, mover, quitar y normalizar', () => {
  let p = addExternal({}, { name: 'Silla', format: 'obj', data: 'v 0 0 0', units: 'm' }, 'x1');
  p = updateExternal(p, 'x1', { x: 500, rot: 90 });
  assert.deepEqual([p.externals[0].x, p.externals[0].rot], [500, 90]);
  assert.equal(normalizeExternals([...p.externals, { id: 'bad', format: 'fbx', data: '' }, { id: 'y', format: 'stl', data: 123 }]).length, 1);
  assert.equal(removeExternal(p, 'x1').externals.length, 0);
});
