import { h, clear } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { toast } from '../ui/toast.js';
import { state, setSettings, runSync, prefetchNeeded, DEFAULT_PEDAL, subscribe } from '../state.js';
import { PEDAL_ACTIONS, keyLabel } from '../features/pedal.js';
import { createBackup, shareOrDownload, restoreBackup } from '../features/backup.js';
import { importFiles, localSongCount, removeAllLocal } from '../features/local-import.js';
import { confirmDialog } from '../ui/dialog.js';
import { isLeader, hasPin, exitLeader } from '../leader/leader.js';
import { requestLeader, changePinSheet } from '../leader/leader-ui.js';
import { upcomingLists } from '../library/library.js';
import { currentSource, reloadLibrary, emitChange } from '../state.js';
import * as db from '../db.js';
import { WRITE_TARGET } from '../config.js';
import { startLogin, reconnect, signOut, sessionInfo, lastAccount } from '../sources/onedrive-auth.js';
import { glassReason } from '../features/glass.js';
import { linkReport, SECTION_LABEL, SECTION_SHORT, SECTIONS, isMetal } from '../library/library.js';
import { pageHeader, link } from '../ui/components.js';
import { timeAgo, plural } from '../ui/format.js';
import { todayISO } from '../util/text.js';

function segmented(name, value, options, onChange) {
  return h(
    'div.segmented.small',
    { role: 'radiogroup', 'aria-label': name },
    options.map(([v, label]) =>
      h('button', { role: 'radio', 'aria-checked': String(v === value), class: v === value ? 'on' : '', onclick: () => onChange(v) }, label),
    ),
  );
}

function row(title, desc, control) {
  return h('div.set-row', h('div.set-text', h('div.set-title', title), desc ? h('div.set-desc', desc) : null), control);
}

function toggle(label, checked, onChange) {
  return h(
    'label.switch',
    h('input', { type: 'checkbox', checked, 'aria-label': label, onchange: (e) => onChange(e.target.checked) }),
    h('span.slider'),
  );
}

const card = (title, ...children) => h('section.set-card', h('h2.group-title', title), h('div.group.set-group', ...children));

