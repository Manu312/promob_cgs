// Login (Supabase Auth): configuración desde las variables de entorno de Vite y reglas puras.
// - Sin URL o sin clave: no hay login (la app funciona como siempre, todo en el navegador).
// - VITE_AUTH_DISABLED=1 lo apaga solo en desarrollo (las pruebas automáticas); en la app
//   publicada (build de producción) se ignora.
// - La lista de emails que pueden entrar se controla en Supabase (registro cerrado + usuarios
//   invitados). VITE_ALLOWED_EMAILS es una segunda barrera opcional en la app.

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const normalizeEmail = (s) => String(s || '').trim().toLowerCase();
export const isEmail = (s) => EMAIL.test(normalizeEmail(s));

export function parseAllowed(list) {
  return [...new Set(String(list || '').split(/[\s,;]+/).map(normalizeEmail).filter(isEmail))];
}

export function authConfig(env = {}) {
  const url = String(env.VITE_SUPABASE_URL || '').trim();
  const key = String(env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY || '').trim();
  const validUrl = /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url) || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/.test(url);
  const disabled = !env.PROD && String(env.VITE_AUTH_DISABLED || '') === '1';
  return { enabled: !!(validUrl && key) && !disabled, url: url.replace(/\/$/, ''), key, allowed: parseAllowed(env.VITE_ALLOWED_EMAILS), disabledInDev: disabled };
}

// Con lista local vacía, decide Supabase; con lista, además tiene que estar en ella.
export function isAllowed(email, allowed = []) {
  const e = normalizeEmail(email);
  return isEmail(e) && (!allowed.length || allowed.includes(e));
}

// Código de 6 dígitos (o más, según la plantilla de Supabase) que llega por email.
export const isOtpCode = (s) => /^\d{6,10}$/.test(String(s || '').trim());

// Mensajes de error de Supabase en castellano (los más comunes).
export function authErrorText(err) {
  const m = String(err?.message || err || '').toLowerCase();
  if (/signups? not allowed|user not found|not allowed for otp/.test(m)) return 'Ese email no tiene acceso. Pedile al administrador que te invite.';
  if (/rate limit|too many|security purposes/.test(m)) return 'Demasiados intentos: esperá un minuto y probá de nuevo.';
  if (/expired|invalid/.test(m)) return 'El código venció o no es correcto. Pedí uno nuevo.';
  if (/fetch|network|failed to/.test(m)) return 'Sin conexión con el servidor de login.';
  return 'No se pudo iniciar sesión. Probá de nuevo.';
}
