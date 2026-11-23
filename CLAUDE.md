# Cancionero Bethel: instrucciones para Claude Code

PWA de cancionero (tipo SongBook) para el equipo de música de la iglesia Bethel. Mantenida por
Nathanael (pianista, no programador profesional): explicaciones en español, directas y prácticas.
El README describe todas las funciones, los formatos y la hoja de ruta: léelo antes de cambiar algo.

Repositorio: `Musicos-Bethel/cancionero` (organización de la iglesia; antes `dnathanospina/cancionero`).
App publicada: https://musicos-bethel.github.io/cancionero/
`main` está protegida: los cambios entran solo por PR y con la comprobación `build` en verde.

## Reglas
- **Idioma:** todo en español de España (interfaz, comentarios, commits, PR). Interfaz sobria, sin emojis
  ni rótulos en mayúsculas.
- **Diseño:** estilo iOS con cristal (ver «Diseño» en el README). El dorado es solo un acento. La
  interfaz debe funcionar igual en iPhone (Safari) y Android (Chrome), móvil y tablet.
- **Tecnología:** JavaScript sin framework, Vite, vite-plugin-pwa, IndexedDB (idb), pdf.js y Vitest.
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
- **No hay que tocar:**
  - OneDrive (fases 2b y 2c) está en pausa hasta que Nathanael confirme el registro en Azure con el
    líder de banda. No lo empieces por tu cuenta.
  - Los tonos de listas y voces son de concierto; los metales se transportan
    (`writtenOffset` en `src/library/library.js`).
  - Las canciones creadas con el editor van con `origin: 'local'` y `source: 'editor'`.
