// Guardado en el almacenamiento del navegador sin perder cambios en silencio: si no entra (cupo
// lleno, modo privado) o se está por llenar, se avisa. El navegador da unos 5 millones de
// caracteres por sitio; avisamos desde el 80 %.

export const STORAGE_LIMIT_CHARS = 5_000_000;
export const STORAGE_WARN_RATIO = 0.8;

// Caracteres usados por todas las claves (lo que cuenta para el cupo).
export function storageUsage(storage) {
  let n = 0;
  try {
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      n += k.length + (storage.getItem(k) || '').length;
    }
  } catch { /* sin acceso */ }
  return n;
}

// Guarda `value` como JSON. Devuelve { ok, chars, used, warn, error }.
export function trySave(storage, key, value) {
  let json;
  try { json = JSON.stringify(value); } catch (e) { return { ok: false, chars: 0, used: 0, warn: false, error: 'serializar' }; }
  try {
    storage.setItem(key, json);
  } catch (e) {
    return { ok: false, chars: json.length, used: storageUsage(storage), warn: true, error: e?.name === 'QuotaExceededError' || /quota/i.test(String(e?.message)) ? 'cupo' : 'acceso' };
  }
  // medir todo el almacenamiento cuesta: solo cuando este dato ya es grande
  if (json.length < STORAGE_LIMIT_CHARS * 0.4) return { ok: true, chars: json.length, used: json.length, warn: false, error: null };
  const used = storageUsage(storage);
  return { ok: true, chars: json.length, used, warn: used >= STORAGE_LIMIT_CHARS * STORAGE_WARN_RATIO, error: null };
}

export const mb = (chars) => Math.round((chars * 2) / 1e5) / 10; // UTF-16: 2 bytes por carácter
