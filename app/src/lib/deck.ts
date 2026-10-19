// Saved words (= review cards), daily new-card log and cloud sync with a local queue.
import type { Card, Entry } from '../types';
import { api, ApiError } from './api';
import { getCode } from './code';
import { kvGet, kvSet, lsGet, lsSet } from './kv';
import { mergeCards } from './merge';
import { buildQueue, gradeCard, isNewCard, localDay, newFsrs, type Grade } from './review';
import { createStore } from './store';

export const cardsStore = createStore<Record<string, Card>>({});
export const pendingStore = createStore<number>(0);
export const newPerDayStore = createStore<number>(readNewPerDay());

export type SyncState = { status: 'idle' | 'syncing' | 'offline' | 'error' | 'off'; last?: number; queued: number };
export const syncStore = createStore<SyncState>({ status: 'idle', queued: 0 });

type NewLog = { day: string; ids: string[] };
let newLog: NewLog = { day: localDay(), ids: [] };
let dirty = new Set<string>();
let loaded: Promise<void> | null = null;

function readNewPerDay(): number {
  const n = Number(lsGet('cz.newPerDay'));
  return Number.isFinite(n) && n > 0 ? Math.min(50, Math.round(n)) : 10;
}
export function setNewPerDay(n: number) {
  const v = Math.max(1, Math.min(50, Math.round(n)));
  lsSet('cz.newPerDay', String(v));
  newPerDayStore.set(v);
  refreshPending();
}

export function newDoneToday(): number {
  if (newLog.day !== localDay()) newLog = { day: localDay(), ids: [] };
  return newLog.ids.length;
}

export function currentQueue(now = new Date(), learnAheadMs = 0): Card[] {
  return buildQueue(Object.values(cardsStore.get()), now, {
    newLimit: newPerDayStore.get(),
    newDoneToday: newDoneToday(),
    learnAheadMs,
  });
}

export function refreshPending() {
  pendingStore.set(currentQueue().length);
}

export function loadDeck(): Promise<void> {
  loaded ??= (async () => {
    const [cards, d, log, last] = await Promise.all([
      kvGet<Record<string, Card>>('cards'),
      kvGet<string[]>('sync:dirty'),
      kvGet<NewLog>('review:newlog'),
      kvGet<number>('sync:last'),
    ]);
    if (cards && typeof cards === 'object') cardsStore.set(cards);
    dirty = new Set(Array.isArray(d) ? d : []);
    if (log && log.day === localDay()) newLog = log;
    syncStore.set({ status: 'idle', last, queued: dirty.size });
    refreshPending();
    setInterval(refreshPending, 60_000);
  })();
  return loaded;
}

function commit(next: Record<string, Card>, touched: string[]) {
  cardsStore.set(next);
  touched.forEach((id) => dirty.add(id));
  kvSet('cards', next);
  kvSet('sync:dirty', [...dirty]);
  syncStore.set((s) => ({ ...s, queued: dirty.size }));
  refreshPending();
}

export function frontFromEntry(e: Omit<Entry, 'freq'>): Card['front'] {
  return {
    ca: e.ca,
    zh: e.zh.slice(0, 2).join('；'),
    pinyin: e.pinyin.slice(0, 2).join('；'),
    en: e.en.slice(0, 2).join('; '),
    es: e.es.slice(0, 2).join(', '),
    ...(e.ex ? { ex: { ca: e.ex.ca, zh: e.ex.zh } } : {}),
  };
}

export const isSaved = (cards: Record<string, Card>, id: string) => !!cards[id] && !cards[id].deleted;

export function saveWord(id: string, front: Card['front']) {
  const cards = cardsStore.get();
  const now = Date.now();
  const prev = cards[id];
  // Re-saving a deleted word keeps its old FSRS progress.
  const card: Card = prev
    ? { ...prev, front, deleted: false, updated_at: now }
    : { id, front, fsrs: newFsrs(new Date(now)), updated_at: now };
  commit({ ...cards, [id]: card }, [id]);
  schedulePush(1500);
}

export function removeWord(id: string) {
  const cards = cardsStore.get();
  const prev = cards[id];
  if (!prev || prev.deleted) return;
  commit({ ...cards, [id]: { ...prev, deleted: true, updated_at: Date.now() } }, [id]);
  schedulePush(1500);
}

export function gradeAndSave(id: string, grade: Grade) {
  const cards = cardsStore.get();
  const card = cards[id];
  if (!card) return;
  if (isNewCard(card)) {
    newDoneToday();
    if (!newLog.ids.includes(id)) newLog = { ...newLog, ids: [...newLog.ids, id] };
    kvSet('review:newlog', newLog);
  }
  commit({ ...cards, [id]: gradeCard(card, grade) }, [id]);
}

// ---------- Sync ----------
let pushTimer: ReturnType<typeof setTimeout> | undefined;
let inflight: Promise<void> | null = null;

export function schedulePush(ms = 0) {
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => void syncNow(false), ms);
}

async function pull() {
  const since = (await kvGet<number>('sync:since')) ?? 0;
  const res = await api.syncGet(since);
  const local = cardsStore.get();
  const { merged, changed } = mergeCards(local, res.cards ?? []);
  if (changed.length) {
    // Remote won for these ids: nothing of ours left to push.
    changed.forEach((id) => dirty.delete(id));
    cardsStore.set(merged);
    await kvSet('cards', merged);
    await kvSet('sync:dirty', [...dirty]);
    refreshPending();
  }
  await kvSet('sync:since', res.now);
}

async function push() {
  if (!dirty.size) return;
  const cards = cardsStore.get();
  const batch = [...dirty].map((id) => cards[id]).filter(Boolean);
  const sent = new Map(batch.map((c) => [c.id, c.updated_at]));
  await api.syncPost(batch);
  // Only clear what did not change while the request was in flight.
  const now = cardsStore.get();
  for (const [id, at] of sent) if (now[id]?.updated_at === at) dirty.delete(id);
  await kvSet('sync:dirty', [...dirty]);
}

/** Pull (optional) + push. Never throws; offline just leaves the queue for later. */
export function syncNow(withPull = true): Promise<void> {
  if (inflight) return inflight;
  if (!getCode() || !api.configured()) {
    syncStore.set((s) => ({ ...s, status: 'off', queued: dirty.size }));
    return Promise.resolve();
  }
  inflight = (async () => {
    await loadDeck();
    syncStore.set((s) => ({ ...s, status: 'syncing' }));
    try {
      if (withPull) await pull();
      await push();
      const last = Date.now();
      await kvSet('sync:last', last);
      syncStore.set({ status: 'idle', last, queued: dirty.size });
    } catch (e) {
      const offline = e instanceof ApiError && (e.code === 'offline' || e.code === 'timeout');
      syncStore.set((s) => ({ ...s, status: offline ? 'offline' : 'error', queued: dirty.size }));
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

let lastVisibleSync = 0;
export function initSyncTriggers() {
  window.addEventListener('online', () => void syncNow());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      if (dirty.size) void syncNow(false);
    } else if (Date.now() - lastVisibleSync > 60_000) {
      lastVisibleSync = Date.now();
      refreshPending();
      void syncNow();
    }
  });
}
