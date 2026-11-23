import { normalize, splitPath, compareEs, todayISO } from '../util/text.js';
import { parseList } from '../lists/format.js';
import { buildLinkMap, cleanLink } from '../links/links.js';

/**
 * Construye la biblioteca a partir de los archivos guardados (sin el contenido
 * binario). Todo es puro para poder probarlo fuera del navegador.
 *
 * Registro de archivo: { path, origin, section, ext, kind, etag, size, meta?, text? }
 */

/**
 * Secciones de canciones. «Metales» es un grupo con una partitura por
 * instrumento (saxofón y trompeta); las partituras que están en la carpeta
 * Metales pero fuera de la de un instrumento son «generales» y se ven en los dos.
 */
export const SECTIONS = ['voces', 'bateria', 'saxofon', 'trompeta'];
export const METALES = ['saxofon', 'trompeta'];
export const isMetal = (section) => METALES.includes(section);
export const SECTION_LABEL = { voces: 'Voces e instrumentos', bateria: 'Batería', saxofon: 'Metales · saxofón', trompeta: 'Metales · trompeta' };
export const SECTION_SHORT = { voces: 'Voces', bateria: 'Batería', saxofon: 'Saxofón', trompeta: 'Trompeta' };
/**
 * Instrumentos transpositores: semitonos que hay que subir el tono de concierto
 * (el de la lista y el de voces) para obtener el que lee cada instrumento.
 * Saxofón alto/barítono en Mi♭ (+9), tenor/soprano en Si♭ (+2); trompeta en Si♭ (+2).
 */
export const TUNING_PC = { Eb: 3, Bb: 10 };
export function instrumentTuning(section, settings = {}) {
  if (section === 'saxofon') return settings.saxTuning === 'Bb' ? 'Bb' : 'Eb';
  if (section === 'trompeta') return 'Bb';
  return null;
}
export function writtenOffset(section, settings = {}) {
  const t = instrumentTuning(section, settings);
  return t ? (12 - TUNING_PC[t]) % 12 : 0;
}

/** «Sin versión de batería», «Sin partitura de saxofón»… */
export const missingPartLabel = (section) =>
  section === 'bateria' ? 'Sin versión de batería' : `Sin partitura de ${SECTION_SHORT[section]?.toLowerCase() ?? section}`;
/** Partes de una canción además de la de voces (la de voces es la «principal»). */
export const PARTS = ['bateria', 'saxofon', 'trompeta'];
const perSection = (fn) => Object.fromEntries(SECTIONS.map((s) => [s, fn(s)]));

const TEXT_EXT = new Set(['pro', 'chordpro', 'cho', 'chopro', 'crd', 'txt']);
const IMAGE_EXT = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif']);
const LINK_EXT = new Set(['txt', 'csv', 'md', 'url', 'webloc']);
const KIND_RANK = { chordpro: 0, pdf: 1, imageset: 2, image: 2 };

export function sectionOfFolder(name) {
  const n = normalize(name);
  if (/^(voces|voz|vocal|voces e instrumentos|instrumentos)/.test(n)) return 'voces';
  if (/^(bateria|drums?|percusion)/.test(n)) return 'bateria';
  if (/^(metales|vientos?|brass|horns?)/.test(n)) return 'metales';
  if (/^(listas?|setlists?|eventos?)/.test(n)) return 'listas';
  if (/^(enlaces?|links?|youtube|videos?|audios?|escuchar)/.test(n)) return 'enlaces';
  return null;
}

/** Instrumento de una subcarpeta de Metales («Saxofón», «Sax alto», «Trompetas»…). */
export function metalOfFolder(name) {
  const n = normalize(name);
  if (/^(sax|saxo|saxofon|saxophone)/.test(n)) return 'saxofon';
  if (/^(trompetas?|trumpets?|tpt)\b/.test(n)) return 'trompeta';
  return null;
}

const segs = (p) => String(p ?? '').split('/').filter(Boolean);
const LEADER_FILE = 'ajustes-lider.json';

/**
 * Clasifica un archivo según su ruta relativa a la carpeta raíz del cancionero.
 * Devuelve { section, ext, kind, depth } o null. `depth` = número de carpetas
 * que forman la carpeta de la sección (las siguientes son categorías).
 *
 * `layout` (opcional) = { voces, bateria, enlaces, listas } con los nombres
 * reales de las carpetas; `voces: ''` significa «todo lo demás». Sin layout se
 * reconocen los nombres habituales (Voces, Batería, Listas, Enlaces…).
 */
