import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Bi, DirSelector, Gender, Spinner } from '../components/common';
import { IconClose, IconGear, IconSparkle } from '../components/icons';
import { api, errorText } from '../lib/api';
import { dataStatus, dictStore } from '../lib/data';
import { kvGet, kvSet } from '../lib/kv';
import { dirStore, openSheet, queryStore, tabStore } from '../lib/nav';
import { norm } from '../lib/norm';
import { displayId, search, tagLabel, type Dir, type Hit } from '../lib/search';
import { useStore } from '../lib/store';
import type { Entry, ExplainResponse } from '../types';

const PLACEHOLDER: Record<Dir, string> = {
  ca: 'Escriu en català…',
  zh: '输入中文或拼音…',
  es: 'Escribe en español…',
  en: 'Type in English…',
};

export function greeting(d = new Date()): [string, string] {
  const h = d.getHours();
  if (h < 6) return ['Bona nit', '晚安'];
  if (h < 14) return ['Bon dia', '早上好'];
  if (h < 21) return ['Bona tarda', '下午好'];
  return ['Bona nit', '晚上好'];
}

/** AI explain with a small local cache so repeated look-ups work offline and cost nothing. */
export async function explainCached(word: string, lang: Dir): Promise<ExplainResponse> {
  const key = `ai:${lang}:${lang === 'zh' ? word.trim() : norm(word)}`;
  const hit = await kvGet<ExplainResponse>(key);
  if (hit) return hit;
  const res = await api.explain({ word: word.trim(), lang });
  kvSet(key, res);
  return res;
}

function wordOfDay(entries: Entry[]): Entry | undefined {
  const pool = entries.filter((e) => e.freq <= 800 && e.ex);
  if (!pool.length) return undefined;
  const d = new Date();
  const seed = d.getFullYear() * 372 + d.getMonth() * 31 + d.getDate();
  return pool[(seed * 2654435761) % pool.length];
}

function Row({ hit, dir }: { hit: Hit; dir: Dir }) {
  const e = hit.entry;
  return (
    <li>
      <button type="button" class="row" onClick={() => openSheet({ kind: 'entry', id: e.id })}>
        <div class="row-main">
          <span class="row-ca" lang="ca">
            {hit.form ? (
              <>
                <span class="row-form">{hit.form}</span>
                <span class="row-arrow">→</span>
                {displayId(e.ca)}
              </>
            ) : (
              e.ca
            )}
          </span>
          <Gender g={e.gender} />
          {hit.tags && <span class="row-tag">{tagLabel(hit.tags)}</span>}
        </div>
        <div class="row-sub">
          <span class="row-zh" lang="zh-CN">{e.zh.slice(0, 2).join('；')}</span>
          <span class="row-py">{e.pinyin[0]}</span>
          {(dir === 'es' || dir === 'en') && <span class="row-via">{e[dir].slice(0, 2).join(', ')}</span>}
          {dir === 'ca' && <span class="row-via">{e.en[0]}</span>}
        </div>
      </button>
    </li>
  );
}

