// Almacenamiento con IndexedDB (mucho más lugar que localStorage) con la misma forma
// getItem / setItem / removeItem, pero con promesas. Si IndexedDB no está, cae en localStorage.

const DB = 'mueblesapp', STORE = 'kv';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function idbStorage() {
  if (typeof indexedDB === 'undefined') return localStorage;
  const dbp = openDb();
  const run = (mode, fn) => dbp.then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req?.result ?? null);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  }));
  return {
    getItem: (k) => run('readonly', (s) => s.get(k)).then((v) => (v === undefined ? null : v)),
    setItem: (k, v) => run('readwrite', (s) => s.put(String(v), k)),
    removeItem: (k) => run('readwrite', (s) => s.delete(k)),
  };
}
