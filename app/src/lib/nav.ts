import type { ExplainResponse } from '../types';
import { lsGet, lsSet } from './kv';
import type { Dir } from './search';
import { createStore } from './store';

export type Tab = 'search' | 'sentence' | 'review' | 'grammar';
export type Sheet =
  | { kind: 'entry'; id: string }
  | { kind: 'ai'; data: ExplainResponse; query: string }
  | { kind: 'conj'; id: string }
  | { kind: 'settings' };

export const tabStore = createStore<Tab>('search');
export const sheetStore = createStore<Sheet[]>([]);

const DIRS: Dir[] = ['ca', 'zh', 'es', 'en'];
const savedDir = lsGet('cz.dir') as Dir | null;
export const dirStore = createStore<Dir>(savedDir && DIRS.includes(savedDir) ? savedDir : 'ca');
dirStore.subscribe((d) => lsSet('cz.dir', d));
export const queryStore = createStore<string>('');

export function setTab(t: Tab) {
  // Leaving sheets open across tabs is confusing: close them.
  if (sheetStore.get().length) sheetStore.set([]);
  tabStore.set(t);
}

let historyOk = true;
export function openSheet(s: Sheet) {
  sheetStore.set((st) => [...st, s]);
  try {
    history.pushState({ sheet: sheetStore.get().length }, '');
  } catch {
    historyOk = false;
  }
}

export function closeSheet() {
  if (historyOk && history.state && typeof history.state.sheet === 'number') {
    history.back(); // popstate pops the stack
  } else {
    sheetStore.set((st) => st.slice(0, -1));
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', (e) => {
    const depth = (e.state && typeof e.state.sheet === 'number' ? e.state.sheet : 0) as number;
    sheetStore.set((st) => st.slice(0, Math.min(depth, st.length)));
  });
}