export function SettingsView() {
  const el = h('div.view.settings');
  const cleanups = [];

  async function syncAndReport() {
    const r = await runSync();
    if (r) toast(r.added || r.updated || r.removed ? 'Biblioteca actualizada' : 'La biblioteca ya está al día');
    else if (state.sync.error) toast(state.sync.error, { timeout: 6000 });
  }

  async function switchSource(v) {
    if (v === state.settings.source) return;
    const toOneDrive = v === 'onedrive';
    const ok = await confirmDialog({
      title: toOneDrive ? '¿Usar la biblioteca de OneDrive?' : '¿Volver a la demostración?',
      text: toOneDrive
        ? 'Se cargan las canciones y listas de la iglesia desde OneDrive. Hay que iniciar sesión con la cuenta de Microsoft compartida del equipo. Lo de la demostración deja de verse en este dispositivo.'
        : 'Se deja de ver la biblioteca de OneDrive en este dispositivo y se carga la demostración. Puedes volver cuando quieras.',
      confirm: toOneDrive ? 'Usar OneDrive' : 'Volver a la demostración',
    });
    if (!ok) return;
    // Los cambios pendientes y el modo líder eran del otro origen.
    for (const e of await db.outboxAll()) await db.outboxDelete(e.key);
    exitLeader();
    const remote = state.files.filter((f) => f.origin === 'remote').map((f) => f.path);
    if (remote.length) await db.deleteFiles(remote);
    await setSettings({ source: v });
    await reloadLibrary();
    emitChange('outbox');
    if (toOneDrive && !(await sessionInfo())) return startLogin({ returnHash: '#/ajustes', loginHint: (await lastAccount())?.user });
    syncAndReport();
  }

  /** Tarjeta de la sesión de OneDrive. */
  function oneDriveCard() {
    const status = h('div.set-desc', 'Comprobando…');
    const actions = h('div.set-actions');
    const body = row('Sesión', null, actions);
    body.querySelector('.set-text').append(status);
    sessionInfo().then(async (info) => {
      const acc = info?.account ?? (await lastAccount());
      if (info) {
        const ends = new Date(info.endsAt);
        status.textContent = `${acc?.name || acc?.user || 'Sesión iniciada'}${acc?.name && acc?.user ? ` (${acc.user})` : ''}. Hasta las ${ends.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}${ends.toDateString() !== new Date().toDateString() ? ' de mañana' : ''}.`;
        actions.replaceChildren(
          h('button.btn.small.ghost', {
            onclick: async () => {
              if (!(await confirmDialog({ title: '¿Cerrar la sesión de OneDrive?', text: 'Lo descargado se queda en el dispositivo y se puede seguir usando sin conexión. Para actualizar habrá que volver a iniciar sesión.', confirm: 'Cerrar sesión' }))) return;
              await signOut();
              render();
            },
          }, 'Cerrar sesión'),
        );
      } else {
        status.textContent = acc ? 'La sesión ha caducado. Lo descargado se sigue pudiendo usar; para actualizar, vuelve a iniciar sesión.' : 'Sin iniciar sesión.';
        actions.replaceChildren(
          h('button.btn.small.primary', { onclick: () => (acc?.user ? reconnect({ returnHash: '#/ajustes' }) : startLogin({ returnHash: '#/ajustes' })) }, acc ? 'Volver a entrar' : 'Iniciar sesión con Microsoft'),
        );
      }
    });
    return card(
      'OneDrive',
      body,
      h(
        'p.set-desc.card-note',
        'Inicia sesión con la cuenta de Microsoft compartida del equipo. Microsoft limita la sesión a 24 horas: después, la app sigue funcionando con lo descargado y solo pide iniciar sesión otra vez para actualizar.',
      ),
      filesNote(),
      state.sync.error ? h('p.set-desc.card-note.error-text', state.sync.error) : null,
      state.sync.folders?.length ? folderChips(state.sync.folders) : null,
    );
  }

  /** Cuántos archivos hay en OneDrive y cuántos usa la app (para ver de un vistazo si las carpetas encajan). */
  function filesNote() {
    const last = state.sync.last;
    if (!last || last.source !== 'onedrive' || last.total == null) return null;
    const name = (p) => p.split('/').pop();
    const lines = [`En la última actualización: ${plural(last.total, 'archivo', 'archivos')} en la carpeta del cancionero y la de la app; la app usa ${last.recognized}.`];
    if (last.total && !last.recognized) {
      return h('p.set-desc.card-note.error-text', lines[0], ' Ninguno encaja con las carpetas: revisa «Carpetas en OneDrive».');
    }
    if (last.ignored?.length) lines.push(`No se usan, por ejemplo: ${last.ignored.map(name).join(', ')}.`);
    return h('p.set-desc.card-note', lines.join(' '));
  }

  function folderChips(folders) {
    return h(
      'div.tag-suggest.card-note',
      folders.map((f) =>
        h('button.cat-chip', {
          type: 'button',
          onclick: async () => {
            await setSettings({ layout: { ...state.settings.layout, root: f } });
            syncAndReport();
          },
        }, f),
      ),
    );
  }

  /** Botón para ver las carpetas de OneDrive y elegir la del cancionero. */
  function folderPicker() {
    const slot = h('div.folder-picker');
    slot.append(
      h('button.btn.small.ghost', {
        type: 'button',
        onclick: async () => {
          slot.replaceChildren(h('p.set-desc', 'Buscando carpetas…'));
          try {
            const folders = await currentSource().rootFolders();
            slot.replaceChildren(
              h('p.set-desc', folders.length ? 'Toca la carpeta del cancionero:' : 'No hay carpetas en OneDrive.'),
              folderChips(folders.sort((a, b) => a.localeCompare(b, 'es'))),
            );
          } catch (e) {
            slot.replaceChildren(h('p.set-desc.error-text', e.name === 'LoginRequiredError' ? 'Primero inicia sesión en OneDrive.' : `No se pudieron leer las carpetas: ${e.message}`));
          }
        },
      }, icon('cloud', { size: 16 }), 'Ver carpetas de OneDrive'),
    );
    return slot;
  }

  function render() {
    const s = state.settings;
    clear(el);
    el.append(pageHeader('Ajustes'));

    el.append(
      card(
        'Lectura',
        row(
          'Sección',
          'Qué parte del cancionero ves por defecto.',
          segmented('Sección', s.section, [['voces', 'Voces'], ['bateria', 'Batería'], ['saxofon', 'Saxo'], ['trompeta', 'Trompeta']], (v) =>
            setSettings(isMetal(v) ? { section: v, metal: v } : { section: v }),
          ),
        ),
        row(
          'Saxofón',
          'Afinación del saxo para transportar los tonos de la lista.',
          segmented('Saxofón', s.saxTuning, [['Eb', 'Mi♭ (alto)'], ['Bb', 'Si♭ (tenor)']], (v) => setSettings({ saxTuning: v })),
        ),
        row('Notación de acordes', s.notation === 'latin' ? 'Do Re Mi Fa Sol La Si' : 'C D E F G A B', segmented('Notación', s.notation, [['american', 'C D E'], ['latin', 'Do Re Mi']], (v) => setSettings({ notation: v }))),
        row('Tema', null, segmented('Tema', s.theme, [['auto', 'Auto'], ['light', 'Claro'], ['dark', 'Oscuro']], (v) => setSettings({ theme: v }))),
        row(
          'Efecto cristal',
          s.glass === 'auto' ? glassReason() : s.glass === 'on' ? 'Siempre activado.' : 'Desactivado: fondos sólidos (más ligero).',
          segmented('Efecto cristal', s.glass, [['auto', 'Auto'], ['on', 'Sí'], ['off', 'No']], (v) => setSettings({ glass: v })),
        ),
        row('Solo letra', 'Oculta los acordes (para cantantes).', toggle('Solo letra', s.lyricsOnly, (v) => setSettings({ lyricsOnly: v }))),
        row(
          'Tamaño de letra',
          `${Math.round(s.fontScale * 100)} %`,
          h(
            'div.stepper',
            h('button.ctl-btn', { 'aria-label': 'Más pequeña', onclick: () => setSettings({ fontScale: Math.max(0.7, Math.round((s.fontScale - 0.1) * 10) / 10) }) }, icon('minus', { size: 20 })),
            h('button.ctl-btn', { 'aria-label': 'Más grande', onclick: () => setSettings({ fontScale: Math.min(2.4, Math.round((s.fontScale + 0.1) * 10) / 10) }) }, icon('plus', { size: 20 })),
          ),
        ),
        h('div.preview', { style: { '--fs': s.fontScale } }, h('div.line.has-chords', h('span.w', chunk('G', 'Sublime '), chunk('C', 'gra'), chunk('', 'cia')))),
      ),
    );

    // Modo líder
    const leader = isLeader();
    const timeInput = h('input.time-input', {
      type: 'time',
      value: s.sundayTime || '11:00',
      'aria-label': 'Hora habitual del domingo',
      onchange: (e) => e.target.value && setSettings({ sundayTime: e.target.value }),
    });
    el.append(
      card(
        'Listas y modo líder',
        row(
          'Modo líder',
          leader ? 'Activo en este dispositivo hasta que cierres la app.' : hasPin() ? 'Para crear y editar las listas hace falta el PIN.' : 'Todavía no hay PIN de líder.',
          leader
            ? h('button.btn.small.ghost', { onclick: () => (exitLeader(), toast('Has salido del modo líder')) }, icon('lock', { size: 16 }), 'Salir')
            : h('button.btn.small.primary', { onclick: () => requestLeader() }, icon('unlock', { size: 16 }), hasPin() ? 'Entrar' : 'Crear PIN'),
        ),
        leader ? row('PIN de líder', 'Cámbialo si lo conoce alguien que no debería.', h('button.btn.small.ghost', { onclick: () => changePinSheet() }, 'Cambiar PIN')) : null,
        row('Hora habitual del domingo', 'La propone la plantilla «Domingo» al crear una lista.', timeInput),
        h(
          'p.honest',
          'Sobre la seguridad: el PIN impide editar listas desde la app sin permiso, pero no protege los archivos. Con la contraseña de la cuenta compartida se pueden cambiar directamente en OneDrive.',
        ),
      ),
    );

    // Pedal
    const pedalRows = Object.entries(PEDAL_ACTIONS).map(([action, label]) => {
      const keys = s.pedal[action] ?? [];
      const btn = h('button.btn.small.ghost', { 'aria-label': `Cambiar tecla para ${label}` }, keys.length ? keys.map(keyLabel).join(' · ') : 'Sin asignar');
      btn.onclick = () => {
        btn.textContent = 'Pulsa el pedal…';
        btn.classList.add('listening');
        const onKey = (e) => {
          e.preventDefault();
          window.removeEventListener('keydown', onKey, true);
          if (e.key === 'Escape') return render();
          const pedal = { ...state.settings.pedal };
          for (const k of Object.keys(pedal)) pedal[k] = pedal[k].filter((x) => x !== e.key);
          pedal[action] = [e.key];
          setSettings({ pedal });
        };
        window.addEventListener('keydown', onKey, true);
      };
      return row(label, null, btn);
    });
    el.append(
      card(
        'Pedal Bluetooth',
        h('p.set-desc', 'Empareja el pedal en los ajustes Bluetooth del teléfono. Para cambiar una tecla, pulsa el botón y después el pedal.'),
        ...pedalRows,
        row('Pasar de canción al final', 'Si ya estás al final, «Bajar pantalla» abre la siguiente canción de la lista.', toggle('Pasar de canción al final', s.autoAdvance, (v) => setSettings({ autoAdvance: v }))),
        h('div.set-actions', h('button.btn.small.ghost', { onclick: () => setSettings({ pedal: DEFAULT_PEDAL }) }, 'Restablecer teclas')),
      ),
    );

    // Biblioteca
    const last = state.sync.last;
    const storage = h('span', '…');
    navigator.storage?.estimate?.().then((e) => {
      storage.textContent = `${(e.usage / 1048576).toFixed(1)} MB usados`;
    });
    el.append(
      card(
        'Biblioteca',
        row(
          'Origen',
          s.source === 'onedrive' ? 'Las canciones y listas de la iglesia, en OneDrive.' : 'Biblioteca de demostración con himnos de dominio público.',
          segmented('Origen', s.source, [['demo', 'Demostración'], ['onedrive', 'OneDrive']], switchSource),
        ),
        row(
          'Última actualización',
          last ? timeAgo(last.at) : 'Nunca',
          h('button.btn.small.primary', { disabled: state.sync.running, onclick: () => runSync() }, icon('refresh', { size: 16 }), state.sync.running ? 'Actualizando…' : 'Actualizar'),
        ),
        row('PDF e imágenes', 'Se guardan los de las próximas listas. Activa esto para tener todo sin conexión (ocupa más espacio).', toggle('Descargar todo', s.downloadAll, async (v) => {
          await setSettings({ downloadAll: v });
          if (v) {
            const n = await prefetchNeeded();
            toast(n ? `${plural(n, 'archivo descargado', 'archivos descargados')}` : 'Todo está descargado');
          }
        })),
        row('Espacio en el dispositivo', null, storage),
      ),
    );

    if (s.source === 'onedrive') el.append(oneDriveCard());

    if (s.source === 'demo') {
      const upcoming = upcomingLists(state.library);
      const listSel = h('select', { 'aria-label': 'Lista' }, upcoming.map((l) => h('option', { value: l.id }, l.name)));
      el.append(
        card(
          'Pruebas de la demostración',
          h('p.set-desc', 'En la demostración, lo que guarda el modo líder va a una «OneDrive simulada» dentro de este dispositivo, con las mismas reglas que la real: si no hay conexión queda pendiente, y si otra persona cambió la lista aparece un conflicto.'),
          upcoming.length
            ? row(
                'Simular que otra persona cambia una lista',
                'Después edita esa misma lista y guárdala para ver el aviso de conflicto.',
                h(
                  'div.inline-controls',
                  listSel,
                  h('button.btn.small.ghost', {
                    onclick: async () => {
                      await currentSource().simulateOtherEdit(listSel.value);
                      toast('Hecho: alguien ha cambiado la lista en la OneDrive simulada. Este móvil aún no lo sabe.');
                    },
                  }, 'Simular'),
                ),
              )
            : null,
          row(
            'Restablecer la demostración',
            'Borra las listas creadas o cambiadas en la demostración y los cambios pendientes.',
            h('button.btn.small.ghost.danger-text', {
              onclick: async () => {
                if (!(await confirmDialog({ title: '¿Restablecer la demostración?', text: 'Se perderán las listas creadas o editadas en la demostración.', confirm: 'Restablecer', danger: true }))) return;
                await currentSource().reset();
                for (const e of state.outbox) await db.outboxDelete(e.key);
                await db.kvDelete('editor-borrador');
                await reloadLibrary();
                await runSync({ quiet: true });
                emitChange('outbox');
                toast('Demostración restablecida');
              },
            }, 'Restablecer'),
          ),
        ),
      );
    }

    // Estructura de carpetas en OneDrive (se usará al conectar OneDrive)
    const layout = s.layout;
    const layoutField = (key, label, hint) =>
      h(
        'label.field',
        h('span', label),
        h('input', {
          type: 'text',
          value: layout[key] ?? '',
          placeholder: hint,
          autocomplete: 'off',
          autocapitalize: 'off',
          spellcheck: 'false',
          onchange: async (e) => {
            await setSettings({ layout: { ...state.settings.layout, [key]: e.target.value.trim().replace(/^\/+|\/+$/g, '') } });
            if (state.settings.source === 'onedrive') syncAndReport();
          },
        }),
      );
    el.append(
      card(
        'Carpetas en OneDrive',
        h('p.set-desc', 'Para adaptarse a la biblioteca que ya tenéis (SongBook) sin reorganizar nada. Las carpetas de dentro se escriben relativas a la carpeta del cancionero. En la demostración no cambia nada.'),
        layoutField('root', 'Carpeta del cancionero', 'Por ejemplo: SongBook'),
        s.source === 'onedrive' ? folderPicker() : null,
        layoutField('voces', 'Canciones de voces e instrumentos', 'Vacío = toda la carpeta (las subcarpetas son categorías)'),
        layoutField('bateria', 'Partituras de batería', 'Por ejemplo: Partituras batería'),
        layoutField('metales', 'Partituras de metales', 'Dentro, una carpeta por instrumento: Saxofon y Trompeta'),
        layoutField('enlaces', 'Enlaces para escuchar', 'Por ejemplo: Enlaces'),
        h(
          'p.set-desc',
          'Las listas y el PIN se guardarán en ',
          h('strong', WRITE_TARGET.location === 'appFolder' ? `Aplicaciones/Cancionero Bethel/${WRITE_TARGET.listsFolder}` : `${layout.root}/${WRITE_TARGET.listsFolder}`),
          WRITE_TARGET.location === 'appFolder' ? ' (carpeta propia de la app).' : '.',
          WRITE_TARGET.songs ? ' En modo líder se pueden eliminar canciones desde «Más» en cada canción: van a la papelera de OneDrive.' : '',
        ),
      ),
    );

    // Importar
    const sectionSel = h(
      'select',
      { 'aria-label': 'Sección', value: s.section },
      SECTIONS.map((sec) => h('option', { value: sec, selected: sec === s.section }, SECTION_LABEL[sec])),
    );
    let duplicates = 'replace';
    const dupSwitch = segmented('Si ya existe', duplicates, [['replace', 'Reemplazar'], ['skip', 'Omitir']], (v) => {
      duplicates = v;
      [...dupSwitch.children].forEach((b, i) => {
        const on = (i === 0) === (v === 'replace');
        b.classList.toggle('on', on);
        b.setAttribute('aria-checked', String(on));
      });
    });
    const status = h('p.form-msg', { role: 'status' });
    const fileInput = h('input', {
      type: 'file',
      multiple: true,
      hidden: true,
      onchange: async (e) => {
        const files = [...e.target.files];
        e.target.value = '';
        if (!files.length) return;
        try {
          const r = await importFiles(files, sectionSel.value, { duplicates, onProgress: (m) => (status.textContent = m) });
          const parts = [];
          if (r.added) parts.push(plural(r.added, 'canción nueva', 'canciones nuevas'));
          if (r.replaced) parts.push(plural(r.replaced, 'reemplazada', 'reemplazadas'));
          if (r.skipped) parts.push(plural(r.skipped, 'omitida (ya existía)', 'omitidas (ya existían)'));
          if (r.unsupported.length) parts.push(plural(r.unsupported.length, 'archivo no admitido', 'archivos no admitidos'));
          toast(parts.length ? 'Importación: ' + parts.join(', ') : 'No se importó nada', { timeout: 6000 });
        } catch (err) {
          console.error(err);
          toast('No se pudo importar: ' + (err.message || err));
        }
        status.textContent = '';
      },
    });
    const nLocal = localSongCount();
    el.append(
      card(
        'Importar canciones a este dispositivo',
        h('p.set-desc', 'Para probar con vuestras canciones reales: se guardan solo en este teléfono, nunca se suben ni se comparten.'),
        h(
          'ul.help-list',
          h('li', h('strong', 'Desde SongBook: '), 'comparte o exporta las canciones en formato ChordPro (una, varias o todas en un .zip) y elígelas aquí.'),
          h('li', h('strong', 'Desde OneDrive: '), 'elige los archivos en el selector, o descarga una carpeta como .zip: sus subcarpetas se convierten en categorías.'),
          h('li', 'Formatos: .cho, .chopro, .chordpro, .pro, .crd, .txt, PDF, imágenes y .zip. Respeta tildes y ñ de archivos antiguos.'),
        ),
        row('Sección', 'Si el .zip trae carpetas «Voces», «Batería» o «Metales» (con «Saxofon» y «Trompeta» dentro), se respetan.', sectionSel),
        row('Si la canción ya existe', null, dupSwitch),
        status,
        h(
          'div.set-actions',
          h('button.btn.small.primary', { onclick: () => fileInput.click() }, icon('upload', { size: 16 }), 'Elegir archivos'),
          fileInput,
          nLocal
            ? h('button.btn.small.ghost.danger-text', {
                onclick: async () => {
                  if (!(await confirmDialog({ title: '¿Borrar las canciones importadas?', text: `Se borrarán ${plural(nLocal, 'archivo importado', 'archivos importados')} de este dispositivo. La biblioteca compartida no cambia.`, confirm: 'Borrar', danger: true }))) return;
                  const n = await removeAllLocal();
                  toast(plural(n, 'archivo borrado', 'archivos borrados'));
                },
              }, icon('trash', { size: 16 }), `Borrar importadas (${nLocal})`)
            : null,
        ),
      ),
    );

    // Revisión de nombres
    const rep = linkReport(state.library);
    const details = (title, items, fmt) =>
      h('details.review', h('summary', h('span', title), h('span.count', String(items.length))), items.length ? h('ul', items.slice(0, 200).map((x) => h('li', fmt(x)))) : h('p.muted', 'Todo correcto.'));
    el.append(
      card(
        'Revisión de nombres',
        h('p.set-desc', 'Las partituras de batería y metales se emparejan con la canción por nombre de archivo (la de batería también con {x_bateria: …} en el archivo de voces).'),
        details('Voces sin versión de batería', rep.vocesSinBateria, (s) => s.title),
        details('Batería sin canción de voces', rep.bateriaSinVoces, (s) => s.name),
        details('Metales sin canción de voces', rep.metalesSinVoces, (s) => `${s.name} (${SECTION_SHORT[s.section].toLowerCase()})`),
        details('Canciones de listas no encontradas', rep.noEncontradas, (x) => `${x.item.name} — ${x.list.name}`),
        details('Archivos repetidos', rep.duplicados, (s) => s.path),
      ),
    );

    // Copias de seguridad
    const restoreInput = h('input', {
      type: 'file',
      hidden: true,
      onchange: async (e) => {
        const f = e.target.files[0];
        e.target.value = '';
        if (!f) return;
        try {
          const r = await restoreBackup(f);
          toast(`Copia restaurada: ${plural(r.prefs, 'ajuste de canción', 'ajustes de canción')}, ${plural(r.files, 'archivo', 'archivos')}`);
        } catch (err) {
          toast(err.message);
        }
      },
    });
    el.append(
      card(
        'Copia de seguridad',
        h('p.set-desc', 'Guarda tus ajustes (tono y capo por canción, zoom, velocidad, pedal…) y los archivos importados en este dispositivo. Las canciones compartidas se recuperan al actualizar.'),
        h(
          'div.set-actions',
          h('button.btn.small.primary', { onclick: async () => shareOrDownload(await createBackup(), `cancionero-copia-${todayISO()}.json`) }, icon('download', { size: 16 }), 'Exportar'),
          h('button.btn.small.ghost', { onclick: () => restoreInput.click() }, icon('upload', { size: 16 }), 'Restaurar'),
          restoreInput,
        ),
      ),
    );

    el.append(h('p.about', `Cancionero Bethel · versión ${__APP_VERSION__}`));
  }

  render();
  // Durante la sincronización solo se repinta al empezar y al terminar.
  let wasRunning = state.sync.running;
  cleanups.push(
    subscribe((w) => {
      if (w === 'sync' && state.sync.running === wasRunning) return;
      wasRunning = state.sync.running;
      if (['settings', 'sync', 'library', 'leader', 'outbox'].includes(w)) render();
    }),
  );
  return { el, destroy: () => cleanups.forEach((f) => f()) };
}

function chunk(chord, text) {
  return h('span.c.has-chord', chord ? h('span.ch', chord) : null, h('span.ly', text));
}
