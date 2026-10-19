import type { Entry, Index } from '../types';
import { norm, normZh, hasCJK } from './norm';

/** Source language of a search. CA searches go to 中文; the others go to Catalan. */
export type Dir = 'ca' | 'zh' | 'es' | 'en';

export type Hit = {
  entry: Entry;
  /** The matched surface form when it is not the lemma (e.g. "tinc"). */
  form?: string;
  /** Tags of that form, e.g. ["ind.pres.1s"]. */
  tags?: string[];
  /** What matched for es/en/zh-pinyin searches, to show it in the row. */
  via?: string;
  exact: boolean;
};

type Sorted = { forms: string[]; zh: string[]; es: string[]; en: string[] };

export type Dict = {
  entries: Entry[];
  byId: Map<string, Entry>;
  index: Index | null;
  /** Sorted key arrays for fast prefix search. Built lazily (null until then). */
  sorted: Sorted | null;
  /** App-side extra forms (plural, feminine) → [[id, "pl"|"fem"]]. */
  extra: Map<string, [string, string][]>;
  /** norm(pinyin without spaces) per entry, built lazily. */
  pinyin: Map<string, string[]> | null;
};

export function makeDict(entries: Entry[], index: Index | null): Dict {
  const byId = new Map<string, Entry>();
  for (const e of entries) byId.set(e.id, e);
  return { entries, byId, index, sorted: null, extra: new Map(), pinyin: null };
}

const yieldNow = () =>
  new Promise<void>((r) => {
    const ric = (globalThis as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void })
      .requestIdleCallback;
    if (ric) ric(() => r(), { timeout: 200 });
    else setTimeout(r, 0);
  });

/** Builds the in-memory lookup structures in small idle chunks so the UI never blocks. */
export async function buildLookups(dict: Dict, chunked = true): Promise<void> {
  const step = chunked ? yieldNow : () => Promise.resolve();
  const extra = new Map<string, [string, string][]>();
  const pinyin = new Map<string, string[]>();
  for (const e of dict.entries) {
    if (e.plural) pushTo(extra, norm(e.plural), [e.id, 'pl']);
    if (e.fem) pushTo(extra, norm(e.fem), [e.id, 'fem']);
    pinyin.set(e.id, e.pinyin.map((p) => norm(p).replace(/ /g, '')));
  }
  dict.extra = extra;
  dict.pinyin = pinyin;
  if (!dict.index) return;
  await step();
  const s: Sorted = { forms: [], zh: [], es: [], en: [] };
  for (const k of ['forms', 'zh', 'es', 'en'] as const) {
    const keys = Object.keys(dict.index[k] ?? {});
    keys.sort();
    s[k] = keys;
    await step();
  }
  dict.sorted = s;
}

function pushTo<K, V>(m: Map<K, V[]>, k: K, v: V) {
  const l = m.get(k);
  if (l) l.push(v);
  else m.set(k, [v]);
}

