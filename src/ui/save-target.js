import { h } from './dom.js';
import { icon } from './icons.js';
import { choiceDialog } from './dialog.js';
import { canSaveToLibrary, libraryLabel, songFolders, suggestFolder, sectionFolder } from '../library/save-song.js';

/** Desplegable con las carpetas de la sección (la primera opción: la carpeta de la sección). */
function folderSelect(section, selected = '') {
  const base = sectionFolder(section) || 'Cancionero';
  const sel = h('select', { 'aria-label': 'Carpeta' }, h('option', { value: '' }, `${base} (sin carpeta)`), ...songFolders(section).map((f) => h('option', { value: f }, f)));
  sel.value = selected;
  return sel;
}

/**
 * Tarjeta «Guardar en» de los editores.
 *  kind 'new'    → elegir OneDrive (por defecto) o este dispositivo; con OneDrive, la carpeta
 *  kind 'remote' → canción de OneDrive: se guarda en su archivo (solo informa)
 *  kind 'local'  → canción del dispositivo: informa y ofrece «Subir a OneDrive» (onUpload)
 * Devuelve { el, target(), folder(), setTags(tags) }. target() = 'library' | 'local'.
 */
export function saveTargetCard({ kind, section, path = '', tags = [], onUpload, uploadLabel }) {
  const label = libraryLabel();
  const el = h('section.form-card.save-target');
  if (!canSaveToLibrary() || kind === 'local') {
    el.append(
      kind === 'local'
        ? h('div.save-info', icon('file', { size: 18 }), h('span', h('strong', 'Guardada solo en este dispositivo.'), ' No la ve el resto de la banda.'))
        : h('div.save-info', icon('file', { size: 18 }), h('span', h('strong', 'Se guarda en este dispositivo.'))),
      kind === 'local' && canSaveToLibrary()
        ? h('button.btn.small.primary.upload-btn', { type: 'button', onclick: onUpload }, icon('upload', { size: 16 }), uploadLabel ?? `Subir a ${label}`)
        : null,
    );
    return { el, target: () => 'local', folder: () => '', setTags() {} };
  }
  if (kind === 'remote') {
    el.append(h('div.save-info', icon('cloud', { size: 18 }), h('span', h('strong', `Se guarda en ${label}`), ' · ', h('span.path', path), '. Al guardar lo ve toda la banda.')));
    return { el, target: () => 'library', folder: () => '', setTags() {} };
  }

  // Nueva
  let target = 'library';
  let touched = false;
  const folders = songFolders(section);
  const sel = folderSelect(section, suggestFolder(tags, folders));
  sel.onchange = () => (touched = true);
  const folderField = h('label.field', h('span', 'Carpeta'), sel);
  const hint = h('p.set-desc');
  const seg = h('div.segmented.small.save-seg', { role: 'tablist', 'aria-label': 'Guardar en' });
  const render = () => {
    seg.replaceChildren(
      ...[
        ['library', label],
        ['local', 'Solo en este dispositivo'],
      ].map(([id, text]) =>
        h('button', { type: 'button', role: 'tab', 'aria-selected': String(target === id), class: target === id ? 'on' : '', onclick: () => ((target = id), render()) }, text),
      ),
    );
    folderField.hidden = target !== 'library';
    hint.textContent = target === 'library' ? 'La verá toda la banda (y SongBook) al actualizar.' : 'Solo la verás en este dispositivo. Luego podrás subirla.';
  };
  render();
  el.append(h('div.field', h('span', 'Guardar en'), seg), hint, folderField);
  return {
    el,
    target: () => target,
    folder: () => (target === 'library' ? sel.value : ''),
    setTags(t) {
      if (!touched) sel.value = suggestFolder(t, folders);
    },
  };
}

/** Pregunta la carpeta para subir una canción del dispositivo. Devuelve la carpeta ('' = la de la sección) o null. */
export function pickFolder({ section, title, text, tags = [] }) {
  const sel = folderSelect(section, suggestFolder(tags, songFolders(section)));
  return choiceDialog({
    title,
    text,
    body: [h('label.field', h('span', 'Carpeta'), sel)],
    options: [
      { value: 'cancel', label: 'Cancelar' },
      { value: 'ok', label: 'Subir', kind: 'primary' },
    ],
  }).then((r) => (r === 'ok' ? sel.value : null));
}
