import { classifyPath } from './library.js';
import { normalize, compareEs } from '../util/text.js';

/**
 * Rutas de las canciones que se guardan desde los editores en la biblioteca
 * compartida (sin depender del estado de la app, para poder probarlas).
 * `layout` = estructura de carpetas del origen (null en la demostración).
 */

/** Formatos de texto que se guardan tal cual (los demás pasan a .pro). */
const CHORDPRO_EXT = new Set(['pro', 'cho', 'chopro', 'chordpro', 'crd']);
/** Carpetas de sección cuando el origen no tiene estructura configurable (demostración). */
const DEFAULT_FOLDERS = { voces: 'Voces', bateria: 'Bateria' };

const segs = (p) => String(p ?? '').split('/').filter(Boolean);
const joinPath = (...p) => p.flatMap(segs).join('/');

/** Carpeta (ruta lógica) de una sección según la estructura del origen. */
export function sectionFolder(section, layout = null) {
  if (layout && section in layout) return segs(layout[section]).join('/');
  return DEFAULT_FOLDERS[section] ?? '';
}

/**
 * Subcarpetas (categorías) que ya existen en la sección, sacadas de los
 * archivos del dispositivo. Las carpetas de canciones de imágenes no cuentan.
 */
export function songFolders(section, files, layout = null) {
  const base = segs(sectionFolder(section, layout)).length;
  const found = new Map();
  for (const f of files) {
    if (f.origin !== 'remote' || f.section !== section || f.kind === 'image') continue;
    const parts = segs(f.path);
    const depth = f.depth ?? base;
    if (parts.length - 1 > depth) found.set(normalize(parts[depth]), parts[depth]);
  }
  return [...found.values()].sort(compareEs);
}

/** Ruta de una canción nueva: carpeta de la sección / categoría / nombre.pro */
export const newSongPath = (section, folder, name, layout) => joinPath(sectionFolder(section, layout), folder, `${name}.pro`);

/** Categorías que da la carpeta de una ruta (las que van entre la sección y el archivo). */
export function folderCategoriesOf(path, layout = null) {
  const info = classifyPath(path, layout);
  if (!info) return [];
  return segs(path).slice(info.depth, -1);
}

/**
 * Dónde se guarda una canción que ya está en la biblioteca: en el mismo
 * archivo si es ChordPro; si es .txt, en un .pro al lado (y el .txt se quita).
 */
export function editPaths(file) {
  if (CHORDPRO_EXT.has(file.ext)) return { path: file.path, replaces: null };
  return { path: file.path.replace(/\.[^./]+$/, '') + '.pro', replaces: file.path };
}

/** Quita de las categorías las que ya da la carpeta (no hace falta repetirlas en el archivo). */
export function withoutFolderTags(tags, path, layout) {
  const fromFolder = new Set(folderCategoriesOf(path, layout).map(normalize));
  return (tags ?? []).filter((t) => !fromFolder.has(normalize(t)));
}

/** Carpeta que se propone para una canción nueva: la que coincida con una de sus categorías. */
export function suggestFolder(tags, folders) {
  const byNorm = new Map(folders.map((f) => [normalize(f), f]));
  for (const t of tags ?? []) if (byNorm.has(normalize(t))) return byNorm.get(normalize(t));
  return '';
}

