import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planSync } from '../src/sync/sync.js';
import { classifyPath } from '../src/library/library.js';

const layoutOld = { root: 'Cancionero', voces: '', bateria: 'Bateria', metales: 'Metales', enlaces: 'Enlaces' };
const layoutNew = { ...layoutOld, bateria: 'Partituras batería' };
const files = [
  { path: 'Alabanzas/Te alabaré.pro', etag: 'a' },
  { path: 'Partituras batería/Te alabaré.pdf', etag: 'b' },
  { path: 'Partituras batería/Santo.cho', etag: 'c' },
];
const classify = (layout) => files.map((f) => ({ ...f, info: classifyPath(f.path, layout) }));
const stored = (layout) =>
  classify(layout).map((r) => ({ path: r.path, origin: 'remote', source: 'onedrive', etag: r.etag, ...r.info, ...(r.info.kind === 'text' ? { text: 'x' } : {}) }));

test('al cambiar las carpetas se reclasifica sin volver a descargar', () => {
  const local = stored(layoutOld);
  assert.equal(local[1].section, 'voces'); // antes: «Partituras batería» era una categoría de voces
  const plan = planSync(local, classify(layoutNew), 'onedrive');
  assert.deepEqual(plan.removed, []);
  assert.deepEqual(plan.download, []);
  assert.deepEqual(plan.reclassify.map((f) => [f.path, f.section, f.depth]), [
    ['Partituras batería/Te alabaré.pdf', 'bateria', 1],
    ['Partituras batería/Santo.cho', 'bateria', 1],
  ]);
  assert.equal(plan.reclassify[1].text, 'x'); // conserva el texto ya descargado
});

test('sin cambios no hace nada; con eTag nuevo descarga', () => {
  const local = stored(layoutNew);
  const same = planSync(local, classify(layoutNew), 'onedrive');
  assert.deepEqual([same.removed, same.download, same.reclassify], [[], [], []]);
  const changed = classify(layoutNew).map((r, i) => (i === 0 ? { ...r, etag: 'z' } : r));
  const plan = planSync(local, [...changed, { path: 'Himnos/Nuevo.cho', etag: 'n', info: classifyPath('Himnos/Nuevo.cho', layoutNew) }], 'onedrive');
  assert.deepEqual(plan.download.map((r) => r.path), ['Alabanzas/Te alabaré.pro', 'Himnos/Nuevo.cho']);
  assert.equal(plan.added, 1);
  assert.deepEqual(planSync(local, classify(layoutNew).slice(1), 'onedrive').removed, ['Alabanzas/Te alabaré.pro']);
});
