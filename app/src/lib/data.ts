// Dictionary data: IndexedDB first (instant, offline), then a background check of
// manifest.version; files are re-downloaded only when the version changes.
import type { ConjFile, Entry, Febles, Index, Manifest } from '../types';
import { kvGet, kvGetMany, kvSet, kvSetMany } from './kv';
import { createStore } from './store';
import { buildLookups, makeDict, type Dict } from './search';

type Meta = { version: string; base: string; counts: Manifest['counts']; savedAt: number };

export type DataStatus = {
  phase: 'boot' | 'cached' | 'downloading' | 'ready' | 'empty-offline' | 'error';
  version?: string;
  base?: string;
  entries?: number;
  /** 0..1 while downloading. */
  progress?: number;
};

export const dataStatus = createStore<DataStatus>({ phase: 'boot' });
/** Bumps every time the in-memory dictionary changes (new object each time). */
export const dictStore = createStore<Dict | null>(null);

const BASE_URL = import.meta.env.BASE_URL || '/';
const SOURCES = ['data', 'data-sample'];

let conjCache: ConjFile | null = null;
let feblesCache: Febles | null = null;

function publish(entries: Entry[], index: Index | null) {
  const dict = makeDict(entries, index);
  dictStore.set(dict);
  // Deferred: sorted keys, plural/fem forms, pinyin. Search works meanwhile (linear scan).
  buildLookups(dict).then(() => {
    if (dictStore.get() === dict) dictStore.set({ ...dict });
  });
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const text = await res.text();
  return JSON.parse(text) as T; // throws on SPA-fallback HTML
}

/** /data/manifest.json, else /data-sample/manifest.json. */
export async function fetchManifest(): Promise<{ manifest: Manifest; base: string }> {
  let lastErr: unknown;
  for (const base of SOURCES) {
    try {
      const manifest = await fetchJson<Manifest>(`${BASE_URL}${base}/manifest.json`);
      if (manifest && typeof manifest.version === 'string' && Array.isArray(manifest.files))
        return { manifest, base };
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error('no manifest');
}

async function download(manifest: Manifest, base: string, hadData: boolean) {
  const v = encodeURIComponent(manifest.version);
  const url = (name: string) => `${BASE_URL}${base}/${name}?v=${v}`;
  const has = (n: string) => manifest.files.some((f) => f.name === n);
  const total = manifest.files.reduce((s, f) => s + (f.bytes || 1), 0) || 1;
  let done = 0;
  const tick = (name: string) => {
    done += manifest.files.find((f) => f.name === name)?.bytes || 1;
    dataStatus.set((s) => ({ ...s, phase: 'downloading', progress: Math.min(1, done / total) }));
  };
  dataStatus.set((s) => ({ ...s, phase: 'downloading', progress: 0 }));

  const entries = await fetchJson<Entry[]>(url('entries.json'));
  tick('entries.json');
  // Without cached data, let search start right away on the new entries.
  if (!hadData) publish(entries, null);
  const index = has('index.json') ? await fetchJson<Index>(url('index.json')) : null;
  tick('index.json');
  const conj = has('conj.json') ? await fetchJson<ConjFile>(url('conj.json')).catch(() => null) : null;
  tick('conj.json');
  const febles = has('febles.json') ? await fetchJson<Febles>(url('febles.json')).catch(() => null) : null;
  tick('febles.json');

  publish(entries, index);
  conjCache = conj;
  feblesCache = febles;
  const meta: Meta = { version: manifest.version, base, counts: manifest.counts, savedAt: Date.now() };
  await kvSetMany([
    ['data:entries', entries],
    ['data:index', index],
    ['data:conj', conj],
    ['data:febles', febles],
  ]);
  await kvSet('data:meta', meta); // last: a half-finished download is never marked as current
  dataStatus.set({ phase: 'ready', version: meta.version, base, entries: entries.length });
}

let started = false;

export async function startData(force = false): Promise<void> {
  if (started && !force) return;
  started = true;
  const meta = await kvGet<Meta>('data:meta');
  let hadData = !!dictStore.get();
  if (meta && !hadData) {
    const [entries, index] = await kvGetMany<unknown>(['data:entries', 'data:index']);
    if (Array.isArray(entries) && entries.length) {
      publish(entries as Entry[], (index as Index) ?? null);
      hadData = true;
      dataStatus.set({ phase: 'cached', version: meta.version, base: meta.base, entries: entries.length });
    }
  }
  try {
    const { manifest, base } = await fetchManifest();
    if (force || !hadData || !meta || meta.version !== manifest.version || meta.base !== base) {
      await download(manifest, base, hadData);
    } else {
      dataStatus.set((s) => ({ ...s, phase: 'ready' }));
    }
  } catch {
    dataStatus.set((s) => (hadData ? { ...s, phase: 'cached' } : { phase: 'empty-offline' }));
  }
}

/** Re-check on reconnect if we have nothing yet. */
export function retryDataIfEmpty() {
  if (!dictStore.get()) startData(true);
}

export async function loadConj(): Promise<ConjFile | null> {
  if (conjCache) return conjCache;
  conjCache = (await kvGet<ConjFile>('data:conj')) ?? null;
  return conjCache;
}

export async function loadFebles(): Promise<Febles | null> {
  if (feblesCache) return feblesCache;
  feblesCache = (await kvGet<Febles>('data:febles')) ?? null;
  return feblesCache;
}
