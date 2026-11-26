/**
 * Parches para iPhone/iPad con iOS 16 y 17 (Safari 16.x–17.3) y Chrome algo antiguos.
 *
 * pdf.js 6 (incluso su versión «legacy») da por hecho que el navegador trae
 * estas funciones. En Safari 16 no existen y las partituras PDF no se abrían
 * («Promise.withResolvers is not a function»). Aquí se añaden solo si faltan;
 * en navegadores modernos no se toca nada.
 *
 * Se carga en la página (src/main.js) y en el proceso que dibuja los PDF
 * (src/viewers/pdf-worker.js), así que no puede usar nada del DOM.
 */

const define = (obj, name, value) => {
  if (obj && !(name in obj)) {
    Object.defineProperty(obj, name, { value, writable: true, configurable: true, enumerable: false });
  }
};

// Safari 17.4
define(Promise, 'withResolvers', function withResolvers() {
  let resolve, reject;
  const promise = new this((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
});

// Safari 18 (Response) y 18 (Blob)
async function bytes() {
  return new Uint8Array(await this.arrayBuffer());
}
if (typeof Response !== 'undefined') define(Response.prototype, 'bytes', bytes);
if (typeof Blob !== 'undefined') define(Blob.prototype, 'bytes', bytes);

// Safari 17.4. Copia en vez de traspasar: el resultado es el mismo para pdf.js.
define(ArrayBuffer.prototype, 'transferToFixedLength', function transferToFixedLength(length = this.byteLength) {
  if (length <= this.byteLength) return this.slice(0, length);
  const out = new Uint8Array(length);
  out.set(new Uint8Array(this));
  return out.buffer;
});
define(ArrayBuffer.prototype, 'transfer', ArrayBuffer.prototype.transferToFixedLength);

// Safari 17.4
if (typeof AbortSignal !== 'undefined') {
  define(AbortSignal, 'any', function any(signals) {
    const controller = new AbortController();
    for (const signal of signals) {
      if (signal.aborted) {
        controller.abort(signal.reason);
        break;
      }
      signal.addEventListener('abort', () => controller.abort(signal.reason), {
        once: true,
        signal: controller.signal,
      });
    }
    return controller.signal;
  });
}

// `for await (… of stream)`: Safari aún no lo trae en muchas versiones.
if (typeof ReadableStream !== 'undefined') {
  async function* values({ preventCancel = false } = {}) {
    const reader = this.getReader();
    let finished = false;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          finished = true;
          return;
        }
        yield value;
      }
    } finally {
      // Si se sale antes de terminar (break o error), se cancela la descarga.
      if (!finished && !preventCancel) await reader.cancel().catch(() => {});
      reader.releaseLock();
    }
  }
  define(ReadableStream.prototype, 'values', values);
  define(ReadableStream.prototype, Symbol.asyncIterator, values);
}
