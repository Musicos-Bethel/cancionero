// Proceso que dibuja los PDF: primero los parches para iOS 16/17 y después pdf.js.
// Los import se ejecutan en orden, así que los parches ya están cuando arranca pdf.js.
import '../util/compat.js';
import { WorkerMessageHandler } from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs';

// pdf.js arranca solo al cargarse en un worker; esta línea evita que el
// empaquetador lo descarte y deja el mismo acceso global que el original.
globalThis.pdfjsWorker = { WorkerMessageHandler };
