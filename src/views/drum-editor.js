import { h, clear } from '../ui/dom.js';
import { goBackTo, replaceTo } from '../nav.js';
import { icon } from '../ui/icons.js';
import { toast } from '../ui/toast.js';
import { confirmDialog } from '../ui/dialog.js';
import { state, emitChange, reloadLibrary } from '../state.js';
import * as db from '../db.js';
import { findSong } from '../library/library.js';
import { loadSongDoc, songMeta } from '../chordpro/song-doc.js';
import { renderSong } from '../viewers/chordpro-view.js';
import { safeName } from '../chordpro/split.js';
import { normalize } from '../util/text.js';
import { link, emptyState } from '../ui/components.js';
import { isLeader } from '../leader/leader.js';
import { requestLeader } from '../leader/leader-ui.js';
import { shareOrDownload } from '../features/backup.js';
import { timeAgo } from '../ui/format.js';
import { canSaveToLibrary, libraryLabel, saveToLibrary, newSongPath, editPaths, withoutFolderTags, libraryErrorText } from '../library/save-song.js';
import { saveTargetCard, pickFolder } from '../ui/save-target.js';
import { makeSortable } from '../ui/reorder.js';
import { EDITOR_SOURCE } from './song-editor.js';
import {
  INSTRUMENTS, instrumentLabel, cycleCell, countLine, resizeRhythm, newRhythm, insertRow,
  emptySheet, splitDrumFile, buildDrumFile, validateSheet,
} from '../drums/drum-sheet.js';

const DRAFT_KEY = 'bateria-borrador';
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const SUBDIVISIONS = [
  [1, 'Negras'],
  [2, 'Corcheas'],
  [3, 'Tresillos'],
  [4, 'Semicorcheas'],
  [6, 'Sextillos'],
];
const SECTION_NAMES = ['Intro', 'Estrofa', 'Pre-coro', 'Coro', 'Puente', 'Interludio', 'Final', 'Outro', 'Cierre'];

/**
 * Editor de hojas de batería (modo líder): ritmos en cuadrícula (se toca cada
 * casilla) y hoja de ruta por secciones. Se guarda en ChordPro, igual que las
 * canciones de voces, en este dispositivo (origin 'local', source 'editor')
 * hasta que haya escritura en OneDrive.
 *
 *  id = null → hoja nueva (de = id de una canción de voces para emparejarla);
 *  id = id de una canción de batería en ChordPro → editarla.
 */
