import { state, currentSource, reloadLibrary } from '../state.js';
import * as db from '../db.js';
import { classifyPath } from './library.js';
import { songMeta } from '../chordpro/song-doc.js';
import * as paths from './song-paths.js';

/**
 * Guardar canciones de los editores en la biblioteca compartida (OneDrive o
 * la OneDrive simulada de la demostración), en la carpeta de su sección:
 *  - voces: la carpeta del cancionero o una de sus categorías (Alabanzas, Himnos…)
 *  - batería: la carpeta de batería (o una subcarpeta suya)
 * Se guardan como .pro, el formato de la biblioteca de SongBook.
 * Decidido por Nathanael el 26/11/2026.
 */

/** ¿El origen actual permite crear y guardar canciones? */
export function canSaveToLibrary(source = currentSource()) {
  return typeof source?.writeSong === 'function' && !!source.canWriteSongs;
}

/** Nombre del destino compartido para los botones («OneDrive» o «Demostración»). */
export const libraryLabel = () => (state.settings.source === 'onedrive' ? 'OneDrive' : 'Demostración');

const layoutNow = () => currentSource().layout?.() ?? null;

export const sectionFolder = (section) => paths.sectionFolder(section, layoutNow());
export const songFolders = (section) => paths.songFolders(section, state.files, layoutNow());
export const newSongPath = (section, folder, name) => paths.newSongPath(section, folder, name, layoutNow());
export const withoutFolderTags = (tags, path) => paths.withoutFolderTags(tags, path, layoutNow());
export const { editPaths, suggestFolder } = paths;

/**
 * Escribe la canción en la biblioteca compartida y la deja en el dispositivo
 * como si acabara de sincronizarse (así se ve al momento, sin esperar a
 * actualizar).
 *  create: true → no sobrescribe otra con el mismo nombre (ConflictError 'exists')
 *  ifMatch: versión conocida del archivo (si alguien lo cambió, ConflictError 'changed')
 *  replaces: archivo de la biblioteca que se sustituye (un .txt pasado a .pro)
 *  dropLocal: copias del dispositivo que dejan de hacer falta
 */
export async function saveToLibrary({ path, text, create = false, ifMatch, replaces = null, replacesEtag, dropLocal = [] }) {
  const source = currentSource();
  const info = classifyPath(path, source.layout?.() ?? null);
  if (!info || info.kind !== 'text') throw new Error(`«${path}» no es una ruta de canción válida.`);
  const { etag } = await source.writeSong(path, text, create ? { ifNoneMatch: '*' } : { ifMatch });
  if (replaces) await source.removeSong(replaces, { ifMatch: replacesEtag });
  await db.putFiles([
    {
      path,
      origin: 'remote',
      source: source.id,
      section: info.section,
      ext: info.ext,
      kind: 'text',
      depth: info.depth,
      etag,
      size: text.length,
      text,
      meta: songMeta(text, info.ext),
    },
  ]);
  const gone = [...(replaces ? [replaces] : []), ...dropLocal].filter((p) => p !== path);
  if (gone.length) await db.deleteFiles(gone);
  await reloadLibrary();
  return { path, etag };
}

/** Texto para el usuario de un error al guardar en la biblioteca compartida. */
export function libraryErrorText(e, what = 'la canción') {
  if (e?.name === 'OfflineError') return 'Sin conexión.';
  if (e?.name === 'PermissionError') return 'La sesión de OneDrive no tiene permiso para escribir. Vuelve a entrar en Ajustes → OneDrive.';
  if (e?.name === 'ConflictError') {
    if (e.reason === 'exists') return `Ya hay un archivo con ese nombre en esa carpeta. Cambia el título o elige otra carpeta.`;
    if (e.reason === 'deleted') return `Alguien ha borrado ${what} de OneDrive mientras la editabas.`;
    return `Alguien ha cambiado ${what} en OneDrive desde la última actualización. Tus cambios siguen aquí: cópialos, actualiza y vuelve a editarla.`;
  }
  return e?.message || String(e);
}
