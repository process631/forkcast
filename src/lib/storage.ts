/* Small, failure-tolerant wrappers around localStorage / sessionStorage / IndexedDB. */

export function readJSON<T>(key: string, fallback: T, storage: 'local' | 'session' = 'local'): T {
  try {
    const store = storage === 'local' ? window.localStorage : window.sessionStorage;
    const raw = store.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJSON(key: string, value: unknown, storage: 'local' | 'session' = 'local'): void {
  try {
    const store = storage === 'local' ? window.localStorage : window.sessionStorage;
    store.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked (private mode) — the app keeps working in memory.
  }
}

/* ---------------------------- IndexedDB ---------------------------- */

const DB_NAME = 'forkcast';
const STORE = 'kv';
const memory = new Map<string, unknown>();
let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest): Promise<T | undefined> {
  return openDb().then(
    (db) =>
      new Promise<T | undefined>((resolve) => {
        if (!db) return resolve(undefined);
        try {
          const tx = db.transaction(STORE, mode);
          const req = fn(tx.objectStore(STORE));
          req.onsuccess = () => resolve(req.result as T);
          req.onerror = () => resolve(undefined);
        } catch {
          resolve(undefined);
        }
      }),
  );
}

export async function idbGet<T>(key: string): Promise<T | undefined> {
  const value = await run<T>('readonly', (s) => s.get(key));
  return value ?? (memory.get(key) as T | undefined);
}

export async function idbSet(key: string, value: unknown): Promise<void> {
  memory.set(key, value);
  await run('readwrite', (s) => s.put(value, key));
}

export async function idbDelete(key: string): Promise<void> {
  memory.delete(key);
  await run('readwrite', (s) => s.delete(key));
}

/** Delete every key that starts with `prefix` (e.g. all cached images). */
export async function idbClear(prefix?: string): Promise<void> {
  for (const k of [...memory.keys()]) if (!prefix || k.startsWith(prefix)) memory.delete(k);
  const db = await openDb();
  if (!db) return;
  if (!prefix) {
    await run('readwrite', (s) => s.clear());
    return;
  }
  const keys = (await run<IDBValidKey[]>('readonly', (s) => s.getAllKeys())) || [];
  await Promise.all(keys.filter((k) => String(k).startsWith(prefix)).map((k) => run('readwrite', (s) => s.delete(k))));
}
