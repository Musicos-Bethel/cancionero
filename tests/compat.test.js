// Parches de compatibilidad para iOS 16/17 (src/util/compat.js).
// Node ya trae estas funciones: se quitan para simular Safari 16 y se comprueba
// que los parches las reponen y funcionan como las originales.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

const removed = [
  [Promise, 'withResolvers'],
  [Response.prototype, 'bytes'],
  [Blob.prototype, 'bytes'],
  [ArrayBuffer.prototype, 'transferToFixedLength'],
  [ArrayBuffer.prototype, 'transfer'],
  [AbortSignal, 'any'],
  [ReadableStream.prototype, 'values'],
  [ReadableStream.prototype, Symbol.asyncIterator],
];
const saved = [];

before(async () => {
  for (const [obj, name] of removed) {
    saved.push([obj, name, Object.getOwnPropertyDescriptor(obj, name)]);
    delete obj[name];
    assert.equal(name in obj, false);
  }
  await import('../src/util/compat.js?simulacion-safari16');
});

after(() => {
  for (const [obj, name, desc] of saved) {
    delete obj[name];
    if (desc) Object.defineProperty(obj, name, desc);
  }
});

test('Promise.withResolvers', async () => {
  const { promise, resolve } = Promise.withResolvers();
  resolve(7);
  assert.equal(await promise, 7);
  const r = Promise.withResolvers();
  r.reject(new Error('x'));
  await assert.rejects(r.promise, /x/);
});

test('Response.bytes y Blob.bytes devuelven Uint8Array', async () => {
  const a = await new Response('abc').bytes();
  assert.ok(a instanceof Uint8Array);
  assert.deepEqual([...a], [97, 98, 99]);
  const b = await new Blob([new Uint8Array([1, 2])]).bytes();
  assert.deepEqual([...b], [1, 2]);
});

test('ArrayBuffer.transferToFixedLength recorta y amplía', () => {
  const buf = new Uint8Array([1, 2, 3, 4]).buffer;
  assert.deepEqual([...new Uint8Array(buf.transferToFixedLength(2))], [1, 2]);
  assert.deepEqual([...new Uint8Array(buf.transferToFixedLength(6))], [1, 2, 3, 4, 0, 0]);
  assert.equal(buf.transferToFixedLength().byteLength, 4);
});

test('AbortSignal.any se cancela cuando se cancela cualquiera', () => {
  const a = new AbortController();
  const b = new AbortController();
  const s = AbortSignal.any([a.signal, b.signal]);
  assert.equal(s.aborted, false);
  b.abort('motivo');
  assert.equal(s.aborted, true);
  assert.equal(s.reason, 'motivo');
  const ya = new AbortController();
  ya.abort();
  assert.equal(AbortSignal.any([ya.signal]).aborted, true);
});

const stream = (items) =>
  new ReadableStream({
    start(c) {
      for (const i of items) c.enqueue(i);
      c.close();
    },
  });

test('for await recorre un ReadableStream', async () => {
  const out = [];
  for await (const v of stream([1, 2, 3])) out.push(v);
  assert.deepEqual(out, [1, 2, 3]);
});

test('salir antes de tiempo libera el ReadableStream', async () => {
  const s = stream([1, 2, 3]);
  for await (const v of s) if (v === 1) break;
  assert.equal(s.locked, false);
});
