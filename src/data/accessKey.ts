/**
 * The dashboard's access key, typed once by the person using it. It is never in the bundle:
 * the server holds the real value and compares. Kept in this browser only.
 */
const STORE = 'personal-os:access-key';
let memory: string | null = null;
const listeners = new Set<() => void>();

export function getAccessKey(): string | null {
  if (memory) return memory;
  try {
    memory = localStorage.getItem(STORE);
  } catch {
    /* private mode: the key lives for this tab only */
  }
  return memory;
}

export function setAccessKey(key: string | null) {
  memory = key;
  try {
    if (key) localStorage.setItem(STORE, key);
    else localStorage.removeItem(STORE);
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

export function onAccessKeyChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}
