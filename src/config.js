/**
 * Identidad visual. El logo de la iglesia está en public/brand/logo.svg (de una
 * sola tinta: se pinta con el color del texto, negro en modo claro y blanco en
 * modo oscuro). `logoRatio` = ancho / alto de su viewBox.
 * Con `logo: null` se muestra el nombre en texto.
 */
export const BRAND = {
  name: 'Bethel',
  logo: import.meta.env.BASE_URL + 'brand/logo.svg',
  logoRatio: 338 / 243,
};

/**
 * Dónde escribe el modo líder (listas y PIN). Las rutas que usa la app son
 * «lógicas» (Listas/…, ajustes-lider.json); cada origen de datos las traduce a
 * su ubicación real, así que cambiar de destino es cambiar esta configuración.
 *
 *  location: 'appFolder' → OneDrive: Aplicaciones/Cancionero Bethel/
 *                          (permiso mínimo Files.ReadWrite.AppFolder)
 *            'library'   → dentro de la carpeta del cancionero
 *                          (necesita Files.ReadWrite)
 */
export const WRITE_TARGET = {
  location: 'appFolder',
  listsFolder: 'Listas',
  leaderFile: 'ajustes-lider.json',
};

/**
 * Estructura de carpetas de la biblioteca (rutas relativas a la carpeta raíz).
 * Se puede cambiar en Ajustes para adaptarse a la biblioteca de SongBook sin
 * reorganizar nada. Si `voces` está vacío, la carpeta raíz entera es «Voces» y
 * sus subcarpetas son categorías (como las organiza SongBook). En `metales`
 * cada instrumento tiene su subcarpeta (Saxofon, Trompeta); lo que esté fuera
 * de ellas se muestra a los dos.
 */
export const DEFAULT_LAYOUT = {
  root: 'Cancionero',
  voces: 'Voces',
  bateria: 'Bateria',
  metales: 'Metales', // dentro: una carpeta por instrumento (Saxofon, Trompeta)
  enlaces: 'Enlaces',
};
