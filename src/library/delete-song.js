import { state, currentSource, reloadLibrary } from '../state.js';
import * as db from '../db.js';
import { upcomingLists, resolveItem, deletionPaths } from './library.js';

/** Próximas listas en las que aparece la canción (para avisar antes de borrarla). */
export function listsUsing(lib, song) {
  return upcomingLists(lib).filter((l) =>
    l.items.some((it) => {
      const r = resolveItem(lib, it, song.section);
      return r.song?.key === song.key && !r.fallback;
    }),
  );
}

/** ¿Se puede borrar esta canción desde la app? (de OneDrive y con el permiso de borrar) */
export const canDeleteSong = (song) => !!song && song.origin === 'remote' && state.settings.source === 'onedrive' && !!currentSource().canDeleteSongs;

/**
 * Borra la canción de OneDrive (va a su papelera) y de este dispositivo. Si
 * alguien la cambió en OneDrive desde la última actualización, no se borra
 * (ConflictError) para no perder ese cambio.
 */
export async function deleteSong(song) {
  const source = currentSource();
  const records = new Map(state.files.map((f) => [f.path, f]));
  for (const p of deletionPaths(song)) {
    await source.removeSong(p, { ifMatch: song.kind === 'imageset' ? undefined : records.get(p)?.etag });
  }
  await db.deleteFiles(song.paths);
  for (const p of song.paths) await db.deleteBlob(p);
  await reloadLibrary();
}