export function DrumEditorView({ id, query }) {
  const lib = state.library;
  const el = h('div.view.drum-editor');

  if (!isLeader()) {
    el.append(
      emptyState(
        'Solo en modo líder',
        'Para crear o editar hojas de batería hace falta el PIN de líder.',
        h('button.btn.primary', { onclick: async () => (await requestLeader()) && dispatchEvent(new HashChangeEvent('hashchange')) }, icon('lock', { size: 18 }), 'Entrar en modo líder'),
      ),
    );
    return { el };
  }

  const original = id ? lib.byId.bateria.get(id) : null;
  if (id && (!original || original.kind !== 'chordpro')) {
    el.append(
      emptyState(
        original ? 'Esta hoja no se puede editar' : 'Hoja de batería no encontrada',
        original ? 'Solo se editan hojas de texto (no PDF ni imágenes).' : 'Puede que se haya borrado o renombrado.',
        h('a.btn.primary', { href: link('/canciones') }, 'Volver'),
      ),
    );
    return { el };
  }
  const file = original ? state.files.find((f) => f.path === original.path) : null;
  const isOwnLocal = file?.origin === 'local';
  const baseId = (p) => normalize(p.split('/').pop().replace(/\.[^.]+$/, ''));
  const sharedCopy = isOwnLocal ? state.files.find((f) => f.origin === 'remote' && f.section === 'bateria' && baseId(f.path) === original.id) : null;

  // Canción de voces de la que se parte (al crear desde una canción).
  const fromVoces = !original && query?.get('de') ? lib.byId.voces.get(query.get('de')) : null;

  let initial;
  if (original) {
    const s = splitDrumFile(file?.text ?? '');
    initial = { ...s, title: s.title || original.title };
  } else {
    initial = emptySheet();
    initial.subtitle = 'Batería';
    if (fromVoces) {
      initial.title = fromVoces.title;
      initial.tempo = fromVoces.tempo || '';
    }
    initial.rhythms = [newRhythm('Ritmo A', initial.time)];
    initial.route = [
      { kind: 'section', title: 'Intro', detail: '', note: '' },
      { kind: 'section', title: 'Estrofa 1', detail: 'Ritmo A', note: '' },
      { kind: 'section', title: 'Coro', detail: 'Ritmo A', note: '' },
      { kind: 'section', title: 'Final', detail: '', note: '' },
    ];
  }
  let draft = structuredClone(initial);
  const dirty = () => !same(draft, initial);
  let mode = 'edit'; // 'edit' | 'preview' | 'chordpro'

  // ---------- Dónde se guarda (OneDrive o este dispositivo)
  const saveTarget = saveTargetCard({
    kind: file?.origin === 'remote' ? 'remote' : isOwnLocal ? 'local' : 'new',
    section: 'bateria',
    path: file?.path ?? '',
    tags: draft.tags,
    onUpload: () => upload(),
    uploadLabel: sharedCopy ? `Subir mis cambios a ${libraryLabel()}` : undefined,
  });

  // ---------- Borrador
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
  const backHref = original
    ? link(`/cancion/bateria/${encodeURIComponent(original.id)}`)
    : fromVoces
      ? link(`/cancion/voces/${encodeURIComponent(fromVoces.id)}`)
      : link('/canciones');
  const goBack = async () => {
    if (dirty() && !(await confirmDialog({ title: '¿Descartar los cambios?', text: 'Los cambios de esta hoja de batería no se han guardado.', confirm: 'Descartar', danger: true }))) return;
    await dropDraft();
    goBackTo(backHref);
  };
  const recover = h('div.recover-slot');
  el.append(
    h('button.back-link', { onclick: goBack }, icon('back', { size: 18 }), original || fromVoces ? 'Canción' : 'Canciones'),
    h(
      'header.page-head',
      h('h1', original ? 'Editar hoja de batería' : 'Nueva hoja de batería'),
      h(
        'p.page-sub',
        canSaveToLibrary()
          ? `Abajo eliges si se guarda en ${libraryLabel()} (en la carpeta de batería, para toda la banda) o solo en este dispositivo.`
          : 'Se guarda en este dispositivo. Para compartirla, usa «Exportar .cho» y súbela a la carpeta de batería del cancionero en OneDrive.',
      ),
    ),
    recover,
  );

  // ---------- Datos
  const fields = h('section.form-card');
  const pairMsg = h('p.set-desc.pair-msg');
  const vocesFor = (title) => (title.trim() ? findSong(lib, 'voces', title.trim()) : null);
  function updatePair() {
    const v = vocesFor(draft.title);
    pairMsg.textContent = !draft.title.trim()
      ? 'Escribe el título de la canción de voces para que la hoja aparezca junto a ella.'
      : v
        ? `Se verá como la versión de batería de «${v.title}».`
        : 'No hay ninguna canción de voces con este título: la hoja aparecerá sola en Batería.';
  }
  const datalist = h('datalist#drum-song-titles', lib.songs.voces.map((s) => h('option', { value: s.title })));
  function renderFields() {
    clear(fields);
    const input = (key, attrs) =>
      h('input', {
        ...attrs,
        value: draft[key],
        oninput: (e) => {
          draft[key] = e.target.value;
          if (key === 'title') updatePair();
          persistDraft();
        },
      });
    fields.append(
      h('label.field', h('span', 'Canción'), input('title', { type: 'text', list: 'drum-song-titles', placeholder: 'Castillo fuerte es nuestro Dios', autocomplete: 'off', enterkeyhint: 'next', maxlength: '120' })),
      datalist,
      pairMsg,
      h('label.field', h('span', 'Descripción ', h('small', '(opcional)')), input('subtitle', { type: 'text', placeholder: 'Batería · balada', autocomplete: 'off', maxlength: '120' })),
      h(
        'div.field-row',
        h('label.field', h('span', 'Tempo'), input('tempo', { type: 'text', inputmode: 'numeric', placeholder: '72', maxlength: '3' })),
        h('label.field', h('span', 'Compás'), input('time', { type: 'text', placeholder: '4/4', maxlength: '5' })),
      ),
    );
    updatePair();
  }

  // ---------- Ritmos
  const rhythmsBox = h('div.rhythms');
  function setRhythm(i, r) {
    draft.rhythms[i] = r;
    persistDraft();
  }
  function renderRhythms() {
    clear(rhythmsBox);
    draft.rhythms.forEach((r, i) => rhythmsBox.append(rhythmCard(r, i)));
    rhythmsBox.append(
      h('button.btn.small.ghost.add-btn', { onclick: () => addRhythm() }, icon('plus', { size: 16 }), 'Añadir ritmo'),
    );
  }
  function nextRhythmName() {
    const used = new Set(draft.rhythms.map((r) => normalize(r.name)));
    for (const l of 'ABCDEFGHIJ') if (!used.has(normalize(`Ritmo ${l}`))) return `Ritmo ${l}`;
    return `Ritmo ${draft.rhythms.length + 1}`;
  }
  function addRhythm(copyOf) {
    const r = copyOf ? { ...structuredClone(copyOf), name: nextRhythmName() } : newRhythm(nextRhythmName(), draft.time);
    draft.rhythms.push(r);
    persistDraft();
    renderRhythms();
    renderRoute();
    rhythmsBox.children[draft.rhythms.length - 1]?.querySelector('input')?.focus({ preventScroll: true });
  }
  function rhythmCard(r, i) {
    const card = h('section.form-card.rhythm-card');
    const nameIn = h('input', {
      type: 'text',
      value: r.name,
      placeholder: 'Ritmo A · estrofas',
      'aria-label': 'Nombre del ritmo',
      maxlength: '80',
      oninput: (e) => {
        draft.rhythms[i].name = e.target.value;
        persistDraft();
        renderRouteChips();
      },
    });
    const beatsSel = h(
      'select',
      {
        'aria-label': 'Tiempos',
        onchange: (e) => {
          setRhythm(i, resizeRhythm(draft.rhythms[i], Number(e.target.value), draft.rhythms[i].spb));
          renderRhythms();
        },
      },
      [1, 2, 3, 4, 5, 6, 7, 8].map((n) => h('option', { value: String(n), selected: n === r.beats }, `${n} ${n === 1 ? 'tiempo' : 'tiempos'}`)),
    );
    const subs = SUBDIVISIONS.some(([n]) => n === r.spb) ? SUBDIVISIONS : [...SUBDIVISIONS, [r.spb, `${r.spb} por tiempo`]];
    const spbSel = h(
      'select',
      {
        'aria-label': 'Subdivisión',
        onchange: (e) => {
          setRhythm(i, resizeRhythm(draft.rhythms[i], draft.rhythms[i].beats, Number(e.target.value)));
          renderRhythms();
        },
      },
      subs.map(([n, label]) => h('option', { value: String(n), selected: n === r.spb }, label)),
    );

    // Cuadrícula: un botón por casilla. Tocar cambia golpe → acento → vacío.
    const grid = h('div.drum-grid.edit', { style: `--steps: ${r.beats * r.spb}` });
    const beatCls = (s) => (s % r.spb === 0 ? '.beat' : '') + (s % r.spb === 0 && s ? '.sep' : '');
    grid.append(
      h('span.dg-label'),
      ...countLine(r.beats, r.spb).map((t, s) => h(`span.dg-count${beatCls(s)}${/^\d+$/.test(t) ? '.num' : ''}`, t === '.' ? '' : t)),
      h('span.dg-end'),
    );
    r.rows.forEach((row, ri) => {
      grid.append(h('span.dg-label', { title: instrumentLabel(row.inst) }, row.inst));
      row.cells.forEach((c, s) => {
        const btn = h('button.dg-cell', { type: 'button', 'aria-label': `${instrumentLabel(row.inst)}, paso ${s + 1}` });
        btn.className = `dg-cell ${cellClass(c)}${beatCls(s).replace(/\./g, ' ')}`;
        btn.append(c === '.' || /[xXoO]/.test(c) ? h('i') : c);
        btn.addEventListener('click', () => {
          const v = cycleCell(draft.rhythms[i].rows[ri].cells[s], row.inst);
          draft.rhythms[i].rows[ri].cells[s] = v;
          btn.className = `dg-cell ${cellClass(v)}${beatCls(s).replace(/\./g, ' ')}`;
          btn.replaceChildren(h('i'));
          persistDraft();
        });
        grid.append(btn);
      });
      grid.append(
        h(
          'button.dg-remove',
          {
            type: 'button',
            'aria-label': `Quitar ${instrumentLabel(row.inst)}`,
            onclick: () => {
              draft.rhythms[i].rows.splice(ri, 1);
              persistDraft();
              renderRhythms();
            },
          },
          icon('close', { size: 14 }),
        ),
      );
    });

    const present = new Set(r.rows.map((x) => x.inst.toLowerCase()));
    const addSel = h(
      'select.add-inst',
      {
        'aria-label': 'Añadir instrumento',
        onchange: (e) => {
          if (!e.target.value) return;
          setRhythm(i, insertRow(draft.rhythms[i], e.target.value));
          renderRhythms();
        },
      },
      h('option', { value: '' }, 'Añadir instrumento…'),
      INSTRUMENTS.filter((x) => !present.has(x.id.toLowerCase())).map((x) => h('option', { value: x.id }, `${x.label} (${x.id})`)),
    );

    card.append(
      h('label.field', h('span', 'Nombre'), nameIn),
      h('div.meter-row', beatsSel, spbSel),
      h('div.drum-grid-wrap.edit', grid),
      h(
        'div.item-actions.rhythm-actions',
        addSel,
        h('button.btn.small.ghost', { onclick: () => addRhythm(draft.rhythms[i]) }, icon('copy', { size: 16 }), 'Duplicar'),
        h(
          'button.btn.small.ghost.danger-text',
          {
            onclick: async () => {
              if (!(await confirmDialog({ title: '¿Borrar este ritmo?', text: r.name ? `Se borra «${r.name}» de la hoja.` : 'Se borra el ritmo de la hoja.', confirm: 'Borrar', danger: true }))) return;
              draft.rhythms.splice(i, 1);
              persistDraft();
              renderRhythms();
              renderRouteChips();
            },
          },
          icon('trash', { size: 16 }),
          'Borrar',
        ),
      ),
    );
    return card;
  }
  function cellClass(c) {
    if (c === '.') return 'rest';
    if (!/[xXoO]/.test(c)) return 'other';
    return `${c === 'X' || c === 'O' ? 'acc' : 'hit'} ${c.toLowerCase() === 'x' ? 'cym' : 'drum'}`;
  }

  // ---------- Hoja de ruta
  const routeList = h('ul.edit-items.route-items');
  const routeChipsSlots = [];
  makeSortable(routeList, {
    onReorder(from, to) {
      const [it] = draft.route.splice(from, 1);
      draft.route.splice(to, 0, it);
      persistDraft();
      renderRoute();
    },
  });
  function renderRouteChips() {
    for (const { slot, i } of routeChipsSlots) slot.replaceChildren(...detailChips(i));
  }
  function detailChips(i) {
    const item = draft.route[i];
    const names = draft.rhythms.map((r) => r.name.split(' · ')[0].trim()).filter(Boolean);
    return [...new Set(names)].map((n) =>
      h(
        'button.cat-chip',
        {
          type: 'button',
          onclick: (e) => {
            const input = e.target.closest('li').querySelector('input.detail');
            item.detail = item.detail.trim() ? `${item.detail.trim()} · ${n}` : n;
            input.value = item.detail;
            persistDraft();
          },
        },
        '+ ',
        n,
      ),
    );
  }
  function renderRoute() {
    clear(routeList);
    routeChipsSlots.length = 0;
    draft.route.forEach((item, i) => {
      const remove = h(
        'button.icon-btn.small',
        {
          type: 'button',
          'aria-label': 'Quitar',
          onclick: () => {
            draft.route.splice(i, 1);
            persistDraft();
            renderRoute();
          },
        },
        icon('trash', { size: 18 }),
      );
      const drag = h('button.drag', { type: 'button', 'aria-label': 'Mover' }, icon('grip', { size: 18 }));
      if (item.kind === 'raw') {
        routeList.append(
          h(
            'li.edit-item.route-item',
            drag,
            h(
              'div.route-main',
              h('span.route-raw-label', 'Texto ChordPro (se conserva tal cual)'),
              h('textarea.song-text.route-raw', {
                rows: Math.min(8, item.text.split('\n').length + 1),
                spellcheck: 'false',
                wrap: 'off',
                value: item.text,
                oninput: (e) => {
                  item.text = e.target.value;
                  persistDraft();
                },
              }),
            ),
            remove,
          ),
        );
        return;
      }
      const slot = h('div.tag-suggest.route-chips');
      routeChipsSlots.push({ slot, i });
      routeList.append(
        h(
          'li.edit-item.route-item',
          drag,
          h(
            'div.route-main',
            h(
              'div.route-head',
              h('input.route-title', {
                type: 'text',
                value: item.title,
                placeholder: 'Sección',
                'aria-label': 'Sección',
                maxlength: '60',
                oninput: (e) => {
                  item.title = e.target.value;
                  persistDraft();
                },
              }),
              h('input.detail', {
                type: 'text',
                value: item.detail,
                placeholder: 'Ritmo A · 8 compases',
                'aria-label': 'Ritmo y compases',
                maxlength: '120',
                oninput: (e) => {
                  item.detail = e.target.value;
                  persistDraft();
                },
              }),
            ),
            slot,
            h('textarea.route-note', {
              rows: 1,
              value: item.note,
              placeholder: 'Nota (opcional)',
              'aria-label': 'Nota',
              oninput: (e) => {
                item.note = e.target.value;
                autosize(e.target);
                persistDraft();
              },
            }),
          ),
          remove,
        ),
      );
    });
    renderRouteChips();
    requestAnimationFrame(() => routeList.querySelectorAll('textarea.route-note').forEach(autosize));
  }
  function autosize(t) {
    t.style.height = 'auto';
    t.style.height = `${t.scrollHeight + 2}px`;
  }
  function addSection(title) {
    const n = draft.route.filter((r) => r.kind === 'section' && normalize(r.title).startsWith(normalize(title))).length;
    const numbered = title === 'Estrofa' ? `Estrofa ${n + 1}` : title;
    draft.route.push({ kind: 'section', title: numbered, detail: '', note: '' });
    persistDraft();
    renderRoute();
    routeList.lastElementChild?.querySelector('input.detail')?.focus({ preventScroll: true });
  }
  const addSectionRow = h(
    'div.tag-suggest.add-sections',
    h('span.set-desc', 'Añadir: '),
    SECTION_NAMES.map((t) => h('button.cat-chip', { type: 'button', onclick: () => addSection(t) }, '+ ', t)),
  );

  // ---------- Modos
  const modeSeg = h('div.segmented.small.editor-modes', { role: 'tablist', 'aria-label': 'Vista' });
  const MODES = [
    ['edit', 'Editar'],
    ['preview', 'Vista previa'],
    ['chordpro', 'ChordPro'],
  ];
  const pane = h('div.editor-pane');
  /** Texto del archivo. Con `path` de la biblioteca, sin repetir como {tag} la categoría que ya da su carpeta. */
  const fileText = (path) => buildDrumFile(path ? { ...draft, tags: withoutFolderTags(draft.tags, path) } : draft);
  const textarea = h('textarea.song-text', {
    rows: 20,
    spellcheck: 'false',
    wrap: 'off',
    oninput: (e) => {
      draft = splitDrumFile(e.target.value);
      persistDraft();
    },
  });
  const editPane = h(
    'div',
    h('div.items-head', h('h3.section-title', 'Ritmos')),
    h('p.set-desc.editor-help', 'Toca una casilla para poner un golpe; otra vez para acentuarlo y otra para quitarlo. × = platos (charles, ride), ● = caja, toms y bombo.'),
    rhythmsBox,
    h('div.items-head', h('h3.section-title', 'Hoja de ruta')),
    h('p.set-desc.editor-help', 'Las partes de la canción en orden, con el ritmo de cada una. Arrastra por el asa para cambiar el orden.'),
    routeList,
    addSectionRow,
  );
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
              if (mode === 'chordpro' && m !== 'chordpro') renderFields(); // el texto pudo cambiar el título…
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
      pane.replaceChildren(
        h(
          'div.song-preview',
          h('h2.song-title', draft.title || 'Sin título'),
          draft.subtitle ? h('p.song-subtitle', draft.subtitle) : null,
          draft.tempo || draft.time ? h('p.song-meta', [draft.tempo ? `♩ = ${draft.tempo}` : '', draft.time].filter(Boolean).join(' · ')) : null,
          h('div.song-body', renderSong(doc)),
        ),
      );
    } else if (mode === 'chordpro') {
      textarea.value = fileText();
      pane.replaceChildren(h('p.set-desc.editor-help', 'La misma hoja en formato ChordPro (así la abre también SongBook).'), textarea);
    } else {
      renderRhythms();
      renderRoute();
      pane.replaceChildren(editPane);
    }
  }

  // ---------- Guardar
  const msg = h('p.form-msg', { role: 'alert' });
  const fileName = () => {
    if (original) return original.name;
    return vocesFor(draft.title)?.name ?? safeName(draft.title);
  };
  const saveBtn = h('button.btn.primary', { onclick: save }, icon('check', { size: 18 }), 'Guardar');
  async function save() {
    const err = validateSheet(draft);
    msg.className = 'form-msg error';
    msg.textContent = err ?? '';
    if (err) return;
    const name = fileName();
    const newId = normalize(name);
    const toLibrary = saveTarget.target() === 'library';
    if (!original && lib.byId.bateria.has(newId)) {
      if (toLibrary) {
        msg.textContent = 'Esta canción ya tiene hoja de batería. Cambia el título o abre la existente y edítala.';
        return;
      }
      const ok = await confirmDialog({
        title: 'Esta canción ya tiene hoja de batería',
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
          const path = newSongPath('bateria', saveTarget.folder(), name);
          await saveToLibrary({ path, text: fileText(path), create: true });
        }
      } else {
        await saveLocal(name);
      }
      await done(newId, toLibrary ? (original ? `Cambios guardados en ${libraryLabel()}` : `Hoja de batería guardada en ${libraryLabel()}`) : original ? 'Cambios guardados en este dispositivo' : 'Hoja de batería guardada en este dispositivo');
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
      msg.textContent = 'No se pudo guardar: ' + libraryErrorText(e, 'la hoja');
    }
  }

  /** Guarda en este dispositivo (origin 'local'). */
  async function saveLocal(name) {
    const text = fileText();
    let path = isOwnLocal ? file.path : `local/Bateria/${name}.cho`;
    if (isOwnLocal && file.ext !== 'cho') {
      await db.deleteFiles([file.path]);
      path = path.replace(/\.[^./]+$/, '.cho');
    }
    await db.putFiles([
      {
        path,
        origin: 'local',
        source: EDITOR_SOURCE,
        section: 'bateria',
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

  /** Tras guardar: fuera borrador y a la hoja (sin dejar el editor en el historial). */
  async function done(newId, message) {
    await dropDraft();
    initial = structuredClone(draft);
    toast(message);
    const target = link(`/cancion/bateria/${encodeURIComponent(newId)}`);
    if (original) goBackTo(target, backHref);
    else replaceTo(target);
  }

  /** Sube a la biblioteca compartida una hoja guardada solo en este dispositivo. */
  async function upload() {
    const err = validateSheet(draft);
    msg.className = 'form-msg error';
    msg.textContent = err ?? '';
    if (err) return;
    const label = libraryLabel();
    let opts;
    if (sharedCopy) {
      const ok = await confirmDialog({
        title: `¿Subir tus cambios a ${label}?`,
        text: 'Sustituyen a la hoja que ve la banda (OneDrive guarda la anterior por si hay que recuperarla).',
        confirm: 'Subir',
      });
      if (!ok) return;
      const { path, replaces } = editPaths(sharedCopy);
      opts = { path, create: !!replaces, ifMatch: sharedCopy.etag, replaces, replacesEtag: sharedCopy.etag };
    } else {
      const folder = await pickFolder({ section: 'bateria', title: `Subir a ${label}`, text: 'Elige la carpeta. Después la verá toda la banda y dejará de estar solo en este dispositivo.', tags: draft.tags });
      if (folder == null) return;
      opts = { path: newSongPath('bateria', folder, original.name), create: true };
    }
    saveBtn.disabled = true;
    try {
      await saveToLibrary({ ...opts, text: fileText(opts.path), dropLocal: [file.path] });
      await done(original.id, `Hoja subida a ${label}`);
    } catch (e) {
      console.error(e);
      saveBtn.disabled = false;
      msg.className = 'form-msg error';
      msg.textContent = 'No se pudo subir: ' + libraryErrorText(e, 'la hoja');
    }
  }

  async function exportCho() {
    const err = validateSheet(draft);
    if (err) {
      msg.className = 'form-msg error';
      msg.textContent = err;
      return;
    }
    await shareOrDownload(new Blob([fileText()], { type: 'text/plain;charset=utf-8' }), `${fileName()}.cho`);
  }

  async function removeOwn() {
    const text = sharedCopy
      ? 'Se borra la versión editada en este dispositivo y vuelve a verse la de la biblioteca compartida.'
      : 'Se borra de este dispositivo. Si no la has exportado, se perderá.';
    if (!(await confirmDialog({ title: sharedCopy ? '¿Volver a la versión compartida?' : '¿Borrar esta hoja?', text, confirm: sharedCopy ? 'Volver' : 'Borrar', danger: true }))) return;
    await db.deleteFiles([file.path]);
    await dropDraft();
    initial = structuredClone(draft);
    await reloadLibrary();
    toast(sharedCopy ? 'Se muestra de nuevo la versión compartida' : 'Hoja borrada');
    if (sharedCopy) goBackTo(backHref);
    else goBackTo(link('/canciones'), backHref);
  }

  el.append(
    fields,
    h('div.items-head', h('h3.section-title', 'Partitura'), modeSeg),
    pane,
    saveTarget.el,
    msg,
    h(
      'div.item-actions',
      h('button.btn.small.ghost', { onclick: exportCho }, icon('share', { size: 16 }), 'Exportar .cho'),
      isOwnLocal
        ? h('button.btn.small.ghost.danger-text', { onclick: removeOwn }, icon('trash', { size: 16 }), sharedCopy ? 'Volver a la versión compartida' : 'Borrar hoja')
        : null,
    ),
    h('div.editor-bar', h('button.btn.ghost', { onclick: goBack }, 'Cancelar'), saveBtn),
  );
  renderFields();
  renderPane();

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
