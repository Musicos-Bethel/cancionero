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
- **Editor de hojas de batería** (modo líder): ritmos en cuadrícula que se rellenan tocando las casillas y hoja de ruta por secciones. Se guardan en ChordPro.
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

### Editor de hojas de batería

- **Crear:** *Canciones → Batería → Nueva hoja de batería*, o desde una canción de voces sin batería: menú «Más» → «Crear hoja de batería» (ya sale con su título y tempo, para que queden emparejadas).
- **Editar:** en una hoja de batería de texto, menú «Más» → «Editar hoja de batería».
- **Datos:** canción (con sugerencias de los títulos de voces; avisa de si quedará emparejada), descripción, tempo y compás.
- **Ritmos como cuadrícula:** una fila por instrumento y una casilla por paso. Al tocar una casilla se pone un golpe; otra vez, un acento; otra, se quita. Se elige el número de tiempos (1–8) y la subdivisión (negras, corcheas, tresillos, semicorcheas, sextillos); al cambiarla se conservan los golpes que caen en el mismo sitio. Instrumentos: plato, ride, charles, charles con el pie, toms, caja, aro, tom base y bombo. Cada ritmo se puede duplicar.
- **Hoja de ruta:** las partes de la canción en orden (sección, ritmo y compases, nota), reordenables arrastrando. Botones para añadir Intro, Estrofa, Coro, Puente… y para poner el nombre de un ritmo.
- **Vista previa y ChordPro**, como en el editor de canciones. Lo que el editor no entiende (un coro con texto, una tablatura que no es de batería) se conserva tal cual.
- **Formato** (ChordPro, se abre también en SongBook como tablatura):
  ```
  {title: Castillo fuerte}
  {tempo: 76}
  {time: 4/4}

  {start_of_tab: Ritmo A · estrofas}
         1 & 2 & 3 & 4 &
  Ch   | x x x x x x x x |
  Caja | . . o . . . o . |
  Bom  | o . . . o . . . |
  {end_of_tab}

  {c: Estrofa 1 · Ritmo A · 8 compases}
  {ci: Entrar suave}
  ```
  `x` platos, `o` tambores y bombo, en mayúscula con acento, `.` nada. También se leen cuadrículas sin espacios (`HH|x-x-x-x-|`).
- **En el lector** los ritmos se ven como cuadrícula (× platos, ● tambores, acentos en dorado) en lugar de texto monoespaciado.
- **Dónde se guarda:** igual que las canciones de voces: en el dispositivo (`local/Bateria/`), con «Exportar .cho», copia de una hoja compartida y borrador automático.

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
reorganizar la biblioteca. «Ver carpetas de OneDrive» enseña las carpetas de la raíz para elegir la del
cancionero con un toque; si la carpeta no existe, la app lo dice y propone las que hay.

## Conexión con OneDrive

*Ajustes → Biblioteca → Origen → OneDrive*. La app pide iniciar sesión con la cuenta de Microsoft
compartida del equipo (en la página de Microsoft: la contraseña nunca pasa por la app) y descarga la
biblioteca. Después funciona sin conexión con lo descargado, como con la demostración.

- **Registro en Microsoft Entra** (hecho por el líder de banda el 23/11/2026): solo cuentas personales de
  Microsoft, plataforma SPA, URI de redirección `https://musicos-bethel.github.io/cancionero/`, permisos
  delegados `Files.Read`, `Files.ReadWrite.AppFolder`, `offline_access` y `User.Read` (este lo añade
  Microsoft solo; sirve para iniciar sesión y mostrar la cuenta). El Id. de aplicación está en
  `src/config.js` (`ONEDRIVE.clientId`); no es secreto.
- **Inicio de sesión:** OAuth 2.0 con PKCE y redirección a Microsoft (sin bibliotecas externas:
  `src/sources/onedrive-auth.js`). Al volver, la app termina el proceso y limpia la dirección.
- **La sesión dura 24 horas.** Es un límite de Microsoft para las apps web y no se puede alargar. Pasado
  ese tiempo la app sigue funcionando con todo lo descargado; al actualizar avisa («La sesión de OneDrive
  ha caducado») con un botón para volver a entrar. Si Microsoft recuerda la cuenta en el navegador, es un
  toque. Nunca se pide en mitad de una canción: solo al pulsar «Iniciar sesión».
- **Lectura** (`src/sources/onedrive.js`, Microsoft Graph): recorre la carpeta del cancionero y sus
  subcarpetas, descarga los textos que cambian (por eTag) y los PDF e imágenes de las próximas listas. Los
  archivos se descargan de la dirección temporal que da OneDrive, sin enviar el token.
- **Listas y PIN del modo líder:** en `Aplicaciones/Cancionero Bethel/` (la carpeta que OneDrive crea para
  la app), con control de versiones y conflictos como en la demostración. La app no puede escribir ni
  borrar en la carpeta de canciones. Una carpeta `Listas` dentro de la carpeta del cancionero no se usa.