export function SearchScreen({ active }: { active: boolean }) {
  const dict = useStore(dictStore);
  const status = useStore(dataStatus);
  const dir = useStore(dirStore);
  const q = useStore(queryStore);
  const tab = useStore(tabStore);
  const input = useRef<HTMLInputElement>(null);
  const [ai, setAi] = useState<{ loading: boolean; err?: { en: string; zh: string } }>({ loading: false });

  const hits = useMemo(() => search(dict, q, dir), [dict, q, dir]);
  const wod = useMemo(() => (dict ? wordOfDay(dict.entries) : undefined), [dict]);

  useEffect(() => {
    if (active && tab === 'search') input.current?.focus({ preventScroll: true });
  }, [active, tab, dir]);
  useEffect(() => setAi({ loading: false }), [q, dir]);

  const askAI = async () => {
    setAi({ loading: true });
    try {
      const data = await explainCached(q, dir);
      setAi({ loading: false });
      openSheet({ kind: 'ai', data, query: q });
    } catch (e) {
      setAi({ loading: false, err: errorText(e) });
    }
  };

  const [hi, hiZh] = greeting();
  const loading = status.phase === 'boot' || status.phase === 'downloading';

  return (
    <section class="screen search" hidden={!active}>
      <header class="topbar">
        <div class="brand">
          <span class="brand-ca">Català</span>
          <span class="brand-zh">中文</span>
        </div>
        <button type="button" class="iconbtn" aria-label="Settings 设置" onClick={() => openSheet({ kind: 'settings' })}>
          <IconGear />
        </button>
      </header>

      <DirSelector value={dir} onChange={(d) => dirStore.set(d)} />

      <form
        class="searchbox"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          if (hits[0]) openSheet({ kind: 'entry', id: hits[0].entry.id });
          else if (q.trim()) askAI();
        }}
      >
        <input
          ref={input}
          type="search"
          value={q}
          onInput={(e) => queryStore.set((e.currentTarget as HTMLInputElement).value)}
          placeholder={PLACEHOLDER[dir]}
          lang={dir === 'zh' ? 'zh-CN' : dir}
          autoFocus
          autocomplete="off"
          autocapitalize="off"
          autocorrect="off"
          spellcheck={false}
          enterkeyhint="search"
          aria-label="Search 查词"
        />
        {q && (
          <button type="button" class="clear" aria-label="Clear 清除" onClick={() => (queryStore.set(''), input.current?.focus())}>
            <IconClose size={18} />
          </button>
        )}
      </form>

      {loading && (
        <div class="loadbar" role="status">
          <div class="loadbar-fill" style={{ width: `${Math.round((status.progress ?? 0.05) * 100)}%` }} />
          <span>
            {dict ? 'Updating dictionary · 正在更新词典' : 'Loading dictionary · 词典加载中'}
          </span>
        </div>
      )}
      {status.phase === 'empty-offline' && !dict && (
        <p class="note warn">
          <Bi en="Connect once to download the dictionary." zh="请联网一次以下载词典。" />
        </p>
      )}

      {q.trim() ? (
        hits.length ? (
          <ul class="results">
            {hits.map((h) => (
              <Row key={h.entry.id + (h.form ?? '')} hit={h} dir={dir} />
            ))}
          </ul>
        ) : (
          <div class="empty">
            <p class="empty-title">
              <Bi en={<>No results for «{q.trim()}»</>} zh="没有找到" />
            </p>
            {!dict && loading && <p class="muted">Dictionary still loading… 词典还在加载</p>}
            <button type="button" class="btn btn-accent btn-big" onClick={askAI} disabled={ai.loading}>
              {ai.loading ? <Spinner /> : <IconSparkle size={20} />}
              <span>Ask AI · 问AI</span>
            </button>
            {ai.err && (
              <p class="note warn">
                {ai.err.en}
                <br />
                <span class="zh">{ai.err.zh}</span>
              </p>
            )}
          </div>
        )
      ) : (
        <div class="welcome">
          <p class="hello">
            <span lang="ca">{hi}!</span> <span class="zh">{hiZh}</span>
          </p>
          {wod && (
            <button type="button" class="wod" onClick={() => openSheet({ kind: 'entry', id: wod.id })}>
              <span class="wod-label">Paraula del dia · 每日一词</span>
              <span class="wod-ca" lang="ca">{wod.ca}</span>
              <span class="wod-zh" lang="zh-CN">
                {wod.zh[0]} <small>{wod.pinyin[0]}</small>
              </span>
              {wod.ex && <span class="wod-ex" lang="ca">«{wod.ex.ca}»</span>}
            </button>
          )}
          <p class="tip muted">
            Tip: type a conjugated verb like <b lang="ca">tinc</b> or <b lang="ca">anem</b>. 提示：可以输入动词变位，比如 tinc。
          </p>
        </div>
      )}
    </section>
  );
}
