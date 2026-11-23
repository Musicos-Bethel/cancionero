# Cancionero Bethel

Cancionero digital (PWA) para el equipo de música: acordes en formato ChordPro,
partituras de batería y de metales (texto, PDF o imágenes) y listas por evento compartidas.
Se instala como una app en iPhone, iPad y Android y funciona sin conexión.

**App:** https://musicos-bethel.github.io/cancionero/

**Titularidad:** la app y este repositorio pertenecen a la iglesia, en la organización de GitHub
[Musicos-Bethel](https://github.com/Musicos-Bethel). La mantiene Nathanael (`dnathanospina`) junto con el
líder de banda; ambos son propietarios de la organización.

## Qué hace

- **Tres secciones:** *Voces e instrumentos*, *Batería* y *Metales*. En Metales hay un segundo selector, *Saxofón* | *Trompeta*. Se cambia con el selector de arriba.
- **Listas por evento** («Culto dominical», «Pascua»…) con fecha. La del próximo evento aparece destacada al abrir la app. Cada lista muestra la parte de cada sección de las mismas canciones; si un instrumento no tiene partitura de una canción, se abre la de voces con un aviso.
- **Metales con transposición:** saxofón y trompeta leen en otro tono que el de concierto. La app pasa el tono de la lista al tono escrito del instrumento (ver «Metales»).
- **ChordPro:** acordes encima de la letra, coros destacados, comentarios, tablaturas o ritmos de batería, tempo y compás.
- **Archivos `.txt`** con acordes encima de la letra: se convierten automáticamente.
- **Transponer** ± semitonos y **capo** (muestra las formas que se tocan y el tono que suena), en notación **americana (C D E)** o **latina (Do Re Mi)**. Se recuerda por canción y por lista.
- **Solo letra** para cantantes, **tamaño de letra**, **modo oscuro**.
- **PDF e imágenes página a página.** Deslizando a la izquierda pasas a la página siguiente; desde la última, a la siguiente canción de la lista (y al revés). Muestra la página (1/3) y avisa de cuál es la siguiente canción. El pellizco con dos dedos solo hace zoom. También hay vista *Continuo* con desplazamiento automático.
- **Deslizar entre canciones** de una lista también en las de texto: solo un gesto claramente horizontal, sin estorbar el desplazamiento ni la selección de texto.
- **Pantalla completa:** oculta las barras y un toque las muestra. En Android usa la pantalla completa del sistema; en iPhone, donde las PWA no pueden, se oculta la interfaz de la app.
- **Desplazamiento automático** con velocidad ajustable. Un toque en la partitura muestra u oculta los controles.
- **Pedal Bluetooth:** AvPág/↓ baja la pantalla (al final pasa a la siguiente canción de la lista), RePág/↑ sube, →/← cambian de canción, Espacio inicia o pausa el desplazamiento. En PDF/imágenes, el pedal pasa página y después canción. Las teclas se pueden cambiar en Ajustes.
- **Categorías** en Canciones, con su número de canciones (ver más abajo).
- **Escuchar:** cada canción puede tener su enlace (YouTube se abre en su app si está instalada), y cada lista tiene «Escuchar la lista» para preparar el ensayo.
- **La pantalla no se apaga** mientras hay una canción abierta.
- **Copia de seguridad** de los ajustes personales y de los archivos importados.
- **Modo líder con PIN** para crear, editar, duplicar y borrar las listas desde el móvil (ver más abajo).
- **Editor de canciones** (modo líder): crear y editar canciones de voces escribiendo los acordes encima de la letra, con vista previa. Se guardan en ChordPro.
- **Importar canciones a un solo dispositivo** (también exportaciones de SongBook y carpetas en .zip), para probar con canciones reales sin subirlas a ningún sitio.
- **Actualizaciones automáticas:** una versión nueva se instala sola, salvo si hay una canción abierta o una lista a medio editar; en ese caso espera hasta que se cierre.

## Estructura de la carpeta compartida

```
Cancionero/
├── Voces/                    canciones de voces e instrumentos
│   ├── Castillo fuerte.cho
│   └── ...
├── Bateria/                  mismo nombre = versión de batería de esa canción
│   ├── Castillo fuerte.pdf
│   ├── Himno nuevo/          una subcarpeta con imágenes = una canción de varias páginas
│   │   ├── 1.jpg
│   │   └── 2.jpg
│   └── ...
├── Metales/
│   ├── Saxofon/              partituras de saxofón (mismo nombre que la canción de voces)
│   ├── Trompeta/             partituras de trompeta
│   └── Doxologia.pdf         fuera de Saxofon/Trompeta = «general», la ven los dos
└── Listas/
    ├── 2026-11-15 Domingo.txt
    └── 2027-03-28 Pascua.txt
```

También puede haber una carpeta `Enlaces/` (ver «Enlaces para escuchar»).

Formatos admitidos: `.cho`, `.pro`, `.chordpro`, `.chopro`, `.crd`, `.txt`, `.pdf`, `.jpg`, `.png`, `.webp`, `.gif`.
Dentro de `Voces/`, `Bateria/`, `Metales/Saxofon/` y `Metales/Trompeta/` puedes crear subcarpetas (por ejemplo `Himnos/`): cada subcarpeta es una categoría.
La carpeta de cada instrumento se reconoce aunque se llame «Saxofón», «Sax alto», «Trompetas»…

### Categorías

No están fijas en el código: se generan a partir de los archivos.

- **Etiquetas de SongBook:** `{tag: Himnos}`. Puede haber varias directivas `{tag}`, y una canción puede estar en varias categorías. También se entienden `{category}`, `{categories}`, `{keywords}`, `{x_tag}` y `{x_sbp_tags}`, con valores separados por comas o punto y coma.
- **Subcarpetas**, como organiza SongBook las suyas: `Voces/Navidad/Noche de paz.cho`.
- **«Todas» y «Sin categoría»** se añaden solas.
- **Batería y metales:** heredan las categorías de su canción de voces, porque un PDF no puede llevar etiquetas.

### Emparejar voces, batería y metales

1. **Mismo nombre de archivo** en `Voces/` y en `Bateria/` o `Metales/…`. La extensión puede ser distinta, y no importan tildes, mayúsculas ni espacios de más.
2. Solo para batería, si los nombres no coinciden, añade al archivo de voces:
   `{x_bateria: Nombre del archivo de batería}`
3. En metales, la partitura del instrumento gana a la «general» si las dos tienen el mismo nombre.

Desde una canción, el menú «Más» ofrece «Ver versión de…» para pasar a las demás partes.

En *Ajustes → Revisión de nombres* se ven las canciones sin pareja y las de las listas que no se encuentran.

### Formato de las listas

Un archivo de texto en `Listas/`. Se puede editar desde la app de OneDrive en el móvil:

```
nombre: Culto dominical
fecha: 2026-11-15
hora: 11:00
notas: Santa cena al final

Castillo fuerte | tono: D
Santo santo santo | tono: Eb | notas: estrofa 2 solo piano
Amazing Grace
```

- **Cabecera:** `nombre`, `fecha` (`AAAA-MM-DD` o `DD/MM/AAAA`), y de forma opcional `hora`, `lugar` y `notas`. Si falta el nombre o la fecha, se toman del nombre del archivo (`2026-11-15 Domingo.txt`).
- **Canciones:** una por línea, con el nombre del archivo o el título. Si pones `tono`, la app transpone para todos. Las líneas que empiezan por `#` son comentarios.

### Enlaces para escuchar

Se puede indicar el enlace de tres maneras; la app entiende todas:

1. **En la canción:** `{x_youtube: https://www.youtube.com/watch?v=…}`. También `{youtube}`, `{link}` y `{url}`.
2. **Un archivo con muchas canciones** en `Enlaces/` (`.txt`, `.csv` o `.md`), una por línea:
   ```
   Castillo fuerte | https://www.youtube.com/watch?v=…
   Santo santo santo; https://youtu.be/…
   ```
   También vale el nombre en una línea y el enlace en la siguiente.
3. **Un archivo por canción** en `Enlaces/` con el mismo nombre: `.url` (acceso directo de Windows), `.webloc` (Mac) o `.txt` con el enlace dentro.

«Escuchar la lista» reproduce seguidas todas las canciones de YouTube (hasta 50) o permite abrirlas una a una.
La batería y los metales usan el enlace de su canción de voces.

## Metales: saxofón y trompeta

Son instrumentos transpositores: la nota escrita no es la que suena. Los tonos de las listas y de las
canciones de voces son **de concierto**, así que la app los convierte:

| Instrumento | Afinación | El tono escrito es |
|---|---|---|
| Trompeta | Si♭ | 2 semitonos más agudo (lista en D → se lee en E) |
| Saxofón alto / barítono | Mi♭ | 9 semitonos más agudo (lista en D → se lee en B) |
| Saxofón tenor / soprano | Si♭ | como la trompeta |

- La afinación del saxofón se elige en *Ajustes → Saxofón* (por defecto Mi♭, alto).
- **Partituras de metales en ChordPro:** se escriben en el tono del instrumento (`{key: …}` es el tono escrito). Si la lista pide otro tono, la app transporta.
- **Sin partitura propia:** se muestra la canción de voces con los acordes ya transportados para el instrumento, con el aviso «Sin partitura de saxofón/trompeta».
- PDF e imágenes no se transportan.

## Modo líder y editor de listas

En *Listas → Editar listas* (o en Ajustes) se introduce el PIN de líder. El modo líder se mantiene en ese
dispositivo hasta que se cierra la app.

- **Nueva lista:** con la plantilla «Domingo» (próximo domingo a la hora configurada en Ajustes, por
  defecto las 11:00) o «Evento especial». Tiene nombre, fecha, hora y una nota.
- **Canciones:** se añaden desde el cancionero con el buscador y las categorías. Se reordenan arrastrando
  por el asa ⋮⋮. A cada una se le puede fijar el tono del evento y una nota. Se ve si tiene versión de
  batería y enlace para escuchar.
- **Duplicar, editar y borrar** (con confirmación) desde la página de cada lista.
- **Guardar** escribe `Listas/AAAA-MM-DD Nombre.txt` en el formato de texto de arriba.
- **Sin conexión:** lo guardado queda «pendiente de subir» y se sube solo al recuperar la conexión. Si
  otra persona cambió la misma lista mientras tanto, aparece un conflicto con tres opciones: quedarse con
  su versión, sobrescribir con la mía o guardar la mía como copia.
- **Si se cierra la app a mitad de una edición,** al volver se ofrece recuperar los cambios.

### Editor de canciones (voces)

- **Crear:** *Canciones → Nueva canción* (solo en modo líder y en la sección Voces).
- **Editar:** en una canción de texto, menú «Más» → «Editar canción».
- **Campos:** título, autor, tono, tempo, compás, categorías (con sugerencias de las existentes) y enlace para escuchar.
- **Tres vistas:**
  - **Escribir:** como en papel, con los acordes encima de la letra (letra monoespaciada para alinearlos). «Estrofa 1», «Coro», «Puente»… en una línea sola son secciones. También se aceptan `[acordes]` dentro de la letra y directivas `{…}`.
  - **Vista previa:** con el lector real.
  - **ChordPro:** el mismo texto en el formato de SongBook.
- **Formato:** se guarda siempre en ChordPro (`.cho`). Las líneas con acordes demasiado juntos para ponerlos encima se dejan en ChordPro para no moverlos de su sílaba.
- **Dónde se guarda:** de momento **solo en el dispositivo** (hasta la escritura en OneDrive, fase 2c). «Exportar .cho» descarga o comparte el archivo para subirlo a la carpeta del cancionero.
- **Canciones compartidas:** editar una crea una copia en el dispositivo con el mismo nombre de archivo, que la sustituye allí (las listas y la batería la siguen encontrando). «Volver a la versión compartida» la deshace.
- **Borrador** automático con recuperación, como en el editor de listas. «Borrar importadas» no borra las canciones creadas con el editor.

### PIN

- **Dónde se guarda:** en `ajustes-lider.json`, junto a las listas. El archivo no contiene el PIN, sino
  una huella PBKDF2-SHA256 con sal y 310 000 iteraciones. El PIN nunca está en el repositorio.
- **Cómo se crea y cambia:** la primera vez, el líder lo crea desde la app; después se cambia en Ajustes.
- **Límites:** tiene un mínimo de 6 dígitos y, tras 5 intentos fallidos, hay que esperar 30 segundos.
- **Qué no protege:** el PIN evita cambios por error o sin permiso desde la app, pero no protege los
  archivos. Con la contraseña de la cuenta compartida se pueden editar directamente en OneDrive, y quien
  tenga el archivo podría averiguar un PIN corto por fuerza bruta (lento, pero posible).

### Dónde se escribe

El destino está en `src/config.js` (`WRITE_TARGET`). Hay dos opciones:

- **`appFolder`** (por defecto): `Aplicaciones/Cancionero Bethel/` en OneDrive. Necesita el permiso
  mínimo `Files.ReadWrite.AppFolder`, y así la app no puede tocar las canciones.
- **`library`**: dentro de la carpeta del cancionero. Necesita `Files.ReadWrite`.

La app usa rutas «lógicas» (`Listas/…`, `ajustes-lider.json`) y cada origen de datos las traduce, así
que cambiar de destino no afecta al editor.

### Estructura de carpetas configurable

En *Ajustes → Carpetas en OneDrive* se indica la carpeta del cancionero y dónde están las canciones de
voces, las partituras de batería y los enlaces. Si las canciones de voces se dejan vacías, toda la
carpeta cuenta como voces y sus subcarpetas son categorías, como las organiza SongBook. Así no hace falta
reorganizar la biblioteca. Se aplicará al conectar OneDrive.

## Importar canciones reales a un dispositivo

En *Ajustes → Importar canciones a este dispositivo*. Se guardan solo en ese teléfono: no se suben ni
llegan al repositorio, y se pueden borrar desde ahí mismo.

- **Formatos:** `.cho`, `.chopro`, `.chordpro`, `.pro`, `.crd`, `.txt`, PDF, imágenes y **`.zip`**. Sirve,
  por ejemplo, una exportación de SongBook o una carpeta de OneDrive descargada como .zip.
- **Subcarpetas del .zip:** se convierten en categorías. Si el .zip trae carpetas «Voces», «Batería» o
  «Metales» (con «Saxofon» y «Trompeta» dentro), se respetan.
- **Varias canciones en un archivo:** las separadas por `{new_song}` o `{ns}` se importan como canciones
  distintas.
- **Codificación:** se respetan las tildes y la ñ de archivos antiguos (Windows-1252).
- **Si la canción ya existe:** se elige entre reemplazarla u omitirla.

## Demostración

Mientras no haya conexión con OneDrive (fase 2), la app usa una biblioteca de demostración
(`public/demo/Cancionero`) con la misma estructura, incluidas partituras de metales de ejemplo
(Castillo fuerte para saxofón y trompeta, Amazing Grace para trompeta). Incluye solo himnos de dominio público:
Lutero/Cabrera, Heber/Cabrera, Newton, Crosby, Ken y Mohr/Fliedner.
El **PIN de líder de la demostración es `123456`**. Lo que se guarda va a una «OneDrive simulada» en el
dispositivo, con las mismas reglas que la real (pendientes sin conexión, conflictos). En Ajustes hay
botones para simular que otra persona cambia una lista y para restablecer la demostración. Tienen categorías de ejemplo, y
el botón «Escuchar» está desactivado porque no hay enlaces reales. Los acordes y las partituras de batería son
arreglos propios. En las listas de demostración, `@domingo` se sustituye por la fecha del próximo
domingo para que siempre haya un evento próximo.

## Diseño

Estilo iOS sobrio, con «liquid glass»:

- **Tipografía del sistema** (San Francisco en Apple, Roboto en Android).
- **Logo de la iglesia** en la cabecera, de una sola tinta: negro en modo claro y blanco en oscuro.
- **Títulos grandes** que se encogen en la barra superior al desplazar.
- **Fondo agrupado** `#F2F2F7` con listas blancas de esquinas redondeadas. Separadores finos y tonalidades en
  texto gris a la derecha («Re», «Mi♭»).
- **Dorado solo como acento:** `#DDA60D` en rellenos (punto del próximo culto, «Empezar», desplazamiento) y
  `#8A6400` en texto y acordes. En oscuro: negro puro, tarjetas `#1C1C1E` y acento `#E8B630`.
- **Cristal:**
  - La barra de pestañas es una cápsula flotante de cristal.
  - En la canción no hay barras fijas: volver, título, Escuchar/Más y los controles (tono, tamaño, solo
    letra) flotan sobre la letra. Se ocultan al desplazar hacia abajo y vuelven al tocar o al subir.
  - El desplazamiento automático es un botón dorado redondo. Capo, velocidad, tamaño de letra, pantalla
    completa y la otra versión están en «Más».
- **Fondos sólidos equivalentes** sustituyen al cristal si el sistema tiene «Reducir transparencia», si el
  navegador no admite `backdrop-filter` o en dispositivos lentos (`deviceMemory ≤ 4`, o `≤ 4` núcleos
  fuera de Apple). Se puede forzar en *Ajustes → Efecto cristal*.
- **Movimiento reducido:** se respeta `prefers-reduced-motion`.
- **Objetivos táctiles** de 44 px como mínimo.

## Logo

- **Archivo:** `public/brand/logo.svg`, vectorizado a partir de una imagen de la iglesia (blanco sobre gris).
- **Configuración:** `src/config.js` → `BRAND.logo` y `BRAND.logoRatio` (ancho / alto del `viewBox`).
- **Color:** se pinta con el color del texto mediante una máscara CSS, así que el SVG debe ser de una sola tinta (el color de relleno da igual).
- **Si se consigue el SVG original:** basta con sustituir el archivo y ajustar `logoRatio`.
- **Sin logo:** con `logo: null` se vuelve a mostrar el nombre «Bethel» en texto (Cabin).
- **Icono de la app:** sigue siendo el anterior (`public/icons/`, `scripts/generate-icons.mjs`).

## Desarrollo

Requiere Node 22.

```bash
npm install
```

```bash
npm run dev      # http://localhost:5173/cancionero/
```

```bash
npm test         # pruebas del lector ChordPro, transposición, listas y biblioteca
```

```bash
npm run build    # genera dist/
```

Scripts opcionales (usan Playwright con Chromium): `node scripts/generate-icons.mjs` y
`node scripts/generate-demo-charts.mjs` regeneran los iconos y las partituras de demostración.
`node scripts/demo-pin.mjs` regenera el `ajustes-lider.json` de la demostración (PIN 123456).

### Organización del código

| Carpeta | Contenido |
|---|---|
| `src/chordpro/` | Lector de ChordPro, conversión de `.txt` y del editor (`compose.js`: ChordPro ⇄ acordes encima) |
| `src/music/` | Acordes, notación americana/latina y transposición |
| `src/lists/` | Formato de las listas por evento |
| `src/links/` | Enlaces para escuchar (YouTube, archivos .url/.webloc/.txt/.csv) |
| `src/leader/` | Modo líder: PIN (PBKDF2), sesión en el dispositivo y ventanas |
| `src/lists/` (outbox) | Cambios pendientes de subir, subida con control de versiones y conflictos |
| `src/library/` | Biblioteca: secciones (voces, batería, saxofón, trompeta), emparejamiento, transposición de metales, búsqueda |
| `src/sources/` | Orígenes de datos (demostración; OneDrive en la fase 2) |
| `src/sync/` | Sincronización incremental y descarga de PDF/imágenes bajo demanda |
| `src/db.js` | Almacenamiento local (IndexedDB) |
| `src/viewers/` | Visores de ChordPro, PDF (pdf.js, carga diferida) e imágenes; página a página o continuo |
| `src/features/` | Desplazamiento automático, pedal, gestos, pantalla completa, escuchar, copias, instalación |
| `src/views/` | Pantallas: Inicio, Canciones, Listas, Canción, Ajustes, editor de listas y editor de canciones |

### Caché y sin conexión

- **La app** (código, fuentes, pdf.js) queda guardada por el service worker. Las actualizaciones se avisan con «Hay una versión nueva».
- **Textos** (ChordPro, `.txt`, listas): se descargan al actualizar, y solo los que cambiaron (por eTag).
- **PDF e imágenes:** se descargan los de las próximas listas, en todas las secciones, y los demás al abrirlos. En Ajustes se puede activar «descargar todo».

## Despliegue

Cada push a `main` ejecuta `.github/workflows/deploy.yml`: pruebas, compilación y publicación en
GitHub Pages. En cada PR el mismo flujo solo prueba y compila (comprobación `build`), sin publicar. Antes hay que activarlo una sola vez en *Settings → Pages → Source: GitHub Actions*.

## Estado y hoja de ruta

**Situación (23/11/2026):** migración hecha. El repositorio está en `Musicos-Bethel/cancionero` y la app
se publica en https://musicos-bethel.github.io/cancionero/. A partir de ahora se trabaja solo con este
repositorio. Antes de cualquier otra tarea, hacer los «Primeros pasos tras la migración» (abajo).
Después se retomará OneDrive (2b) con la dirección definitiva.

### Primeros pasos tras la migración (en este orden)

1. **Proteger `main`** (lo primero; fusionar en `main` publica la app para todos). En
   `Musicos-Bethel/cancionero` → *Settings → Rules → Rulesets → New ruleset → New branch ruleset*:
   - *Ruleset name*: `main`. *Enforcement status*: **Active**. Sin lista de *bypass*.
   - *Target branches → Add target → Include default branch*.
   - Marcar **Restrict deletions** y **Block force pushes**.
   - Marcar **Require a pull request before merging** con *Required approvals* = 0 (solo hay un
     mantenedor; la regla obliga a pasar por PR, no a que lo apruebe otra persona).
   - Marcar **Require status checks to pass** y añadir la comprobación **`build`** (el trabajo de
     `.github/workflows/deploy.yml`, que también se ejecuta en cada PR; aparece en la lista en cuanto
     ha corrido una vez, por ejemplo en el PR #9).
   - *Create*. Comprobar en *Settings → Rules* que la regla figura como activa.
2. **Actualizar las instrucciones del proyecto de Claude** (las cambia Nathanael en claude.ai: Proyecto
   «App.cancionero Iglesia» → instrucciones). Sustituir el texto por este:

   ```text
   Proyecto: Cancionero Bethel, una app (PWA) tipo SongBook para el equipo de música de la iglesia Bethel. Sirve para leer canciones con acordes, partituras de batería y de metales, y listas por evento, sin licencias externas.

   Dónde está
   - App publicada: https://musicos-bethel.github.io/cancionero/
   - Código: github.com/Musicos-Bethel/cancionero (repositorio público de la organización de la iglesia). El repositorio antiguo dnathanospina/cancionero ya no se usa.
   - Propietarios de la organización: Raúl (líder de banda) y yo, Nathanael (dnathanospina).
   - Documento del proyecto: claude/cancionero-migrado.md (estado, decisiones y pendientes).
   - Manual para el líder de banda: PDF «Cancionero Bethel – Manual para el líder de banda», en los archivos del proyecto.

   Al empezar cada sesión
   1. Lee claude/cancionero-migrado.md.
   2. En el repositorio, lee README.md (funciones, formatos, hoja de ruta y «Primeros pasos tras la migración») y CLAUDE.md (reglas de desarrollo).
   3. Si queda algún paso de «Primeros pasos tras la migración» sin hacer (por ejemplo, proteger main), hazlo antes que cualquier otra tarea, o dime qué tengo que hacer yo.
   4. Dime en una o dos frases qué vas a hacer y empieza.

   Cómo comunicarte conmigo
   - En español de España, directo y práctico.
   - No soy programador profesional: explica las decisiones técnicas en pocas palabras y con ejemplos de lo que verá el músico en el móvil.
   - Pregúntame antes de decisiones que no se puedan deshacer o que afecten a todos (publicar, borrar, cambiar la dirección de la app, cuentas o permisos).
   - Si algo lo tengo que hacer yo (verificar mi identidad en GitHub, aprobar un permiso, pegar unas instrucciones), dímelo paso a paso, con los nombres exactos de los botones.

   Cómo trabajar en el código
   - Una rama por tarea (claude/…) y un PR a main con un resumen en español: qué cambia y qué se ha comprobado.
   - main está protegida: los cambios entran solo por PR y con la comprobación build en verde.
   - Antes de abrir el PR: npm test y npm run build sin errores, y comprobación en Chrome móvil simulado (412 px): la página no se ensancha y no hay errores en la consola. Si cambia el aspecto, compruébalo también en tamaño tableta y en modo oscuro.
   - Fusiona los PR solo cuando yo lo pida. Al fusionar, la app se publica para todos los músicos.
   - Commits con la dirección noreply de GitHub (las indica CLAUDE.md).
   - Sin dependencias nuevas salvo que haya una buena razón, y explícamela.
   - Al terminar una tarea, actualiza claude/cancionero-migrado.md (estado, decisiones y pendientes) y el README si cambian funciones o pasos.

   Decisiones fijas
   - Diseño estilo iOS con cristal (Liquid Glass), sobrio, sin emojis ni rótulos en mayúsculas. Dorado solo como acento. Logo de la iglesia en la cabecera. Debe funcionar igual en iPhone (Safari) y Android (Chrome), móvil y tablet.
   - Tecnología: JavaScript sin framework, Vite, vite-plugin-pwa, IndexedDB, pdf.js y Vitest; publicación con GitHub Actions en GitHub Pages.
   - Nunca subir al repositorio canciones reales, correos ni datos de la iglesia. La demostración solo lleva himnos de dominio público y arreglos propios.
   - Secciones: Voces, Batería y Metales (Saxofón / Trompeta). Los tonos de las listas son de concierto y la app transporta para los metales.
   - La app tiene que funcionar sin conexión durante el culto: nada que dependa de internet en mitad de una canción, y las actualizaciones no deben interrumpir una canción abierta.
   - El modo líder (PIN) es un cerrojo contra cambios por error, no seguridad fuerte.

   En pausa (no empezar sin que yo lo diga)
   - OneDrive (fases 2b lectura y 2c escritura). Antes, Raúl debe registrar la app en Microsoft Entra con la URI de redirección https://musicos-bethel.github.io/cancionero/ y enviarme el Id. de aplicación (cliente); yo te lo confirmaré.
   - Dominio propio: no se usa. Si algún día se cambia, cambia la dirección de la app y todos tendrían que reinstalarla.

   Pendientes conocidos (detalle en claude/cancionero-migrado.md)
   - Proteger main y fusionar el PR #9 (mudanza a Musicos-Bethel).
   - Saber qué saxofón usan (alto en Mi♭ o tenor en Si♭), la hora del culto del domingo, el PIN real y el orden de las categorías.
   - Decidir si el icono de la app pasa a ser el logo.

   Siguiente paso propuesto: editor de batería (cuadrícula de ritmos y hoja de ruta por secciones), que no depende de OneDrive.
   ```
3. **Fusionar el PR #9** (dirección nueva y titularidad en README y CLAUDE.md) cuando Nathanael lo pida.
   Así se comprueba también que la regla de `main` deja fusionar con la comprobación en verde.
4. **Reinstalar la app** el líder de banda y Nathanael desde la dirección nueva (borrar antes el icono
   antiguo) y restaurar su copia si la exportaron.

| Entrega | Contenido | Estado |
|---|---|---|
| Fase 1 | Lector ChordPro, transposición, listas por evento, sin conexión, demostración | Publicada (PR #1) |
| Fase 1.5 | Batería página a página, categorías, Escuchar | Publicada (PR #2) |
| 2a | Modo líder con PIN, editor de listas, diseño iOS con cristal | Publicada (PR #3) |
| — | Zoom/página desplazada, pestañas más sensibles, sección Metales | Publicada (PR #4) |
| — | Editor de canciones de voces | Publicada (PR #5) |
| — | Logo de la iglesia | Publicada (PR #6) |
| — | Demostración aprobada por el líder de banda | 17/11/2026 |
| Migración | Repositorio a la organización de la iglesia | **Hecha (23/11/2026):** repositorio en `Musicos-Bethel`, publicada en la dirección nueva; falta proteger `main` |
| 2b | Lectura desde OneDrive | Después de la migración: falta el registro en Microsoft Entra (lo hace el líder de banda) |
| 2c | Escritura en OneDrive (listas y canciones creadas) | Después de 2b; falta decidir `appFolder` o `library` |
| — | Editor de batería (cuadrícula de ritmos y hoja de ruta) | Propuesto, sin empezar; no depende de OneDrive |

**Pendiente de decidir o confirmar:**
- La estructura real de carpetas de OneDrive.
- El PIN real y quién lo tiene.
- La hora del culto del domingo.
- Qué saxofón se usa.
- El orden de las categorías.
- Si se añade una licencia o una nota de titularidad.

## Migración a la organización de la iglesia

El repositorio se **transfiere** (no se copia) de `dnathanospina` a una organización gratuita de GitHub
de la iglesia. Se conservan el historial, los PR y el despliegue. La app pasará de
`https://dnathanospina.github.io/cancionero/` a `https://musicos-bethel.github.io/cancionero/` (organización
`Musicos-Bethel`, creada por el líder de banda el 23/11/2026).

### Decisiones tomadas
- **Propietarios (Owners):** el líder de banda y Nathanael, cada uno con su cuenta personal. Nathanael
  puede salir más adelante (Settings → Organizations → Leave) siempre que quede otro Owner.
- **Cuenta del líder:** creada con el correo de la banda y usada solo por él (GitHub no permite cuentas
  compartidas). Ese correo es también el de contacto de la organización. Nunca se escribe en el
  repositorio.
- **Nombre del repositorio:** se mantiene `cancionero`, así `BASE = '/cancionero/'` en `vite.config.js`
  sigue valiendo. Con dominio propio habría que cambiarlo a `/` y añadir `public/CNAME`.
- **Plan Free:** basta con repositorio público + Pages (Pages en un repositorio privado exige pago).
- **Azure antes no:** la URI de redirección de Microsoft Entra es la dirección de la app, así que el
  registro se hace después de la migración.
- **Manual para el líder:** PDF «Cancionero Bethel – Manual para el líder de banda» (cuenta de GitHub,
  verificación en dos pasos, organización, invitar a `dnathanospina` como Owner, alta en Azure, registro
  de la app y conexión con OneDrive). Está en el proyecto de Claude, no en el repositorio.

### Pasos (en orden)
1. **Líder de banda:** crea su cuenta, activa la verificación en dos pasos, crea la organización
   `Musicos-Bethel` (tipo empresa o institución, nombre de la iglesia) e invita a `dnathanospina` como **Owner**.
   Envía el nombre de la organización.
2. **Nathanael:** acepta la invitación (hecho el 23/11/2026).
3. **Transferir** (hecho el 23/11/2026): *Settings → General → Danger Zone → Transfer ownership* →
   `Musicos-Bethel`, nombre `cancionero`. GitHub pide confirmar la identidad por correo.
   GitHub redirige el repositorio, pero **no** la dirección de Pages: la antigua deja de funcionar.
   No crear otro repositorio `dnathanospina/cancionero` (rompería la redirección del repositorio).
4. **Publicar:** Pages se conservó con la transferencia (*Source: GitHub Actions*) y la app abre en la
   dirección nueva (comprobado el 23/11/2026). Si un despliegue falla, revisar *Settings → Environments →
   github-pages* y, en la organización, *Settings → Actions* (debe permitir las acciones oficiales).
5. **Proteger `main`:** pendiente; ver «Primeros pasos tras la migración».
6. **Acceso de Claude:** aplicación de Claude en GitHub instalada en `Musicos-Bethel` (23/11/2026). Las
   sesiones nuevas se abren con `Musicos-Bethel/cancionero` como repositorio. Las instrucciones del
   proyecto se actualizan en «Primeros pasos tras la migración».
7. **Repositorio (PR #9, rama `claude/mudanza-org`):** dirección nueva y titularidad en README y
   CLAUDE.md; `BASE` sin cambios.
8. **Sin página de mudanza (decidido el 23/11/2026):** en la dirección antigua solo tenían la app
   instalada el líder de banda y Nathanael, así que no se publica página de mudanza ni aviso de
   «restaurar copia». Cada uno exporta su copia en la dirección antigua (si aún abre sin conexión) y la
   restaura en la nueva.
9. **Músicos:** cuando se reparta la app, mensaje con la dirección nueva e instalación (iPhone: Safari →
   Compartir → Añadir a pantalla de inicio; Android: Chrome → Instalar app).
10. **Después:** el líder de banda registra la app en Microsoft Entra (solo cuentas personales de
    Microsoft, plataforma SPA, URI = dirección nueva con `/` final; permisos delegados `Files.Read`,
    `Files.ReadWrite.AppFolder`, `offline_access`) y envía el **Id. de aplicación (cliente)**. No es
    secreto y puede ir en el código. Entonces empieza la fase 2b.

### Datos de cada móvil
Los datos de la PWA van por origen: en la dirección nueva la app arranca vacía. La copia de seguridad
recupera ajustes, ajustes por canción y canciones de texto importadas o creadas con el editor. No
recupera PDF ni imágenes importados, las listas de la «OneDrive simulada» de la demostración ni la
sesión de modo líder.

### Vuelta atrás
Un Owner puede devolver el repositorio a `dnathanospina` con *Transfer ownership*. Por eso no se registra nada en Azure hasta que la
dirección nueva lleve unos días funcionando.
