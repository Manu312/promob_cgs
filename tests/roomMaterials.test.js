import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ROOM_MATERIALS, finishesOf, applyRoomMaterial, setFinishProps, clearFinish, copyFinish, textureRepeat, searchRoomMaterials } from '../src/domain/roomMaterials.js';
import { emptyProject } from '../src/domain/project.js';

const room = emptyProject().room;
const [w1, w2] = room.walls;

test('biblioteca propia: pinturas, revestimientos y pisos', () => {
  for (const g of ['pinturas', 'revestimientos', 'pisos']) assert.ok(ROOM_MATERIALS.some((m) => m.group === g), g);
});

test('arrastrar al piso, a la cara de una pared o a todas ("Todo")', () => {
  let r = applyRoomMaterial(room, { kind: 'floor' }, 'piso-roble');
  assert.equal(finishesOf(r).floor.mat, 'piso-roble');
  r = applyRoomMaterial(r, { kind: 'wall', wallId: w1.id }, 'rev-subway', 'cara');
  assert.deepEqual(Object.keys(finishesOf(r).walls), [w1.id]);
  r = applyRoomMaterial(r, { kind: 'wall', wallId: w1.id }, 'pint-salvia', 'todo');
  assert.ok(room.walls.every((w) => finishesOf(r).walls[w.id].mat === 'pint-salvia'));
  assert.equal(applyRoomMaterial(room, { kind: 'floor' }, 'no-existe'), room);
});

test('propiedades: escala, rotación, espejado y tonalidad; cambiar el material conserva el mapeo', () => {
  let r = applyRoomMaterial(room, { kind: 'wall', wallId: w1.id }, 'rev-subway');
  r = setFinishProps(r, { kind: 'wall', wallId: w1.id }, { scaleX: 2, rot: 450, mirrorX: true, tint: '#ff0000' });
  let f = finishesOf(r).walls[w1.id];
  assert.deepEqual([f.scaleX, f.rot, f.mirrorX, f.tint], [2, 90, true, '#ff0000']);
  r = applyRoomMaterial(r, { kind: 'wall', wallId: w1.id }, 'rev-blanco-30x60');
  f = finishesOf(r).walls[w1.id];
  assert.deepEqual([f.mat, f.scaleX, f.rot], ['rev-blanco-30x60', 2, 90]);
  assert.equal(finishesOf(clearFinish(r, { kind: 'wall', wallId: w1.id })).walls[w1.id], undefined);
});

test('copiar material de una pared a otra (o al piso)', () => {
  let r = applyRoomMaterial(room, { kind: 'wall', wallId: w1.id }, 'rev-subway');
  r = setFinishProps(r, { kind: 'wall', wallId: w1.id }, { scaleY: 1.5 });
  r = copyFinish(r, { kind: 'wall', wallId: w1.id }, { kind: 'wall', wallId: w2.id });
  assert.deepEqual(finishesOf(r).walls[w2.id], finishesOf(r).walls[w1.id]);
});

test('la textura se repite una vez por baldosa, según la escala', () => {
  const f = { mat: 'rev-blanco-30x60', scaleX: 1, scaleY: 1 };
  assert.deepEqual(textureRepeat(f, 3000, 2400), [10, 4]);
  assert.deepEqual(textureRepeat({ ...f, scaleX: 2, scaleY: 2 }, 3000, 2400), [5, 2]);
});

test('búsqueda rápida sin acentos', () => {
  assert.ok(searchRoomMaterials('marmol').some((m) => m.id === 'piso-marmol'));
  assert.equal(searchRoomMaterials('').length, ROOM_MATERIALS.length);
});