export function classifyPath(path, layout = null) {
  const parts = segs(path);
  const { ext, base } = splitPath(path);
  if (base.startsWith('.') || base.startsWith('~') || !parts.length) return null;
  // Archivos de acordes de SongBook (Guitar.chords.txt…): no son canciones.
  if (/\.chords$/i.test(base)) return null;
  if (parts.length === 1 && normalize(parts[0]) === normalize(LEADER_FILE)) {
    return { section: 'config', ext, kind: 'config', depth: 0 };
  }

  let section = null;
  let depth = 1;
  if (layout) {
    // La carpeta configurada más larga que coincida gana (p. ej. «Himnos/Batería»).
    const candidates = ['bateria', 'metales', 'listas', 'enlaces', 'voces']
      .map((sec) => ({ sec, folder: segs(layout[sec] ?? '').map(normalize) }))
      .filter((c) => c.folder.length)
      .sort((a, b) => b.folder.length - a.folder.length);
    const norm = parts.slice(0, -1).map(normalize);
    const hit = candidates.find((c) => c.folder.every((f, i) => norm[i] === f));
    if (hit) {
      section = hit.sec;
      depth = hit.folder.length;
    } else if (!segs(layout.voces).length) {
      section = 'voces';
      depth = 0;
    }
  } else if (parts.length >= 2) {
    section = sectionOfFolder(parts[0]);
  }
  if (!section) return null;

  // Metales/<instrumento>/…: la subcarpeta del instrumento forma parte de la sección.
  if (section === 'metales') {
    const sub = parts.length - 1 > depth ? metalOfFolder(parts[depth]) : null;
    if (sub) {
      section = sub;
      depth += 1;
    }
  }

  let kind = null;
  if (section === 'listas') kind = ext === 'txt' ? 'list' : null;
  else if (section === 'enlaces') kind = LINK_EXT.has(ext) ? 'links' : null;
  else if (TEXT_EXT.has(ext)) kind = 'text';
  else if (ext === 'pdf') kind = 'pdf';
  else if (IMAGE_EXT.has(ext)) kind = 'image';
  return kind ? { section, ext, kind, depth } : null;
}

export const isBinaryKind = (kind) => kind === 'pdf' || kind === 'image';

const naturalPage = (a, b) => compareEs(splitPath(a).base, splitPath(b).base);

/**
 * Carpetas intermedias entre la carpeta de sección y el archivo = categorías
 * (así organiza SongBook las suyas). `skip` quita la carpeta de una canción de imágenes.
 */
function folderCategories(path, record, skip = 0) {
  const depth = record?.depth ?? 1;
  const dirs = path.split('/').slice((record?.origin === 'local' ? 1 : 0) + depth, -1);
  return skip ? dirs.slice(0, -skip) : dirs;
}

function makeSong(section, id, name, kind, paths, record, { imageset = false } = {}) {
  const meta = record?.meta ?? {};
  const title = meta.title || name;
  const categories = [...new Set([...folderCategories(paths[0], record, imageset ? 1 : 0), ...(meta.tags ?? [])])];
  return {
    key: `${section}:${id}`,
    id,
    section,
    name,
    title,
    artist: meta.artist || '',
    songKey: meta.key || '',
    tempo: meta.tempo || '',
    bateria: meta.bateria || '',
    kind, // 'chordpro' | 'pdf' | 'image' | 'imageset'
    paths,
    path: paths[0],
    ext: record?.ext ?? '',
    origin: record?.origin ?? 'remote',
    sortTitle: title.replace(/^[^\p{L}\p{N}]+/u, ''),
    search: normalize(`${title} ${meta.artist || ''} ${name}`),
    categories,
    link: cleanLink(meta.link || ''),
  };
}

