import type { Conj, ConjFile, Tense } from '../types';
import { Speak } from './common';

export const PRONOUNS = ['jo', 'tu', 'ell/ella/vostè', 'nosaltres', 'vosaltres', 'ells/elles/vostès'];

type Pair = [Tense, Tense | null];
type Mode = { id: string; title: string; zh: string; pairs: Pair[] };

/** Simple tense next to its compound (or periphrastic) partner. */
export const MODES: Mode[] = [
  {
    id: 'ind',
    title: 'Indicatiu',
    zh: '陈述式',
    pairs: [
      ['ind.pres', 'ind.perf'],
      ['ind.imperf', 'ind.plusq'],
      ['ind.pret', 'ind.pret_perif'],
      ['ind.fut', 'ind.fut_perf'],
    ],
  },
  { id: 'subj', title: 'Subjuntiu', zh: '虚拟式', pairs: [['subj.pres', 'subj.perf'], ['subj.imperf', 'subj.plusq']] },
  { id: 'cond', title: 'Condicional', zh: '条件式', pairs: [['cond.pres', 'cond.perf']] },
  { id: 'imp', title: 'Imperatiu', zh: '命令式', pairs: [['imp', null]] },
];

export const TENSE_NAME: Record<Tense, [string, string]> = {
  'ind.pres': ['Present', '现在时'],
  'ind.perf': ['Perfet', '现在完成时'],
  'ind.imperf': ['Imperfet', '过去未完成时'],
  'ind.plusq': ['Plusquamperfet', '过去完成时'],
  'ind.pret': ['Passat simple', '简单过去时'],
  'ind.pret_perif': ['Passat perifràstic', '迂回过去时（常用）'],
  'ind.fut': ['Futur', '将来时'],
  'ind.fut_perf': ['Futur perfet', '将来完成时'],
  'cond.pres': ['Condicional', '条件式'],
  'cond.perf': ['Condicional perfet', '条件完成式'],
  'subj.pres': ['Present', '现在时'],
  'subj.perf': ['Perfet', '现在完成时'],
  'subj.imperf': ['Imperfet', '过去时'],
  'subj.plusq': ['Plusquamperfet', '过去完成时'],
  imp: ['Imperatiu', '命令式'],
};

const SIMPLE = new Set<Tense>(['ind.pres', 'ind.imperf', 'ind.pret', 'ind.fut', 'cond.pres', 'subj.pres', 'subj.imperf', 'imp']);

/** Stem = infinitive without -ar/-er/-re/-ir (and without a pronominal -se). */
export function stemOf(inf: string): string {
  const base = inf.replace(/[-']?(se|s'|-se'n|-s'hi)$/i, '').replace(/-.*$/, '');
  return /(ar|er|re|ir)$/.test(base) ? base.slice(0, -2) : base;
}

/** Splits a form into [stem, ending] for highlighting. Compound forms: [aux, participle]. */
export function splitForm(form: string, stem: string, simple: boolean): { a: string; b: string; compound: boolean } {
  if (!simple && form.includes(' ')) {
    const i = form.lastIndexOf(' ');
    return { a: form.slice(0, i), b: form.slice(i), compound: true };
  }
  if (stem && form.startsWith(stem) && form.length > stem.length) return { a: stem, b: form.slice(stem.length), compound: false };
  return { a: '', b: form, compound: false };
}

function Forms({ forms, tense, stem }: { forms?: string[]; tense: Tense; stem: string }) {
  if (!forms) return <span class="form empty">–</span>;
  const simple = SIMPLE.has(tense);
  return (
    <>
      {forms.map((f) => {
        if (!f) return <span class="form empty">—</span>;
        const s = splitForm(f, stem, simple);
        return s.compound ? (
          <span class="form">
            <mark class="aux">{s.a}</mark>
            {s.b}
          </span>
        ) : (
          <span class="form">
            {s.a}
            <mark class="end">{s.b}</mark>
          </span>
        );
      })}
    </>
  );
}

function Table({ conj, pair, stem }: { conj: Partial<Conj>; pair: Pair; stem: string }) {
  const [t1, t2] = pair;
  const c1 = conj[t1];
  const c2 = t2 ? conj[t2] : undefined;
  if (!c1 && !c2) return null;
  return (
    <div class="ctable" role="table">
      <div class="crow chead" role="row">
        <span class="cpron" />
        <span class="ccell">
          {TENSE_NAME[t1][0]} <small class="zh">{TENSE_NAME[t1][1]}</small>
        </span>
        {t2 && (
          <span class="ccell">
            {TENSE_NAME[t2][0]} <small class="zh">{TENSE_NAME[t2][1]}</small>
          </span>
        )}
      </div>
      {PRONOUNS.map((p, i) => (
        <div class="crow" role="row">
          <span class="cpron">{p}</span>
          <span class="ccell">{c1 ? <Forms forms={[c1[i] ?? '']} tense={t1} stem={stem} /> : '–'}</span>
          {t2 && <span class="ccell">{c2 ? <Forms forms={[c2[i] ?? '']} tense={t2} stem={stem} /> : '–'}</span>}
        </div>
      ))}
    </div>
  );
}

export function ConjTables({ id, conjFile }: { id: string; conjFile: ConjFile }) {
  const conj = conjFile[id];
  if (!conj) return <p class="note">No conjugation table for this verb yet. 暂无变位表。</p>;
  const np = conj.np ?? [];
  const inf = np[0] ?? id.replace(/#\d+$/, '');
  const stem = stemOf(inf);
  return (
    <div class="conj">
      <div class="conj-title">
        <h2 lang="ca">{inf}</h2>
        <Speak text={inf} lang="ca" />
      </div>
      <p class="legend muted">
        <mark class="end">ending</mark> 词尾 · <mark class="aux">auxiliary</mark> 助动词
      </p>
      {MODES.map((m) => {
        const any = m.pairs.some(([a, b]) => conj[a] || (b && conj[b]));
        if (!any) return null;
        return (
          <section class="mode">
            <h3>
              {m.title} <span class="zh">{m.zh}</span>
            </h3>
            {m.pairs.map((p) => (
              <Table conj={conj} pair={p} stem={stem} />
            ))}
          </section>
        );
      })}
      {np.length > 0 && (
        <section class="mode">
          <h3>
            Formes no personals <span class="zh">非人称形式</span>
          </h3>
          <div class="np">
            <div>
              <span class="np-label">Infinitiu 不定式</span>
              <span lang="ca">{np[0]}</span>
            </div>
            <div>
              <span class="np-label">Gerundi 副动词</span>
              <span lang="ca">{np[1]}</span>
            </div>
            <div>
              <span class="np-label">Participi 过去分词</span>
              <span lang="ca">{np.slice(2).filter(Boolean).join(', ')}</span>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
