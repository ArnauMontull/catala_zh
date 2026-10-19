// IndexedDB key-value wrapper (idb-keyval) that never throws.
// Falls back to memory when IndexedDB is unavailable (private mode, blocked storage).
import { get, getMany, set, setMany, del } from 'idb-keyval';

const mem = new Map<string, unknown>();
let broken = typeof indexedDB === 'undefined';

export async function kvGet<T>(key: string): Promise<T | undefined> {
  if (broken) return mem.get(key) as T | undefined;
  try {
    return await get<T>(key);
  } catch {
    broken = true;
    return mem.get(key) as T | undefined;
  }
}

export async function kvGetMany<T = unknown>(keys: string[]): Promise<(T | undefined)[]> {
  if (broken) return keys.map((k) => mem.get(k) as T | undefined);
  try {
    return await getMany<T>(keys);
  } catch {
    broken = true;
    return keys.map((k) => mem.get(k) as T | undefined);
  }
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  mem.set(key, value);
  if (broken) return;
  try {
    await set(key, value);
  } catch {
    broken = true;
  }
}

export async function kvSetMany(pairs: [string, unknown][]): Promise<void> {
  pairs.forEach(([k, v]) => mem.set(k, v));
  if (broken) return;
  try {
    await setMany(pairs);
  } catch {
    broken = true;
  }
}

export async function kvDel(key: string): Promise<void> {
  mem.delete(key);
  if (broken) return;
  try {
    await del(key);
  } catch {
    broken = true;
  }
}

/** localStorage helpers with try/catch (Safari private mode, quota...). */
export function lsGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
export function lsSet(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}
