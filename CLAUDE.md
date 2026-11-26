# Cancionero Bethel: instrucciones para Claude Code

PWA de cancionero (tipo SongBook) para el equipo de música de la iglesia Bethel. Mantenida por
Nathanael (pianista, no programador profesional): explicaciones en español, directas y prácticas.
El README describe todas las funciones, los formatos y la hoja de ruta: léelo antes de cambiar algo.

Repositorio: `Musicos-Bethel/cancionero` (organización de la iglesia; antes `dnathanospina/cancionero`).
App publicada: https://musicos-bethel.github.io/cancionero/
`main` está protegida: los cambios entran solo por PR y con la comprobación `build` en verde.

## OneDrive
- Conectado desde el 23/11/2026 (registro en Microsoft Entra del líder de banda; Id. en `src/config.js`).
  Inicio de sesión con PKCE propio (`src/sources/onedrive-auth.js`), lectura con Microsoft Graph
  (`src/sources/onedrive.js`). La demostración sigue siendo el origen por defecto.
- Permiso `Files.ReadWrite` (decidido por Nathanael el 23/11/2026, para eliminar canciones). Las listas
  y el PIN se escriben en la carpeta de la app (`Aplicaciones/Cancionero Bethel/`). En la carpeta de
  canciones la app solo borra, cuando el líder lo pide y con confirmación (`removeSong`). No escribas
  ni borres nada más ahí sin que Nathanael lo pida.
- Pruebas sin Microsoft: `tests/helpers/fake-drive.js` simula OneDrive (Graph y descargas).

## Reglas
- **Idioma:** todo en español de España (interfaz, comentarios, commits, PR). Interfaz sobria, sin emojis
  ni rótulos en mayúsculas.
- **Diseño:** estilo iOS con cristal (ver «Diseño» en el README). El dorado es solo un acento. La
  interfaz debe funcionar igual en iPhone (Safari) y Android (Chrome), móvil y tablet.
- **Tecnología:** JavaScript sin framework, Vite, vite-plugin-pwa, IndexedDB (idb), pdf.js y pruebas con `node:test` (`npm test`).
  No añadas dependencias sin una buena razón.
- **Repositorio público:** nunca subas canciones reales, correos ni datos de la iglesia. La demostración
  (`public/demo/`) solo lleva himnos de dominio público y arreglos propios. El correo de la cuenta de
  OneDrive no puede aparecer en el código.
- **Commits:** con la dirección noreply de GitHub
  (`327052196+dnathanospina@users.noreply.github.com`, nombre `dnathanospina`).
- **Flujo de trabajo:**
  - Una rama por tarea (`claude/…`) y un PR a `main` con un resumen en español de qué cambia y qué se
    ha comprobado.
  - Fusionar despliega en GitHub Pages; fusiona solo si Nathanael lo pide.
- **Antes de abrir el PR:**
  - Pasa `npm test` y `npm run build`.
  - Comprueba en Chrome móvil emulado (412 px, Playwright) que la página no se ensancha
    (`scrollWidth == clientWidth`) y que no hay errores en la consola.
- **Compatibilidad con SongBook:** la biblioteca real se edita también con SongBook. Al guardar se
  respetan sus directivas: autor en `{subtitle}`, tempo en `{metronome}`, duración en `{time: m:ss}`
  (no es el compás), `{soh}…{eoh}` y `{musicpath}`. El texto escrito en la vista ChordPro del editor
  se guarda tal cual.
- **Dispositivos antiguos (iOS 16):** no quites `src/util/compat.js` ni el worker propio de pdf.js
  (`src/viewers/pdf-worker.js`). Al actualizar pdf.js o usar funciones nuevas de JavaScript, busca en
  `node_modules/pdfjs-dist/legacy/build/` lo que Safari 16 no tenga y añádelo a `compat.js`; para
  probarlo, abre una partitura PDF en Chromium quitando antes esas funciones (en la página y en el worker).
- **Navegación:** «atrás» de la app = botón de Android = gesto de iPhone. Para volver usa `goBackTo`
  y para cambiar de pantalla sin apilar, `replaceTo` (`src/nav.js`); no uses `location.hash = …`
  para volver atrás.
- **Pruebas con canciones:** solo con letra inventada (nunca canciones reales en `tests/` ni en
  capturas que se suban).
- **No hay que tocar:**
  - Los tonos de listas y voces son de concierto; los metales se transportan
    (`writtenOffset` en `src/library/library.js`).
  - Las canciones creadas con el editor van con `origin: 'local'` y `source: 'editor'`.
