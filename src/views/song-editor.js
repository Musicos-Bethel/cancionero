import { h, clear } from '../ui/dom.js';
import { goBackTo, replaceTo } from '../nav.js';
import { icon } from '../ui/icons.js';
import { toast } from '../ui/toast.js';
import { confirmDialog, openSheet } from '../ui/dialog.js';
import { state, emitChange, reloadLibrary } from '../state.js';
import * as db from '../db.js';
import { categoriesOf, ALL, NONE } from '../library/library.js';
import { parseKey } from '../music/chords.js';
import { makeChordTransformer } from '../music/transpose.js';
import { loadSongDoc, songMeta } from '../chordpro/song-doc.js';
import { renderSong } from '../viewers/chordpro-view.js';
import { splitSongFile, buildSongFile, chordProToPlain, plainToBody, emptySong, validateSong } from '../chordpro/compose.js';
import { songChords, keyChords, validChord, wrapLines, insertLine, highlightTokens, SECTION_NAMES } from '../chordpro/editor-tools.js';
import { safeName } from '../chordpro/split.js';
import { normalize } from '../util/text.js';
import { link, emptyState } from '../ui/components.js';
import { isLeader } from '../leader/leader.js';
import { requestLeader } from '../leader/leader-ui.js';
import { shareOrDownload } from '../features/backup.js';
import { timeAgo } from '../ui/format.js';
import { canSaveToLibrary, libraryLabel, saveToLibrary, newSongPath, editPaths, withoutFolderTags, libraryErrorText } from '../library/save-song.js';
import { saveTargetCard, pickFolder } from '../ui/save-target.js';

const DRAFT_KEY = 'cancion-borrador';
/** Origen de las canciones creadas con el editor (las importadas son 'local'). */
export const EDITOR_SOURCE = 'editor';

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const MODE_KEY = 'editor-modo';
const readMode = () => {
  try {
    const m = localStorage.getItem(MODE_KEY);
    return m === 'plain' || m === 'chordpro' ? m : 'chordpro';
  } catch {
    return 'chordpro';
  }
};

const CHORDPRO_PLACEHOLDER = `{c: Intro } {soh} 2x {eoh}
[G]   [C]   [D]

{c: Estrofa}
[G]Castillo [C]fuerte es [D]nuestro [G]Dios

{c: Coro}
{soc}
[C]Escribe el acorde [G]antes de su sílaba
{eoc}`;

const PLACEHOLDER = `Estrofa 1
C        G         Am      F
Castillo fuerte es nuestro Dios,

Coro
F         C        G
Escribe los acordes encima de la letra`;

/**
 * Editor de canciones de voces (modo líder). Se escribe como en papel, con los
 * acordes encima de la letra, y se guarda en ChordPro (el formato de SongBook).
 *
 *  id = null → canción nueva; id = id de una canción de voces → editarla.
 *
 * Dónde se guarda (26/11/2026):
 *  - canción nueva: en OneDrive (por defecto, en la carpeta que se elija, como .pro)
 *    o solo en este dispositivo (origin 'local', source 'editor');
 *  - canción de OneDrive: en su mismo archivo (con If-Match);
 *  - canción del dispositivo: en el dispositivo, con «Subir a OneDrive». Si
 *    tapa una de la biblioteca (mismo nombre), al subirla la sustituye.
 * Sin conexión se ofrece guardar en el dispositivo.
 */
