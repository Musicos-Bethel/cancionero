import { ONEDRIVE, WRITE_TARGET } from '../config.js';
import * as db from '../db.js';
import { LoginRequiredError, OfflineError } from './errors.js';

/**
 * Inicio de sesión con Microsoft para OneDrive (OAuth 2.0 con PKCE, sin
 * bibliotecas externas). Se usa redirección a la página de Microsoft, no
 * ventana emergente: funciona igual en la app instalada en iPhone y Android.
 *
 * Microsoft da a las apps de página única una sesión de 24 horas (el «refresh
 * token» no se puede alargar). Pasado ese tiempo, para actualizar hay que
 * volver a iniciar sesión; la app sigue funcionando sin conexión con lo
 * descargado. Si la cuenta de Microsoft recuerda la sesión en el navegador,
 * volver a entrar es solo un toque.
 */

const TOKENS_KEY = 'onedrive-sesion';
const LOGIN_KEY = 'onedrive-login'; // datos del inicio de sesión en curso (localStorage)

/**
 * Permisos: leer y escribir archivos, renovar la sesión y ver la cuenta.
 * Con `songs` (borrar canciones) o escribiendo en la biblioteca hace falta
 * Files.ReadWrite; si no, basta con la carpeta de la app.
 */
export function scopes(target = WRITE_TARGET) {
  const all = target.location === 'library' || target.songs;
  return all ? ['Files.ReadWrite', 'offline_access', 'User.Read'] : ['Files.Read', 'Files.ReadWrite.AppFolder', 'offline_access', 'User.Read'];
}

/** Dirección de vuelta: la de la app (https://musicos-bethel.github.io/cancionero/). */
export const redirectUri = (loc = location) => loc.origin + (import.meta.env?.BASE_URL ?? '/');

const b64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export function randomString(n = 48, cryptoObj = globalThis.crypto) {
  return b64url(cryptoObj.getRandomValues(new Uint8Array(n)));
}

