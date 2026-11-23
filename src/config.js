/**
 * Identidad visual. El logo de la iglesia está en public/brand/logo.svg (de una
 * sola tinta: se pinta con el color del texto, negro en modo claro y blanco en
 * modo oscuro). `logoRatio` = ancho / alto de su viewBox.
 * Con `logo: null` se muestra el nombre en texto.
 */
export const BRAND = {
  name: 'Bethel',
  logo: (import.meta.env?.BASE_URL ?? '/') + 'brand/logo.svg',
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
/**
 * Conexión con OneDrive (registro de la app en Microsoft Entra, hecho por el
 * líder de banda el 23/11/2026). El Id. de aplicación no es secreto.
 * Solo cuentas personales de Microsoft (`consumers`); plataforma SPA con la
 * dirección de la app como URI de redirección.
 */
export const ONEDRIVE = {
  clientId: '837f9cf6-8578-477d-bf55-952a19779d8c',
  authority: 'https://login.microsoftonline.com/consumers/oauth2/v2.0',
  graph: 'https://graph.microsoft.com/v1.0',
};

export const WRITE_TARGET = {
  location: 'appFolder',
  listsFolder: 'Listas',
  leaderFile: 'ajustes-lider.json',
};

/**
 * Estructura de carpetas de la biblioteca (rutas relativas a la carpeta raíz).
 * Se puede cambiar en Ajustes. Si `voces` está vacío, la carpeta raíz entera es
 * «Voces» y sus subcarpetas son categorías (como las organiza SongBook). En
 * `metales` cada instrumento tiene su subcarpeta (Saxofon, Trompeta); lo que
 * esté fuera de ellas se muestra a los dos.
 *
 * Por defecto, la biblioteca real de la iglesia (23/11/2026): carpeta
 * «Cancionero» en la raíz de OneDrive (antes «SongBook»), con las categorías
 * como subcarpetas (Alabanzas, Himnos…) y la batería en «Partituras batería».
 */
export const DEFAULT_LAYOUT = {
  root: 'Cancionero',
  voces: '',
  bateria: 'Partituras batería',
  metales: 'Metales', // dentro: una carpeta por instrumento (Saxofon, Trompeta)
  enlaces: 'Enlaces',
};

/** Estructura por defecto de versiones anteriores: si un móvil la tiene guardada sin cambios, pasa a la nueva. */
export const OLD_DEFAULT_LAYOUTS = [{ root: 'Cancionero', voces: 'Voces', bateria: 'Bateria', metales: 'Metales', enlaces: 'Enlaces' }];

/**
 * Estructura de carpetas guardada, revisada campo a campo: un campo que siga
 * con el valor por defecto de una versión anterior pasa al nuevo; uno que
 * alguien cambió a mano se respeta.
 */
export function migrateLayout(saved) {
  if (!saved) return { ...DEFAULT_LAYOUT };
  const out = { ...DEFAULT_LAYOUT };
  for (const [k, v] of Object.entries(saved)) {
    const wasDefault = OLD_DEFAULT_LAYOUTS.some((old) => k in old && (v ?? '') === old[k]);
    if (!wasDefault) out[k] = v;
  }
  return out;
}