- **Canciones y hojas creadas con los editores:** siguen guardándose en el dispositivo (fase 2c).
- **Cambiar de origen** borra del dispositivo la biblioteca del origen anterior, los cambios pendientes y
  la sesión de modo líder (lo importado y lo creado con los editores se queda).
- **Cerrar sesión:** *Ajustes → OneDrive → Cerrar sesión*. Lo descargado se queda.

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

Si en *Ajustes → Origen* está elegida «Demostración» (la opción por defecto), la app usa una biblioteca de demostración
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
| `src/drums/` | Hojas de batería: cuadrícula de ritmos y hoja de ruta ⇄ ChordPro |
| `src/music/` | Acordes, notación americana/latina y transposición |
| `src/lists/` | Formato de las listas por evento |
| `src/links/` | Enlaces para escuchar (YouTube, archivos .url/.webloc/.txt/.csv) |
| `src/leader/` | Modo líder: PIN (PBKDF2), sesión en el dispositivo y ventanas |
| `src/lists/` (outbox) | Cambios pendientes de subir, subida con control de versiones y conflictos |
| `src/library/` | Biblioteca: secciones (voces, batería, saxofón, trompeta), emparejamiento, transposición de metales, búsqueda |
| `src/sources/` | Orígenes de datos: demostración y OneDrive (inicio de sesión con Microsoft y Graph) |
| `src/sync/` | Sincronización incremental y descarga de PDF/imágenes bajo demanda |
| `src/db.js` | Almacenamiento local (IndexedDB) |
| `src/viewers/` | Visores de ChordPro, PDF (pdf.js, carga diferida) e imágenes; página a página o continuo |
| `src/features/` | Desplazamiento automático, pedal, gestos, pantalla completa, escuchar, copias, instalación |
| `src/views/` | Pantallas: Inicio, Canciones, Listas, Canción, Ajustes, editor de listas, editor de canciones y editor de batería |

### Caché y sin conexión

- **La app** (código, fuentes, pdf.js) queda guardada por el service worker. Las actualizaciones se avisan con «Hay una versión nueva».
- **Textos** (ChordPro, `.txt`, listas): se descargan al actualizar, y solo los que cambiaron (por eTag).
- **PDF e imágenes:** se descargan los de las próximas listas, en todas las secciones, y los demás al abrirlos. En Ajustes se puede activar «descargar todo».

## Despliegue

Cada push a `main` ejecuta `.github/workflows/deploy.yml`: pruebas, compilación y publicación en
GitHub Pages. En cada PR el mismo flujo solo prueba y compila (comprobación `build`), sin publicar. Antes hay que activarlo una sola vez en *Settings → Pages → Source: GitHub Actions*.

## Estado y hoja de ruta

**Situación (23/11/2026):** migración terminada. El repositorio está en `Musicos-Bethel/cancionero`, la
app se publica en https://musicos-bethel.github.io/cancionero/ y `main` está protegida. A partir de ahora se
trabaja solo con este repositorio. Siguiente: editor de batería; OneDrive (2b) cuando el líder de banda
envíe el Id. de aplicación de Microsoft Entra.

### Primeros pasos tras la migración (hechos)

1. **Proteger `main`** (hecho el 23/11/2026): regla `main` en *Settings → Rules → Rulesets*, activa, sobre la
   rama por defecto, sin lista de *bypass*: sin borrado ni *force push*, cambios solo por PR (0
   aprobaciones) y comprobación **`build`** obligatoria. La API de las sesiones de Claude no puede crear
   reglas: si hubiera que cambiarla, se hace desde la web.
2. **Instrucciones del proyecto de Claude** (hecho el 23/11/2026): actualizadas en claude.ai, proyecto
   «App.cancionero Iglesia».
3. **PR #9** (hecho el 23/11/2026): fusionado con la regla ya activa.
4. **Reinstalar la app:** el líder de banda y Nathanael, desde la dirección nueva (borrar antes el icono
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
| Migración | Repositorio a la organización de la iglesia | **Hecha (23/11/2026):** repositorio en `Musicos-Bethel`, publicada en la dirección nueva y `main` protegida |
| 2b | Lectura desde OneDrive | Falta el registro en Microsoft Entra (lo hace el líder de banda) |
| 2c | Escritura en OneDrive (listas y canciones creadas) | Después de 2b; falta decidir `appFolder` o `library` |
| — | Editor de batería (cuadrícula de ritmos y hoja de ruta) | En revisión (PR #11) |

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
5. **Proteger `main`:** hecho el 23/11/2026 (ver «Primeros pasos tras la migración»).
6. **Acceso de Claude:** aplicación de Claude en GitHub instalada en `Musicos-Bethel` (23/11/2026). Las
   sesiones nuevas se abren con `Musicos-Bethel/cancionero` como repositorio. Las instrucciones del
   proyecto ya están actualizadas.
7. **Repositorio (PR #9, fusionado el 23/11/2026):** dirección nueva y titularidad en README y
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
Un Owner puede devolver el repositorio a `dnathanospina` con *Transfer ownership*. El registro en Microsoft Entra
va ligado a la dirección nueva: si se volviera atrás, habría que cambiar la URI de redirección.
