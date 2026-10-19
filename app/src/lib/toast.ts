import { createStore } from './store';

export type Toast = { id: number; en: string; zh?: string; long?: boolean };
export const toastStore = createStore<Toast | null>(null);
let n = 0;
let timer: ReturnType<typeof setTimeout> | undefined;

export function toast(en: string, zh?: string, long = false) {
  const t = { id: ++n, en, zh, long };
  toastStore.set(t);
  clearTimeout(timer);
  timer = setTimeout(() => {
    if (toastStore.get()?.id === t.id) toastStore.set(null);
  }, long ? 9000 : 2600);
}
