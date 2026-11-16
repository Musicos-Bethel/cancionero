import { h, clear } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { toast } from '../ui/toast.js';
import { confirmDialog } from '../ui/dialog.js';
import { state, emitChange, reloadLibrary } from '../state.js';
import * as db from '../db.js';
import { categoriesOf, ALL, NONE } from '../library/library.js';
import { parseKey } from '../music/chords.js';
import { makeChordTransformer } from '../music/transpose.js';
import { loadSongDoc, songMeta } from '../chordpro/song-doc.js';
import { renderSong } from '../viewers/chordpro-view.js';
import { splitSongFile, buildSongFile, chordProToPlain, plainToBody, emptySong, validateSong } from '../chordpro/compose.js';
import { safeName } from '../chordpro/split.js';
import { normalize } from '../util/text.js';
import { link, emptyState } from '../ui/components.js';
import { isLeader } from '../leader/leader.js';
import { requestLeader } from '../leader/leader-ui.js';
import { shareOrDownload } from '../features/backup.js';
import { timeAgo } from '../ui/format.js';

const DRAFT_KEY = 'cancion-borrador';
/** Origen de las canciones creadas con el editor (las importadas son 'local'). */
export const EDITOR_SOURCE = 'editor';

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

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
 * Mientras no haya escritura en OneDrive se guarda en este dispositivo
 * (origin 'local', source 'editor') y se puede exportar como .cho. Si se edita
 * una canción de la biblioteca compartida, la copia del dispositivo la sustituye
 * (mismo nombre de archivo) hasta que se borre.
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
    initial = { ...fields, tags, title: fields.title || original.title, plain: chordProToPlain(fields.body) };
  } else {
    initial = { ...emptySong(), plain: '' };
  }
  delete initial.body;
  let draft = structuredClone(initial);
  const dirty = () => !same(draft, initial);
  let mode = 'write'; // 'write' | 'preview' | 'chordpro'

  // ---------- Borrador (por si se cierra la app a mitad)
  let saveTimer;
  function persistDraft() {
    clearTimeout(saveTimer);
    state.editingDirty = dirty();
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
    location.hash = backHref;
  };
  const recover = h('div.recover-slot');
  el.append(
    h('button.back-link', { onclick: goBack }, icon('back', { size: 18 }), original ? 'Canción' : 'Canciones'),
    h(
      'header.page-head',
      h('h1', original ? 'Editar canción' : 'Nueva canción'),
      h('p.page-sub', 'De momento se guarda en este dispositivo. Para compartirla, usa «Exportar .cho» y súbela a la carpeta del cancionero en OneDrive.'),
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
          if (key === 'key') keyWarn();
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
        'div.field-row.three',
        h('label.field', h('span', 'Tono', keyMsg), input('key', { type: 'text', placeholder: 'G, Em, Re…', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', maxlength: '8' })),
        h('label.field', h('span', 'Tempo'), input('tempo', { type: 'text', inputmode: 'numeric', placeholder: '72', maxlength: '4' })),
        h('label.field', h('span', 'Compás'), input('time', { type: 'text', placeholder: '4/4', maxlength: '6' })),
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
    ['write', 'Escribir'],
    ['preview', 'Vista previa'],
    ['chordpro', 'ChordPro'],
  ];
  const pane = h('div.editor-pane');
  const help = h('p.set-desc.editor-help');
  const textarea = h('textarea.song-text', {
    rows: 18,
    spellcheck: 'false',
    autocapitalize: 'sentences',
    wrap: 'off',
    oninput: (e) => {
      if (mode === 'write') draft.plain = e.target.value;
      else draft.plain = chordProToPlain(e.target.value);
      persistDraft();
    },
  });
  const chordproText = () => plainToBody(draft.plain);
  function fileText() {
    return buildSongFile({ ...draft, tags: draft.tags }, chordproText());
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
    if (mode === 'write') {
      help.replaceChildren(
        'Escribe cada línea de acordes encima de su letra, alineados con la sílaba. Los títulos como ',
        h('strong', 'Estrofa 1'),
        ', ',
        h('strong', 'Coro'),
        ' o ',
        h('strong', 'Puente'),
        ' en una línea sola se convierten en secciones.',
      );
      textarea.value = draft.plain;
      textarea.placeholder = PLACEHOLDER;
    } else {
      help.textContent = 'El mismo texto en formato ChordPro, por si prefieres escribirlo así (como en SongBook).';
      textarea.value = chordproText();
      textarea.placeholder = '{c: Estrofa 1}\n[C]Castillo [G]fuerte es [Am]nuestro [F]Dios';
    }
    pane.replaceChildren(textarea);
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
    if (!original && lib.byId.voces.has(newId)) {
      const ok = await confirmDialog({
        title: 'Ya existe una canción con este título',
        text: 'Si guardas, en este dispositivo se verá la tuya en lugar de la existente.',
        confirm: 'Guardar igualmente',
      });
      if (!ok) return;
    }
    saveBtn.disabled = true;
    try {
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
      await dropDraft();
      initial = structuredClone(draft);
      await reloadLibrary();
      toast(original ? 'Cambios guardados en este dispositivo' : 'Canción guardada en este dispositivo');
      location.hash = link(`/cancion/voces/${encodeURIComponent(newId)}`);
    } catch (e) {
      console.error(e);
      toast('No se pudo guardar: ' + (e.message || e));
      saveBtn.disabled = false;
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
    location.hash = sharedCopy ? backHref : link('/canciones');
  }

  el.append(
    fields,
    h('div.items-head', h('h3.section-title', 'Letra y acordes'), modeSeg),
    help,
    pane,
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
            draft = saved.draft;
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