function lowerBound(arr: string[], q: string): number {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (arr[mid] < q) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

const MAX_KEYS = 600;

/** Keys of `obj` that start with q, using the sorted array when it exists. */
export function prefixKeys(sorted: string[] | null | undefined, obj: Record<string, unknown>, q: string): string[] {
  if (!q) return [];
  if (sorted) {
    const out: string[] = [];
    for (let i = lowerBound(sorted, q); i < sorted.length && out.length < MAX_KEYS; i++) {
      if (!sorted[i].startsWith(q)) break;
      out.push(sorted[i]);
    }
    return out;
  }
  const out: string[] = [];
  for (const k in obj) {
    if (k.startsWith(q)) {
      out.push(k);
      if (out.length >= MAX_KEYS * 4) break;
    }
  }
  return out;
}

type Cand = { id: string; exact: boolean; lemma: boolean; form?: string; tags?: string[]; via?: string };

function better(a: Cand, b: Cand): boolean {
  if (a.exact !== b.exact) return a.exact;
  if (a.lemma !== b.lemma) return a.lemma;
  return false;
}

export function search(dict: Dict | null, raw: string, dir: Dir, limit = 40): Hit[] {
  if (!dict || !raw.trim()) return [];
  const cands = new Map<string, Cand>();
  const offer = (c: Cand) => {
    const prev = cands.get(c.id);
    if (!prev || better(c, prev)) cands.set(c.id, c);
  };
  const idx = dict.index;

  if (dir === 'ca') {
    const q = norm(raw);
    if (!q) return [];
    if (idx) {
      for (const key of prefixKeys(dict.sorted?.forms, idx.forms, q)) {
        const exact = key === q;
        const byEntry = new Map<string, string[]>();
        for (const [id, tag] of idx.forms[key]) pushTo(byEntry, id, tag);
        for (const [id, tags] of byEntry) {
          const lemma = tags.includes('lemma');
          offer({ id, exact, lemma, form: lemma ? undefined : key, tags: lemma ? undefined : tags });
        }
      }
    } else {
      for (const e of dict.entries) {
        const n = norm(e.ca);
        if (n.startsWith(q)) offer({ id: e.id, exact: n === q, lemma: true });
      }
    }
    // App-side plural / feminine forms (exact or prefix).
    for (const [key, list] of dict.extra) {
      if (!key.startsWith(q)) continue;
      for (const [id, tag] of list) offer({ id, exact: key === q, lemma: false, form: key, tags: [tag] });
    }
  } else if (dir === 'zh') {
    const q = normZh(raw);
    if (!q) return [];
    if (hasCJK(q)) {
      if (idx) {
        for (const key of prefixKeys(dict.sorted?.zh, idx.zh, q))
          for (const id of idx.zh[key]) offer({ id, exact: key === q, lemma: true, via: key });
      }
      // Also catch senses that contain the characters (e.g. 学校 inside 中小学校) — cheap linear scan.
      if (cands.size < limit) {
        for (const e of dict.entries) {
          const z = e.zh.find((s) => s.includes(q));
          if (z) offer({ id: e.id, exact: z === q, lemma: true, via: z });
        }
      }
    } else {
      // Pinyin typed with Latin letters: "nihao", "ni hao", "nǐ hǎo".
      const pq = norm(q).replace(/ /g, '');
      if (pq) {
        for (const e of dict.entries) {
          const ps = dict.pinyin?.get(e.id) ?? e.pinyin.map((p) => norm(p).replace(/ /g, ''));
          const i = ps.findIndex((p) => p.startsWith(pq));
          if (i >= 0) offer({ id: e.id, exact: ps[i] === pq, lemma: true, via: `${e.zh[i]} ${e.pinyin[i]}` });
        }
      }
    }
  } else {
    const q = norm(raw);
    if (!q) return [];
    const table = idx?.[dir];
    if (table) {
      const queries = dir === 'en' && !q.startsWith('to ') ? [q, `to ${q}`] : [q];
      for (const qq of queries)
        for (const key of prefixKeys(dict.sorted?.[dir], table, qq))
          for (const id of table[key]) offer({ id, exact: key === qq, lemma: true, via: key });
    } else {
      for (const e of dict.entries) {
        const m = e[dir].find((s) => norm(s).startsWith(q));
        if (m) offer({ id: e.id, exact: norm(m) === q, lemma: true, via: m });
      }
    }
  }

  const hits: Hit[] = [];
  for (const c of cands.values()) {
    const entry = dict.byId.get(c.id);
    if (entry) hits.push({ entry, form: c.form, tags: c.tags, via: c.via, exact: c.exact });
  }
  hits.sort(
    (a, b) =>
      Number(b.exact) - Number(a.exact) ||
      (b.exact ? Number(!b.form) - Number(!a.form) : 0) ||
      a.entry.freq - b.entry.freq,
  );
  return hits.slice(0, limit);
}

/** Exact lookup used by the sentence breakdown chips. */
export function lookupExact(dict: Dict | null, word: string, lang: Dir = 'ca'): Entry | undefined {
  if (!dict) return undefined;
  const hits = search(dict, word, lang, 10).filter((h) => h.exact);
  return hits[0]?.entry;
}

// ---- Tag labels: "ind.pres.1s" → "present 1s" ----
export const TENSE_LABEL: Record<string, string> = {
  'ind.pres': 'present',
  'ind.imperf': 'imperfet',
  'ind.pret': 'passat simple',
  'ind.fut': 'futur',
  'cond.pres': 'condicional',
  'ind.perf': 'perfet',
  'ind.plusq': 'plusquamperfet',
  'ind.pret_perif': 'passat perifràstic',
  'ind.fut_perf': 'futur perfet',
  'cond.perf': 'condicional perfet',
  'subj.pres': 'present de subjuntiu',
  'subj.imperf': 'imperfet de subjuntiu',
  'subj.perf': 'perfet de subjuntiu',
  'subj.plusq': 'plusquamperfet de subjuntiu',
  imp: 'imperatiu',
};
const SPECIAL: Record<string, string> = {
  'np.ger': 'gerundi',
  'np.part': 'participi',
  'np.inf': 'infinitiu',
  pl: 'plural',
  fem: 'femení',
  lemma: '',
};

export function tagLabel(tags: string[]): string {
  const groups = new Map<string, string[]>();
  const order: string[] = [];
  for (const t of tags) {
    if (t in SPECIAL) {
      if (!groups.has(t)) (groups.set(t, []), order.push(t));
      continue;
    }
    const m = /^(.*)\.([123][sp])$/.exec(t);
    const tense = m ? m[1] : t;
    if (!groups.has(tense)) (groups.set(tense, []), order.push(tense));
    if (m) groups.get(tense)!.push(m[2]);
  }
  return order
    .map((k) => {
      const label = SPECIAL[k] ?? TENSE_LABEL[k] ?? k;
      const persons = groups.get(k)!;
      return persons.length ? `${label} ${persons.join('·')}` : label;
    })
    .filter(Boolean)
    .join(' / ');
}

/** Display form of an entry id ("banc#2" → "banc"). */
export const displayId = (id: string) => id.replace(/#\d+$/, '');
