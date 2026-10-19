// Personal access code (X-Code): auth + sync_id. Stored in localStorage (sync read
// for the first render) with an IndexedDB copy as backup. Both wrapped in try/catch.
import { kvGet, kvSet, kvDel, lsGet, lsSet } from './kv';
import { createStore } from './store';

export const CODE_RE = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
const LS_KEY = 'cz.code';
const LS_SKIP = 'cz.codeSkipped';

/** Uppercases, keeps A-Z0-9 and inserts the dashes: "abcd efgh1234" → "ABCD-EFGH-1234". */
export function formatCode(input: string): string {
  const raw = input.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
  return raw.match(/.{1,4}/g)?.join('-') ?? '';
}

export const isValidCode = (c: string) => CODE_RE.test(c);

export const codeStore = createStore<string | null>(readInitial());
export const codeSkipped = createStore<boolean>(lsGet(LS_SKIP) === '1');

function readInitial(): string | null {
  // ?code=XXXX-XXXX-XXXX (or #code=) in the install link.
  try {
    const params = new URLSearchParams(location.search || location.hash.replace(/^#/, ''));
    const fromUrl = formatCode(params.get('code') ?? '');
    if (isValidCode(fromUrl)) {
      lsSet(LS_KEY, fromUrl);
      kvSet('code', fromUrl);
      history.replaceState(null, '', location.pathname);
      return fromUrl;
    }
  } catch {
    /* ignore */
  }
  const c = lsGet(LS_KEY);
  return c && isValidCode(c) ? c : null;
}

/** If localStorage was wiped but IndexedDB still has it, restore. */
export async function restoreCode(): Promise<void> {
  if (codeStore.get()) return;
  const c = await kvGet<string>('code');
  if (c && isValidCode(c)) {
    lsSet(LS_KEY, c);
    codeStore.set(c);
  }
}

export function saveCode(code: string) {
  const c = formatCode(code);
  if (!isValidCode(c)) return;
  lsSet(LS_KEY, c);
  kvSet('code', c);
  codeStore.set(c);
}

export function clearCode() {
  lsSet(LS_KEY, null);
  kvDel('code');
  codeStore.set(null);
}

export function skipCode() {
  lsSet(LS_SKIP, '1');
  codeSkipped.set(true);
}

export const getCode = () => codeStore.get();