export function buildLibrary(files, { today = todayISO() } = {}) {
  const lib = {
    songs: perSection(() => []),
    byId: perSection(() => new Map()),
    byTitle: perSection(() => new Map()),
    lists: [],
    duplicates: [],
    linkMap: new Map(),
  };

  // Agrupa por carpeta para detectar canciones hechas de varias imágenes.
  const folders = new Map();
  for (const f of files) {
    if (!SECTIONS.includes(f.section) && f.section !== 'metales') continue;
    const dir = splitPath(f.path).dir;
    if (!folders.has(dir)) folders.set(dir, []);
    folders.get(dir).push(f);
  }

  const candidates = perSection(() => []);
  // Las partituras generales de metales van a los dos instrumentos.
  const push = (section, song) => {
    if (section !== 'metales') return candidates[section].push(song);
    for (const m of METALES) candidates[m].push({ ...song, key: `${m}:${song.id}`, section: m, general: true });
  };
  for (const [dir, group] of folders) {
    const level = dir ? dir.split('/').length : 0;
    const onlyImages = group.every((f) => f.kind === 'image');
    // Carpeta de la sección: local/<Sección> para los importados; si no, según `depth`.
    const sectionDepth = (group[0].origin === 'local' ? 1 : 0) + (group[0].depth ?? 1);
    if (level > sectionDepth && onlyImages) {
      const name = dir.split('/').pop();
      const paths = group.map((f) => f.path).sort(naturalPage);
      push(group[0].section, makeSong(group[0].section, normalize(name), name, 'imageset', paths, group[0], { imageset: true }));
      continue;
    }
    for (const f of group) {
      const name = splitPath(f.path).base;
      const kind = f.kind === 'text' ? 'chordpro' : f.kind;
      push(f.section, makeSong(f.section, normalize(name), name, kind, [f.path], f));
    }
  }

  for (const section of SECTIONS) {
    // Preferencias ante nombres repetidos: local > remoto, la del instrumento >
    // la general de metales, texto > PDF > imagen.
    candidates[section].sort(
      (a, b) =>
        (a.origin === 'local' ? 0 : 1) - (b.origin === 'local' ? 0 : 1) ||
        (a.general ? 1 : 0) - (b.general ? 1 : 0) ||
        KIND_RANK[a.kind] - KIND_RANK[b.kind] ||
        compareEs(a.path, b.path),
    );
    for (const s of candidates[section]) {
      if (lib.byId[section].has(s.id)) {
        if (!s.general) lib.duplicates.push(s);
        continue;
      }
      lib.byId[section].set(s.id, s);
      const t = normalize(s.title);
      if (t && !lib.byTitle[section].has(t)) lib.byTitle[section].set(t, s);
      lib.songs[section].push(s);
    }
    lib.songs[section].sort((a, b) => compareEs(a.sortTitle, b.sortTitle));
  }

  // Enlaces de la carpeta Enlaces/ y categorías heredadas por la batería.
  lib.linkMap = buildLinkMap(
    files.filter((f) => f.section === 'enlaces' && typeof f.text === 'string').map((f) => ({ ...f, base: splitPath(f.path).base })),
  );
  for (const s of lib.songs.voces) {
    s.link ||= lib.linkMap.get(s.id) || lib.linkMap.get(normalize(s.title)) || '';
  }
  for (const part of PARTS) {
    for (const s of lib.songs[part]) {
      const v = vocesVersion(lib, s);
      if (v) s.categories = [...new Set([...s.categories, ...v.categories])];
      s.link ||= v?.link || lib.linkMap.get(s.id) || lib.linkMap.get(normalize(s.title)) || '';
    }
  }

  for (const f of files) {
    if (f.section !== 'listas' || typeof f.text !== 'string') continue;
    const base = splitPath(f.path).base;
    const list = parseList(f.text, base);
    lib.lists.push({ ...list, id: f.path, path: f.path, pending: f.pending ?? null, etag: f.etag ?? null });
  }
  sortLists(lib.lists, today);
  return lib;
}

/** Próximas (fecha ascendente) primero, después sin fecha, después pasadas (más reciente primero). */
export function sortLists(lists, today = todayISO()) {
  const rank = (l) => (!l.date ? 1 : l.date >= today ? 0 : 2);
  lists.sort((a, b) => {
    const r = rank(a) - rank(b);
    if (r) return r;
    if (rank(a) === 0) return a.date.localeCompare(b.date) || compareEs(a.name, b.name);
    if (rank(a) === 2) return b.date.localeCompare(a.date) || compareEs(a.name, b.name);
    return compareEs(a.name, b.name);
  });
  return lists;
}

export function upcomingLists(lib, today = todayISO()) {
  return lib.lists.filter((l) => l.date && l.date >= today);
}

