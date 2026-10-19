import { useEffect, useMemo, useState } from 'preact/hooks';
import { Speak } from '../components/common';
import { ConjTables } from '../components/ConjTables';
import { IconBack } from '../components/icons';
import { dataStatus, dictStore, loadConj, loadFebles } from '../lib/data';
import { lsGet, lsSet } from '../lib/kv';
import { closeSheet } from '../lib/nav';
import { norm } from '../lib/norm';
import { useStore } from '../lib/store';
import type { ConjFile, Febles } from '../types';

/** Loads conj.json / febles.json from IndexedDB, retrying when the data finishes downloading. */
function useGrammarData() {
  const status = useStore(dataStatus);
  const [conj, setConj] = useState<ConjFile | null>(null);
  const [febles, setFebles] = useState<Febles | null>(null);
  useEffect(() => {
    let alive = true;
    loadConj().then((c) => alive && c && setConj(c));
    loadFebles().then((f) => alive && f && setFebles(f));
    return () => {
      alive = false;
    };
  }, [status.phase, status.version]);
  return { conj, febles };
}

// Tiny, safe markdown: paragraphs, "- " lists, **bold**, *italic*, `code`.
function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function inline(s: string) {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/\*(.+?)\*/g, '<i>$1</i>')
    .replace(/`(.+?)`/g, '<code>$1</code>');
}
export function miniMarkdown(md: string): string {
  return md
    .trim()
    .split(/\n\s*\n/)
    .map((block) => {
      const lines = block.split('\n');
      if (lines.every((l) => /^\s*[-*] /.test(l)))
        return `<ul>${lines.map((l) => `<li>${inline(l.replace(/^\s*[-*] /, ''))}</li>`).join('')}</ul>`;
      return `<p>${lines.map(inline).join('<br>')}</p>`;
    })
    .join('');
}

function FeblesGuide({ febles }: { febles: Febles }) {
  const [lang, setLang] = useState<'en' | 'zh'>((lsGet('cz.feblesLang') as 'en' | 'zh') || 'zh');
  const pick = (l: 'en' | 'zh') => (setLang(l), lsSet('cz.feblesLang', l));
  return (
    <section class="febles">
      <div class="febles-head">
        <h2>
          Weak pronouns <span class="zh">弱代词</span>
        </h2>
        <div class="minisel">
          <button type="button" class={lang === 'zh' ? 'on' : ''} onClick={() => pick('zh')}>
            中文
          </button>
          <button type="button" class={lang === 'en' ? 'on' : ''} onClick={() => pick('en')}>
            EN
          </button>
        </div>
      </div>
      {febles.sections.map((s) => (
        <details class="fsec" open={febles.sections.length <= 3}>
          <summary>
            <span>{s.title_en}</span> <span class="zh">{s.title_zh}</span>
          </summary>
          <div class={`md ${lang === 'zh' ? 'zh' : ''}`} dangerouslySetInnerHTML={{ __html: miniMarkdown(lang === 'zh' ? s.body_zh : s.body_en) }} />
          {s.table && (
            <div class="ftable-wrap">
              <table class="ftable">
                <thead>
                  <tr>
                    {s.table.head.map((h) => (
                      <th>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {s.table.rows.map((r) => (
                    <tr>
                      {r.map((c, i) => (i === 0 ? <th scope="row">{c}</th> : <td lang="ca">{c}</td>))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {s.examples.map((x) => (
            <div class="example">
              <div class="ex-line">
                <span lang="ca">{x.ca}</span>
                <Speak text={x.ca} lang="ca" size={20} />
              </div>
              <div class="ex-line zh" lang="zh-CN">
                {x.zh}
              </div>
              <div class="muted ex-en">{x.en}</div>
            </div>
          ))}
        </details>
      ))}
    </section>
  );
}

const COMMON = ['ser', 'estar', 'tenir', 'anar', 'fer', 'voler', 'poder', 'haver', 'dir', 'venir', 'saber', 'menjar', 'parlar', 'viure', 'beure'];

export function GrammarScreen({ active }: { active: boolean }) {
  const { conj, febles } = useGrammarData();
  const dict = useStore(dictStore);
  const [verb, setVerb] = useState<string>(() => lsGet('cz.verb') || 'ser');
  const [q, setQ] = useState('');

  const verbs = useMemo(() => {
    if (!conj) return [] as string[];
    const ids = Object.keys(conj);
    const freq = (id: string) => dict?.byId.get(id)?.freq ?? 1e9;
    return ids.sort((a, b) => freq(a) - freq(b) || a.localeCompare(b));
  }, [conj, dict]);

  const quick = useMemo(() => {
    const set = new Set(verbs);
    const c = COMMON.filter((v) => set.has(v));
    return c.length >= 5 ? c : verbs.slice(0, 12);
  }, [verbs]);

  const matches = useMemo(() => {
    const n = norm(q);
    if (!n) return [];
    return verbs.filter((v) => norm(v).startsWith(n)).slice(0, 12);
  }, [q, verbs]);

  const choose = (v: string) => {
    setVerb(v);
    lsSet('cz.verb', v);
    setQ('');
  };
  const current = conj && conj[verb] ? verb : verbs[0];

  return (
    <section class="screen grammar" hidden={!active}>
      <header class="topbar">
        <h1 class="title">
          Grammar <span class="zh">语法</span>
        </h1>
      </header>
      {!conj ? (
        <p class="note">Loading… 加载中…</p>
      ) : (
        <>
          <div class="verbpick">
            <input
              type="search"
              value={q}
              placeholder="Find a verb · 查动词"
              lang="ca"
              autocapitalize="off"
              autocorrect="off"
              spellcheck={false}
              onInput={(e) => setQ((e.currentTarget as HTMLInputElement).value)}
            />
            <div class="chips">
              {(q ? matches : quick).map((v) => (
                <button type="button" class={`chip ${v === current ? 'on' : ''}`} lang="ca" onClick={() => choose(v)}>
                  {v.replace(/#\d+$/, '')}
                </button>
              ))}
              {q && !matches.length && <span class="muted">No verb found · 没有找到</span>}
            </div>
          </div>
          {current && <ConjTables id={current} conjFile={conj} />}
        </>
      )}
      {febles && <FeblesGuide febles={febles} />}
    </section>
  );
}

export function ConjSheet({ id }: { id: string }) {
  const { conj } = useGrammarData();
  return (
    <article class="word">
      <div class="sheetbar">
        <button type="button" class="iconbtn" aria-label="Back 返回" onClick={closeSheet}>
          <IconBack />
        </button>
        <span class="sheet-title">
          Conjugació <span class="zh">动词变位</span>
        </span>
        <span class="iconbtn" />
      </div>
      <div class="sheet-scroll">{conj ? <ConjTables id={id} conjFile={conj} /> : <p class="note">Loading… 加载中…</p>}</div>
    </article>
  );
}