export function SongEditorView({ id }) {
  const lib = state.library;
  const el = h('div.view.song-editor');

  if (!isLeader()) {
    el.append(
      emptyState(
        'Solo en modo líder',
        'Para crear o editar canciones hace falta el PIN de líder.',
        h('button.btn.primary', { onclick: async () => (await requestLeader()) && dispatchEvent(new HashChangeEvent('hashchange')) }, icon('lock', { size: 18 }), 'Entrar en modo líder'),
      ),
    );
    return { el };
  }

  const original = id ? lib.byId.voces.get(id) : null;
  if (id && (!original || original.kind !== 'chordpro')) {
    el.append(
      emptyState(
        original ? 'Esta canción no se puede editar' : 'Canción no encontrada',
        original ? 'Solo se editan canciones de texto con acordes (no PDF ni imágenes).' : 'Puede que se haya borrado o renombrado.',
        h('a.btn.primary', { href: link('/canciones') }, 'Volver'),
      ),
    );
    return { el };
  }
  const file = original ? state.files.find((f) => f.path === original.path) : null;
  const isOwnLocal = file?.origin === 'local';
  // ¿Esta copia del dispositivo tapa una canción de la biblioteca compartida?
  const baseId = (p) => normalize(p.split('/').pop().replace(/\.[^.]+$/, ''));
  const sharedCopy = isOwnLocal ? state.files.find((f) => f.origin === 'remote' && f.section === 'voces' && baseId(f.path) === original.id) : null;

  let initial;
  if (original) {
    const fields = splitSongFile(file?.ext === 'txt' ? plainToBody(file.text ?? '') : file?.text ?? '');
    // Las categorías que venían de la carpeta pasan a {tag: …}: la copia del
    // dispositivo no está en esa carpeta.
    const tags = [...fields.tags];
    for (const c of original.categories) if (!tags.some((t) => normalize(t) === normalize(c))) tags.push(c);
    initial = { ...fields, tags, title: fields.title || original.title };
  } else {
    initial = emptySong();
  }
  // El texto de la canción se guarda siempre en ChordPro (draft.body): así lo
  // que se escribe en el modo ChordPro no se toca al guardar.
  let draft = structuredClone(initial);
  const dirty = () => !same(draft, initial);
  let mode = readMode(); // 'chordpro' | 'plain' | 'preview'

  // ---------- Dónde se guarda (OneDrive o este dispositivo)
  const saveTarget = saveTargetCard({
    kind: file?.origin === 'remote' ? 'remote' : isOwnLocal ? 'local' : 'new',
    section: 'voces',
    path: file?.path ?? '',
    tags: draft.tags,
    onUpload: () => upload(),
    uploadLabel: sharedCopy ? `Subir mis cambios a ${libraryLabel()}` : undefined,
  });

  // ---------- Borrador (por si se cierra la app a mitad)
  let saveTimer;
  function persistDraft() {
    clearTimeout(saveTimer);
    state.editingDirty = dirty();
    saveTarget.setTags(draft.tags);
    saveTimer = setTimeout(() => {
      if (dirty()) db.kvSet(DRAFT_KEY, { id: id ?? null, draft, at: Date.now() });
      else db.kvDelete(DRAFT_KEY);
    }, 300);
  }
  const dropDraft = () => {
    clearTimeout(saveTimer);
    state.editingDirty = false;
    return db.kvDelete(DRAFT_KEY);
  };

  // ---------- Cabecera
  const backHref = original ? link(`/cancion/voces/${encodeURIComponent(original.id)}`) : link('/canciones');
  const goBack = async () => {
    if (dirty() && !(await confirmDialog({ title: '¿Descartar los cambios?', text: 'Los cambios de esta canción no se han guardado.', confirm: 'Descartar', danger: true }))) return;
    await dropDraft();
    goBackTo(backHref);
  };
  const recover = h('div.recover-slot');
  el.append(
    h('button.back-link', { onclick: goBack }, icon('back', { size: 18 }), original ? 'Canción' : 'Canciones'),
    h(
      'header.page-head',
      h('h1', original ? 'Editar canción' : 'Nueva canción'),
      h(
        'p.page-sub',
        canSaveToLibrary()
          ? `Abajo eliges si se guarda en ${libraryLabel()} (para toda la banda) o solo en este dispositivo.`
          : 'Se guarda en este dispositivo. Para compartirla, usa «Exportar .cho» y súbela a la carpeta del cancionero en OneDrive.',
      ),
    ),
    recover,
  );

  // ---------- Datos
  const fields = h('section.form-card');
  const msg = h('p.form-msg', { role: 'alert' });
  function renderFields() {
    clear(fields);
    const input = (key, attrs) =>
      h('input', {
        ...attrs,
        value: draft[key],
        oninput: (e) => {
          draft[key] = e.target.value;
          if (key === 'key') {
            keyWarn();
            renderPalette();
          }
          persistDraft();
        },
      });
    const keyMsg = h('small.key-msg');
    function keyWarn() {
      keyMsg.textContent = draft.key.trim() && !parseKey(draft.key.trim()) ? ' · no se reconoce' : '';
    }
    const tagsInput = h('input', {
      type: 'text',
      value: draft.tags.join(', '),
      placeholder: 'Himnos, Alabanzas…',
      autocomplete: 'off',
      oninput: (e) => {
        draft.tags = e.target.value.split(/[,;]/).map((t) => t.trim()).filter(Boolean);
        renderTagChips();
        persistDraft();
      },
    });
    const tagChips = h('div.tag-suggest');
    function renderTagChips() {
      const have = new Set(draft.tags.map(normalize));
      const cats = categoriesOf(lib, 'voces').filter((c) => c.id !== ALL && c.id !== NONE && !have.has(c.id));
      tagChips.replaceChildren(
        ...cats.slice(0, 12).map((c) =>
          h(
            'button.cat-chip',
            {
              type: 'button',
              onclick: () => {
                draft.tags = [...draft.tags, c.label];
                tagsInput.value = draft.tags.join(', ');
                renderTagChips();
                persistDraft();
              },
            },
            '+ ',
            c.label,
          ),
        ),
      );
    }
    fields.append(
      h('label.field', h('span', 'Título'), input('title', { type: 'text', placeholder: 'Castillo fuerte es nuestro Dios', autocomplete: 'off', enterkeyhint: 'next', maxlength: '120' })),
      h('label.field', h('span', 'Autor ', h('small', '(opcional)')), input('artist', { type: 'text', autocomplete: 'off', enterkeyhint: 'next', maxlength: '120' })),
      h(
        'div.field-row.half',
        h('label.field', h('span', 'Tono', keyMsg), input('key', { type: 'text', placeholder: 'G, Em, Re…', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', maxlength: '8' })),
        h('label.field', h('span', 'Tempo ', h('small', '(bpm)')), input('tempo', { type: 'text', inputmode: 'numeric', placeholder: '72', maxlength: '4' })),
      ),
      h(
        'div.field-row.half',
        h('label.field', h('span', 'Compás'), input('time', { type: 'text', placeholder: '4/4', maxlength: '6' })),
        h('label.field', h('span', 'Duración'), input('duration', { type: 'text', inputmode: 'decimal', placeholder: '4:30', maxlength: '5' })),
      ),
      h('label.field', h('span', 'Categorías ', h('small', '(separadas por comas)')), tagsInput),
      tagChips,
      h('label.field', h('span', 'Enlace para escuchar ', h('small', '(YouTube, opcional)')), input('link', { type: 'url', placeholder: 'https://youtu.be/…', autocomplete: 'off', autocapitalize: 'off' })),
    );
    keyWarn();
    renderTagChips();
  }

  // ---------- Letra y acordes
  const modeSeg = h('div.segmented.small.editor-modes', { role: 'tablist', 'aria-label': 'Vista' });
  const MODES = [
    ['chordpro', 'ChordPro'],
    ['plain', 'Acordes encima'],
    ['preview', 'Vista previa'],
  ];
  const pane = h('div.editor-pane');
  const help = h('p.set-desc.editor-help');
  const hl = h('pre.cp-hl', { 'aria-hidden': 'true' });
  const textarea = h('textarea.song-text', {
    rows: 12,
    spellcheck: 'false',
    autocapitalize: 'sentences',
    'aria-label': 'Letra y acordes',
    oninput: sync,
  });
  const editorBox = h('div.cp-editor', hl, textarea);

  function sync() {
    draft.body = mode === 'chordpro' ? textarea.value : plainToBody(textarea.value);
    paint();
    grow();
    renderPalette();
    persistDraft();
  }
  // Colores (solo en modo ChordPro): una copia coloreada detrás del texto.
  function paint() {
    if (mode !== 'chordpro') return;
    hl.replaceChildren(...highlightTokens(textarea.value).map(([c, t]) => (c ? h(`span.tk-${c}`, t) : t)), '\n');
  }
  // El cuadro crece con el texto: así se desplaza la página y no el cuadro.
  function grow() {
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 2 + 'px';
  }
  new ResizeObserver(() => mode !== 'preview' && grow()).observe(editorBox);

  /** Sustituye el texto cambiando solo la parte distinta (así «deshacer» funciona). */
  function applyText(next, start, end) {
    const old = textarea.value;
    let p = 0;
    while (p < old.length && p < next.length && old[p] === next[p]) p++;
    let q = 0;
    while (q < old.length - p && q < next.length - p && old[old.length - 1 - q] === next[next.length - 1 - q]) q++;
    textarea.focus({ preventScroll: true });
    textarea.setSelectionRange(p, old.length - q);
    const ins = next.slice(p, next.length - q);
    let ok = false;
    try {
      ok = document.execCommand('insertText', false, ins);
    } catch {
      ok = false;
    }
    if (!ok || textarea.value !== next) textarea.value = next;
    textarea.setSelectionRange(start, end);
    sync();
  }
  function insertAtCursor(text, selectFrom = text.length, selectTo = selectFrom) {
    const { selectionStart: a, selectionEnd: b, value } = textarea;
    const next = value.slice(0, a) + text + value.slice(b);
    applyText(next, a + selectFrom, a + selectTo);
  }
  const cursor = () => ({ a: textarea.selectionStart, b: textarea.selectionEnd, v: textarea.value });

  // Los botones no quitan el foco al texto (el teclado del móvil no se cierra).
  const keepFocus = (e) => e.preventDefault();
  const tool = (label, onclick, title) => h('button.tool-btn', { type: 'button', title: title ?? label, onpointerdown: keepFocus, onclick }, label);

  function addSection() {
    const { a } = cursor();
    const pick = (name) => {
      s.close();
      const r = insertLine(textarea.value, a, `{c: ${name}}`);
      applyText(r.text, r.start, r.end);
    };
    const other = h('input', { type: 'text', placeholder: 'Otro nombre', maxlength: '40', enterkeyhint: 'done', onkeydown: (e) => e.key === 'Enter' && other.value.trim() && pick(other.value.trim()) });
    const s = openSheet({
      title: 'Añadir sección',
      subtitle: 'Se añade como {c: …} antes de la línea del cursor.',
      body: [
        h('div.code-grid', SECTION_NAMES.map((n) => h('button.btn.ghost', { type: 'button', onclick: () => pick(n) }, n))),
        h('div.code-other', h('label.field', { 'aria-label': 'Otro nombre' }, other), h('button.btn.primary', { type: 'button', onclick: () => other.value.trim() && pick(other.value.trim()) }, 'Añadir')),
      ],
    });
  }
  function wrap(open, close) {
    const { a, b } = cursor();
    const r = wrapLines(textarea.value, a, b, open, close);
    applyText(r.text, r.start, r.end);
  }
  function addRepeat() {
    const { a, v } = cursor();
    const pre = a > 0 && !/\s/.test(v[a - 1]) ? ' ' : '';
    const code = `${pre}{soh}2x{eoh}`;
    // Queda seleccionado «2x» para cambiarlo por 3x, 4x…
    insertAtCursor(code, pre.length + 5, pre.length + 7);
  }
  function moreCodes() {
    const { a, b } = cursor();
    const run = (fn) => {
      s.close();
      textarea.setSelectionRange(a, b);
      fn();
    };
    const opt = (label, code, fn) => h('button.code-row', { type: 'button', onclick: () => run(fn) }, h('span', label), h('code', code));
    const s = openSheet({
      title: 'Códigos de SongBook',
      subtitle: 'Los que rodean (estrofa, puente…) se aplican a las líneas seleccionadas.',
      body: [
        h(
          'div.code-list',
          opt('Comentario', '{c: …}', () => {
            const r = insertLine(textarea.value, a, '{c: }');
            applyText(r.text, r.start - 1, r.start - 1);
          }),
          opt('Coro', '{soc} … {eoc}', () => wrap('{soc}', '{eoc}')),
          opt('Estrofa', '{sov} … {eov}', () => wrap('{sov}', '{eov}')),
          opt('Puente', '{sob} … {eob}', () => wrap('{sob}', '{eob}')),
          opt('Repeticiones', '{soh}2x{eoh}', addRepeat),
          opt('Tablatura o ritmo', '{sot} … {eot}', () => wrap('{sot}', '{eot}')),
          opt('Cuadrícula de acordes', '{sog} … {eog}', () => wrap('{sog}', '{eog}')),
        ),
      ],
    });
  }
  function newChord() {
    const field = h('input', { type: 'text', placeholder: 'F#m7, Bb/D, Sol…', maxlength: '16', autocapitalize: 'off', autocomplete: 'off', spellcheck: 'false', enterkeyhint: 'done' });
    const err = h('p.form-msg.error');
    const { a, b } = cursor();
    const ok = () => {
      const c = field.value.trim();
      if (!validChord(c)) {
        err.textContent = 'No se reconoce el acorde.';
        return;
      }
      s.close();
      textarea.setSelectionRange(a, b);
      insertAtCursor(`[${c}]`);
    };
    field.addEventListener('keydown', (e) => e.key === 'Enter' && ok());
    const s = openSheet({
      title: 'Otro acorde',
      subtitle: 'Se pone donde está el cursor y queda en la lista de acordes de la canción.',
      body: [h('label.field', h('span', 'Acorde'), field), err],
      footer: [h('button.btn.ghost', { onclick: () => s.close() }, 'Cancelar'), h('button.btn.primary', { onclick: ok }, 'Añadir')],
    });
    setTimeout(() => field.focus(), 50);
  }

  const palette = h('div.chord-palette', { role: 'group', 'aria-label': 'Acordes' });
  let paletteKey = '';
  function renderPalette() {
    const used = songChords(draft.body);
    const fromKey = keyChords(draft.key, 'american').filter((c) => !used.includes(c));
    const k = used.join('|') + '#' + fromKey.join('|');
    if (k === paletteKey) return;
    paletteKey = k;
    const chip = (c, cls = '') =>
      h(`button.chord-chip${cls}`, { type: 'button', onpointerdown: keepFocus, onclick: () => insertAtCursor(`[${c}]`), 'aria-label': `Poner ${c}` }, c);
    // replaceChildren escribiría «null» como texto: se quitan los huecos.
    palette.replaceChildren(
      ...[
        ...used.map((c) => chip(c)),
        used.length && fromKey.length ? h('span.chip-sep', { 'aria-hidden': 'true' }) : null,
        ...fromKey.map((c) => chip(c, '.from-key')),
        h('button.chord-chip.add', { type: 'button', onclick: newChord }, icon('plus', { size: 16 }), 'Acorde'),
      ].filter(Boolean),
    );
  }
  const toolbar = h(
    'div.cp-toolbar',
    h('div.tool-row', tool('Sección', addSection, 'Añadir {c: …}'), tool('Coro', () => wrap('{soc}', '{eoc}'), 'Rodear con {soc} … {eoc}'), tool('2x', addRepeat, 'Repeticiones {soh}2x{eoh}'), tool('Más códigos', moreCodes)),
    palette,
  );

  /** Texto del archivo. Con `path` de la biblioteca, sin repetir como {tag} la categoría que ya da su carpeta. */
  function fileText(path) {
    const d = path ? { ...draft, tags: withoutFolderTags(draft.tags, path) } : draft;
    return buildSongFile(d, d.body);
  }
  function renderPane() {
    modeSeg.replaceChildren(
      ...MODES.map(([m, label]) =>
        h(
          'button',
          {
            type: 'button',
            role: 'tab',
            'aria-selected': String(mode === m),
            class: mode === m ? 'on' : '',
            onclick: () => {
              mode = m;
              if (m !== 'preview') {
                try {
                  localStorage.setItem(MODE_KEY, m);
                } catch {
                  /* sin almacenamiento: no pasa nada */
                }
              }
              renderPane();
            },
          },
          label,
        ),
      ),
    );
    if (mode === 'preview') {
      const doc = loadSongDoc(fileText(), 'cho');
      const chord = makeChordTransformer({ semitones: 0, notation: state.settings.notation });
      help.textContent = 'Así se verá en la app (en el tono escrito).';
      pane.replaceChildren(
        h(
          'div.song-preview',
          h('h2.song-title', draft.title || 'Sin título'),
          draft.artist ? h('p.song-artist', draft.artist) : null,
          h('div.song-body', renderSong(doc, { chord })),
        ),
      );
      return;
    }
    editorBox.classList.toggle('plain', mode === 'plain');
    if (mode === 'plain') {
      help.replaceChildren(
        'Escribe cada línea de acordes encima de su letra, alineados con la sílaba. Los títulos como ',
        h('strong', 'Estrofa 1'),
        ' o ',
        h('strong', 'Coro'),
        ' en una línea sola se convierten en secciones.',
      );
      textarea.wrap = 'off';
      textarea.value = chordProToPlain(draft.body);
      textarea.placeholder = PLACEHOLDER;
      hl.replaceChildren();
    } else {
      help.replaceChildren(
        'Como en SongBook: el acorde va entre corchetes justo antes de su sílaba, ',
        h('code', '[G]Castillo'),
        '. Toca un acorde de la lista para ponerlo donde está el cursor.',
      );
      textarea.wrap = 'soft';
      textarea.value = draft.body;
      textarea.placeholder = CHORDPRO_PLACEHOLDER;
      paint();
    }
    renderPalette();
    pane.replaceChildren(toolbar, editorBox);
    requestAnimationFrame(grow);
  }

  // ---------- Guardar
  const saveBtn = h('button.btn.primary', { onclick: save }, icon('check', { size: 18 }), 'Guardar');
  async function save() {
    const err = validateSong(draft);
    msg.className = 'form-msg error';
    msg.textContent = err ?? '';
    if (err) {
      fields.querySelector('input')?.focus();
      return;
    }
    // Una canción de la biblioteca conserva su nombre de archivo (así las listas
    // y la batería siguen encontrándola); una nueva toma el título.
    const name = original ? original.name : safeName(draft.title);
    const newId = normalize(name);
    const toLibrary = saveTarget.target() === 'library';
    if (!original && lib.byId.voces.has(newId)) {
      if (toLibrary) {
        msg.textContent = 'Ya hay una canción con este título. Cambia el título o abre la existente y edítala.';
        return;
      }
      const ok = await confirmDialog({
        title: 'Ya existe una canción con este título',
        text: 'Si guardas, en este dispositivo se verá la tuya en lugar de la existente.',
        confirm: 'Guardar igualmente',
      });
      if (!ok) return;
    }
    saveBtn.disabled = true;
    try {
      if (toLibrary) {
        if (file?.origin === 'remote') {
          const { path, replaces } = editPaths(file);
          await saveToLibrary({ path, text: fileText(path), create: !!replaces, ifMatch: file.etag, replaces, replacesEtag: file.etag });
        } else {
          const path = newSongPath('voces', saveTarget.folder(), name);
          await saveToLibrary({ path, text: fileText(path), create: true });
        }
      } else {
        await saveLocal(name);
      }
      await done(newId, toLibrary ? (original ? `Cambios guardados en ${libraryLabel()}` : `Canción guardada en ${libraryLabel()}`) : original ? 'Cambios guardados en este dispositivo' : 'Canción guardada en este dispositivo');
    } catch (e) {
      if (e?.name !== 'OfflineError') console.error(e);
      saveBtn.disabled = false;
      if (toLibrary && e?.name === 'OfflineError') {
        const ok = await confirmDialog({
          title: 'Sin conexión',
          text: `No se puede guardar en ${libraryLabel()} ahora. ¿La guardas en este dispositivo? Cuando vuelva la conexión, ábrela en el editor y toca «Subir a ${libraryLabel()}».`,
          confirm: 'Guardar en el dispositivo',
        });
        if (!ok) return;
        saveBtn.disabled = true;
        try {
          await saveLocal(name);
          await done(newId, 'Guardada en este dispositivo');
        } catch (e2) {
          console.error(e2);
          toast('No se pudo guardar: ' + (e2.message || e2));
          saveBtn.disabled = false;
        }
        return;
      }
      msg.className = 'form-msg error';
      msg.textContent = 'No se pudo guardar: ' + libraryErrorText(e);
    }
  }

  /** Guarda en este dispositivo (origin 'local'). */
  async function saveLocal(name) {
    const text = fileText();
    const path = isOwnLocal ? file.path : `local/Voces/${name}.cho`;
    if (isOwnLocal && file.ext !== 'cho') await db.deleteFiles([file.path]);
    const finalPath = isOwnLocal && file.ext !== 'cho' ? path.replace(/\.[^./]+$/, '.cho') : path;
    await db.putFiles([
      {
        path: finalPath,
        origin: 'local',
        source: EDITOR_SOURCE,
        section: 'voces',
        ext: 'cho',
        kind: 'text',
        depth: 1,
        etag: String(Date.now()),
        size: text.length,
        text,
        meta: songMeta(text, 'cho'),
      },
    ]);
    await reloadLibrary();
  }

  /** Tras guardar: fuera borrador y a la canción (sin dejar el editor en el historial). */
  async function done(newId, message) {
    await dropDraft();
    initial = structuredClone(draft);
    toast(message);
    const target = link(`/cancion/voces/${encodeURIComponent(newId)}`);
    if (original) goBackTo(target, backHref);
    else replaceTo(target);
  }

  /** Sube a la biblioteca compartida una canción guardada solo en este dispositivo. */
  async function upload() {
    const err = validateSong(draft);
    msg.className = 'form-msg error';
    msg.textContent = err ?? '';
    if (err) return;
    const label = libraryLabel();
    let opts;
    if (sharedCopy) {
      const ok = await confirmDialog({
        title: `¿Subir tus cambios a ${label}?`,
        text: 'Sustituyen a la versión que ve la banda (OneDrive guarda la anterior por si hay que recuperarla).',
        confirm: 'Subir',
      });
      if (!ok) return;
      const { path, replaces } = editPaths(sharedCopy);
      opts = { path, create: !!replaces, ifMatch: sharedCopy.etag, replaces, replacesEtag: sharedCopy.etag };
    } else {
      const folder = await pickFolder({ section: 'voces', title: `Subir a ${label}`, text: 'Elige la carpeta. Después la verá toda la banda y dejará de estar solo en este dispositivo.', tags: draft.tags });
      if (folder == null) return;
      opts = { path: newSongPath('voces', folder, original.name), create: true };
    }
    saveBtn.disabled = true;
    try {
      await saveToLibrary({ ...opts, text: fileText(opts.path), dropLocal: [file.path] });
      await done(original.id, `Canción subida a ${label}`);
    } catch (e) {
      console.error(e);
      saveBtn.disabled = false;
      msg.className = 'form-msg error';
      msg.textContent = 'No se pudo subir: ' + libraryErrorText(e);
    }
  }

  async function exportCho() {
    const err = validateSong(draft);
    if (err) {
      msg.className = 'form-msg error';
      msg.textContent = err;
      return;
    }
    const name = original ? original.name : safeName(draft.title);
    await shareOrDownload(new Blob([fileText()], { type: 'text/plain;charset=utf-8' }), `${name}.cho`);
  }

  async function removeOwn() {
    const text = sharedCopy
      ? 'Se borra la versión editada en este dispositivo y vuelve a verse la de la biblioteca compartida.'
      : 'Se borra de este dispositivo. Si no la has exportado, se perderá.';
    if (!(await confirmDialog({ title: sharedCopy ? '¿Volver a la versión compartida?' : '¿Borrar esta canción?', text, confirm: sharedCopy ? 'Volver' : 'Borrar', danger: true }))) return;
    await db.deleteFiles([file.path]);
    await dropDraft();
    initial = structuredClone(draft);
    await reloadLibrary();
    toast(sharedCopy ? 'Se muestra de nuevo la versión compartida' : 'Canción borrada');
    if (sharedCopy) goBackTo(backHref);
    else goBackTo(link('/canciones'), backHref);
  }

  el.append(
    fields,
    h('div.items-head', h('h3.section-title', 'Letra y acordes'), modeSeg),
    help,
    pane,
    saveTarget.el,
    msg,
    h(
      'div.item-actions',
      h('button.btn.small.ghost', { onclick: exportCho }, icon('share', { size: 16 }), 'Exportar .cho'),
      isOwnLocal
        ? h('button.btn.small.ghost.danger-text', { onclick: removeOwn }, icon('trash', { size: 16 }), sharedCopy ? 'Volver a la versión compartida' : 'Borrar canción')
        : null,
    ),
    h('div.editor-bar', h('button.btn.ghost', { onclick: goBack }, 'Cancelar'), saveBtn),
  );
  renderFields();
  renderPane();

  // ¿Hay cambios sin guardar de una sesión anterior?
  db.kvGet(DRAFT_KEY).then((saved) => {
    if (!saved || saved.id !== (id ?? null) || same(saved.draft, draft)) return;
    recover.replaceChildren(
      h(
        'div.banner',
        icon('alert', { size: 18 }),
        h('span', `Tienes cambios sin guardar de ${timeAgo(saved.at)}.`),
        h('button.btn.small.primary', {
          onclick: () => {
            draft = { ...emptySong(), ...saved.draft };
            // Borradores de la versión anterior (texto «acordes encima»)
            if (saved.draft.plain != null && saved.draft.body == null) draft.body = plainToBody(saved.draft.plain);
            delete draft.plain;
            renderFields();
            renderPane();
            persistDraft();
            recover.replaceChildren();
          },
        }, 'Recuperar'),
        h('button.btn.small.ghost', { onclick: () => (db.kvDelete(DRAFT_KEY), recover.replaceChildren()) }, 'Descartar'),
      ),
    );
  });

  state.editingDirty = false;
  return {
    el,
    destroy() {
      clearTimeout(saveTimer);
      if (dirty()) db.kvSet(DRAFT_KEY, { id: id ?? null, draft, at: Date.now() });
      state.editingDirty = false;
      emitChange('editing');
    },
  };
}