export function nextEvent(lib, today = todayISO()) {
  return upcomingLists(lib, today)[0] ?? null;
}

export function findSong(lib, section, nameOrId) {
  const n = normalize(nameOrId);
  return lib.byId[section].get(n) ?? lib.byTitle[section].get(n) ?? null;
}

/** Partitura de otra sección (batería, saxofón, trompeta) de una canción de voces. */
export function partVersion(lib, vocesSong, part) {
  if (!vocesSong || !lib.byId[part]) return null;
  if (part === 'bateria' && vocesSong.bateria) {
    const s = findSong(lib, 'bateria', vocesSong.bateria);
    if (s) return s;
  }
  return lib.byId[part].get(vocesSong.id) ?? lib.byTitle[part].get(normalize(vocesSong.title)) ?? null;
}

/** Versión de batería de una canción de voces. */
export const drumVersion = (lib, vocesSong) => partVersion(lib, vocesSong, 'bateria');

/** Canción de voces correspondiente a una partitura de batería o de metales. */
export function vocesVersion(lib, partSong) {
  if (!partSong) return null;
  if (partSong.section === 'bateria' || !partSong.section) {
    for (const s of lib.songs.voces) {
      if (s.bateria && normalize(s.bateria) === partSong.id) return s;
    }
  }
  return lib.byId.voces.get(partSong.id) ?? lib.byTitle.voces.get(normalize(partSong.title)) ?? null;
}

/**
 * Resuelve un elemento de lista para una sección.
 * Devuelve { song, fallback } — fallback=true si en Batería o Metales se
 * muestra la versión de voces porque no hay partitura propia.
 */
export function resolveItem(lib, item, section) {
  const voces = findSong(lib, 'voces', item.name);
  if (section === 'voces' || !lib.byId[section]) return { song: voces, fallback: false };
  const part = (voces && partVersion(lib, voces, section)) || findSong(lib, section, item.name);
  if (part) return { song: part, fallback: false };
  return { song: voces, fallback: !!voces };
}

export const ALL = '__todas__';
export const NONE = '__sin__';

/**
 * Categorías de una sección con su número de canciones:
 * [{ id, label, count }] empezando por «Todas» y «Sin categoría».
 */
export function categoriesOf(lib, section) {
  const songs = lib.songs[section];
  const counts = new Map();
  let none = 0;
  for (const s of songs) {
    if (!s.categories.length) none++;
    for (const c of s.categories) {
      const k = normalize(c);
      const cur = counts.get(k);
      if (cur) cur.count++;
      else counts.set(k, { id: k, label: c, count: 1 });
    }
  }
  const list = [...counts.values()].sort((a, b) => compareEs(a.label, b.label));
  return [{ id: ALL, label: 'Todas', count: songs.length }, { id: NONE, label: 'Sin categoría', count: none }, ...list];
}

export function inCategory(song, cat) {
  if (!cat || cat === ALL) return true;
  if (cat === NONE) return !song.categories.length;
  return song.categories.some((c) => normalize(c) === cat);
}

export function searchSongs(lib, section, query, category = ALL) {
  const q = normalize(query);
  const all = lib.songs[section].filter((s) => inCategory(s, category));
  if (!q) return all;
  const words = q.split(' ');
  return all.filter((s) => words.every((w) => s.search.includes(w)));
}

/** Datos para la pantalla de revisión de nombres. */
export function linkReport(lib) {
  const drumsLinked = new Set();
  const vocesSinBateria = [];
  for (const s of lib.songs.voces) {
    const d = drumVersion(lib, s);
    if (d) drumsLinked.add(d.key);
    else vocesSinBateria.push(s);
  }
  const bateriaSinVoces = lib.songs.bateria.filter((s) => !drumsLinked.has(s.key));
  const metalesSinVoces = METALES.flatMap((m) => lib.songs[m].filter((s) => !s.general && !vocesVersion(lib, s)));
  const noEncontradas = [];
  for (const l of lib.lists) {
    for (const it of l.items) {
      if (!resolveItem(lib, it, 'voces').song && !PARTS.some((p) => findSong(lib, p, it.name))) {
        noEncontradas.push({ list: l, item: it });
      }
    }
  }
  return { vocesSinBateria, bateriaSinVoces, metalesSinVoces, noEncontradas, duplicados: lib.duplicates };
}