export async function pkceChallenge(verifier, cryptoObj = globalThis.crypto) {
  return b64url(await cryptoObj.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
}

/** Dirección de la página de Microsoft para iniciar sesión. */
export function authorizeUrl({ challenge, state, redirect, prompt = 'select_account', loginHint }) {
  const q = new URLSearchParams({
    client_id: ONEDRIVE.clientId,
    response_type: 'code',
    redirect_uri: redirect,
    response_mode: 'query',
    scope: scopes().join(' '),
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });
  if (prompt) q.set('prompt', prompt);
  if (loginHint) q.set('login_hint', loginHint);
  return `${ONEDRIVE.authority}/authorize?${q}`;
}

/**
 * Va a la página de Microsoft. Al volver, `completeLogin` termina el proceso.
 *  silent: intenta entrar sin enseñar nada (prompt=none). Si Microsoft recuerda
 *          la cuenta en este navegador, vuelve al instante; si no, la app pasa
 *          sola al inicio de sesión normal.
 */
export async function startLogin({ returnHash = location.hash, loginHint, silent = false } = {}) {
  const verifier = randomString(48);
  const state = randomString(16);
  localStorage.setItem(LOGIN_KEY, JSON.stringify({ verifier, state, returnHash, loginHint: loginHint ?? null, silent, at: Date.now() }));
  const challenge = await pkceChallenge(verifier);
  // Con la cuenta conocida no se enseña el selector de cuentas.
  const prompt = silent ? 'none' : loginHint ? null : 'select_account';
  location.assign(authorizeUrl({ challenge, state, redirect: redirectUri(), loginHint, prompt }));
}

/** Volver a entrar con la última cuenta: primero sin enseñar nada; si no se puede, como siempre. */
export async function reconnect({ returnHash = location.hash } = {}) {
  const hint = (await lastAccount())?.user;
  return startLogin({ returnHash, loginHint: hint, silent: !!hint });
}

/** Errores con los que Microsoft dice «hace falta que la persona intervenga» (con prompt=none). */
export const INTERACTION_ERRORS = new Set(['login_required', 'interaction_required', 'consent_required', 'account_selection_required']);

async function tokenRequest(params, fetchFn = fetch) {
  let res;
  try {
    res = await fetchFn(`${ONEDRIVE.authority}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: ONEDRIVE.clientId, scope: scopes().join(' '), ...params }).toString(),
    });
  } catch {
    throw new OfflineError();
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error_description?.split('\n')[0] || data.error || `Error ${res.status}`);
    err.code = data.error;
    throw err;
  }
  return data;
}

/** Datos que se guardan de la sesión (nunca la contraseña, que no pasa por la app). */
export function sessionFromTokens(data, now = Date.now(), previous = null) {
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? previous?.refreshToken ?? null,
    expiresAt: now + (Number(data.expires_in) || 3600) * 1000,
    // La sesión de una app de página única dura 24 h desde que se inició.
    startedAt: previous?.startedAt ?? now,
    account: previous?.account ?? null,
  };
}

/**
 * Si la página se abre al volver de Microsoft (?code=…&state=…), cambia el
 * código por la sesión y limpia la dirección. Devuelve:
 *   null                              no venía de Microsoft
 *   { ok: true, account }             sesión iniciada
 *   { ok: false, interactive: {…} }   el intento silencioso no bastó: hay que ir a Microsoft
 *   { ok: false, message }            error o cancelado
 */
export async function completeLogin() {
  const params = new URLSearchParams(location.search);
  if (!params.has('code') && !params.has('error')) return null;
  let saved = null;
  try {
    saved = JSON.parse(localStorage.getItem(LOGIN_KEY) || 'null');
  } catch {
    /* nada */
  }
  localStorage.removeItem(LOGIN_KEY);
  // Se quita ?code=… de la dirección para que no se reutilice al recargar.
  history.replaceState(null, '', redirectUri() + (saved?.returnHash || '#/ajustes'));

  if (params.has('error')) {
    // El intento sin enseñar nada no bastó: hay que pasar por la página de Microsoft.
    if (saved?.silent && INTERACTION_ERRORS.has(params.get('error'))) {
      return { ok: false, interactive: { returnHash: saved.returnHash || '#/ajustes', loginHint: saved.loginHint ?? undefined } };
    }
    const cancelled = params.get('error') === 'access_denied';
    return { ok: false, message: cancelled ? 'Se canceló el inicio de sesión.' : params.get('error_description') || params.get('error') };
  }
  if (!saved || saved.state !== params.get('state')) {
    return { ok: false, message: 'El inicio de sesión no se pudo completar. Vuelve a intentarlo.' };
  }
  try {
    const data = await tokenRequest({ grant_type: 'authorization_code', code: params.get('code'), redirect_uri: redirectUri(), code_verifier: saved.verifier });
    const session = sessionFromTokens(data);
    session.account = await fetchAccount(session.accessToken).catch(() => null);
    await db.kvSet(TOKENS_KEY, session);
    return { ok: true, account: session.account };
  } catch (e) {
    return { ok: false, message: e instanceof OfflineError ? 'Sin conexión: no se pudo terminar de iniciar sesión.' : `No se pudo iniciar sesión: ${e.message}` };
  }
}

async function fetchAccount(token) {
  const res = await fetch(`${ONEDRIVE.graph}/me?$select=displayName,userPrincipalName`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  const me = await res.json();
  return { name: me.displayName || '', user: me.userPrincipalName || '' };
}

export const getSession = () => db.kvGet(TOKENS_KEY, null);

/** ¿Hay una sesión que todavía se puede usar o renovar? */
export async function sessionInfo(now = Date.now()) {
  const s = await getSession();
  if (!s?.refreshToken && !(s?.expiresAt > now)) return null;
  return { account: s.account, startedAt: s.startedAt, endsAt: (s.startedAt ?? now) + 24 * 3600 * 1000 };
}

let refreshing = null;

/** Token para llamar a OneDrive, renovándolo si hace falta. */
export async function getAccessToken({ force = false } = {}) {
  const s = await getSession();
  if (!s) throw new LoginRequiredError();
  if (!force && s.accessToken && s.expiresAt - 60_000 > Date.now()) return s.accessToken;
  if (!s.refreshToken) throw new LoginRequiredError('La sesión de OneDrive ha caducado.');
  refreshing ??= (async () => {
    try {
      const data = await tokenRequest({ grant_type: 'refresh_token', refresh_token: s.refreshToken });
      const next = sessionFromTokens(data, Date.now(), s);
      await db.kvSet(TOKENS_KEY, next);
      return next.accessToken;
    } catch (e) {
      if (e instanceof OfflineError) throw e;
      // invalid_grant: pasaron las 24 horas o se cambió la contraseña.
      await db.kvSet(TOKENS_KEY, { ...s, accessToken: null, refreshToken: null, expiresAt: 0 });
      throw new LoginRequiredError('La sesión de OneDrive ha caducado (dura 24 horas).');
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

/** Cierra la sesión en este dispositivo (lo descargado se queda). */
export async function signOut() {
  await db.kvDelete(TOKENS_KEY);
}

/** Cuenta con la que se inició sesión la última vez (para proponerla al volver a entrar). */
export async function lastAccount() {
  return (await getSession())?.account ?? null;
}
