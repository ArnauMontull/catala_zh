import { useEffect, useState } from 'preact/hooks';
import { DirLabel, DirSelector, Speak, Spinner } from '../components/common';
import { IconClose, IconSparkle } from '../components/icons';
import { api, errorText } from '../lib/api';
import { dictStore } from '../lib/data';
import { kvGet, kvSet } from '../lib/kv';
import { openSheet } from '../lib/nav';
import { lookupExact, type Dir } from '../lib/search';
import { useStore } from '../lib/store';
import type { TranslateResponse } from '../types';

type Item = { text: string; from: Dir; to: 'ca' | 'zh'; res: TranslateResponse; at: number };
const MAX = 500;
const toOf = (d: Dir): 'ca' | 'zh' => (d === 'ca' ? 'zh' : 'ca');

function Chips({ item }: { item: Item }) {
  const dict = useStore(dictStore);
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div class="chips breakdown">
      {item.res.words.map((w, i) => {
        // Catalan side of the pair: the source when translating from CA, else the lemma the AI gave.
        const caWord = item.from === 'ca' ? w.lemma || w.src : w.lemma;
        const entry =
          (caWord && (lookupExact(dict, caWord, 'ca') || (item.from === 'ca' ? lookupExact(dict, w.src, 'ca') : undefined))) ||
          (item.from === 'zh' ? lookupExact(dict, w.src, 'zh') : undefined);
        return (
          <button
            type="button"
            class={`wchip ${entry ? 'in-dict' : ''} ${open === i ? 'open' : ''}`}
            onClick={() => (entry ? openSheet({ kind: 'entry', id: entry.id }) : setOpen(open === i ? null : i))}
          >
            <span class="w-src" lang={item.from === 'zh' ? 'zh-CN' : item.from}>{w.src}</span>
            <span class="w-zh" lang="zh-CN">{w.zh}</span>
            {(open === i || (!entry && w.note)) && (
              <span class="w-more">
                {w.lemma && w.lemma !== w.src && <b lang="ca">{w.lemma} · </b>}
                {w.en}
                {w.note && <em> — {w.note}</em>}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function Result({ item }: { item: Item }) {
  const zh = item.to === 'zh';
  return (
    <div class="tresult">
      <div class="tr-main">
        <p class={zh ? 'tr-text zh-big' : 'tr-text ca-big'} lang={zh ? 'zh-CN' : 'ca'}>
          {item.res.translation}
        </p>
        <Speak text={item.res.translation} lang={item.to} />
      </div>
      {item.res.pinyin && <p class="py tr-py">{item.res.pinyin}</p>}
      {item.res.words.length > 0 && (
        <>
          <h3 class="label">
            Word by word <span class="zh">逐词解释</span>
            <small class="muted"> · tap 点击</small>
          </h3>
          <Chips item={item} />
        </>
      )}
    </div>
  );
}

export function SentenceScreen({ active }: { active: boolean }) {
  const [dir, setDir] = useState<Dir>('ca');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<{ en: string; zh: string } | null>(null);
  const [current, setCurrent] = useState<Item | null>(null);
  const [history, setHistory] = useState<Item[]>([]);

  useEffect(() => {
    kvGet<Item[]>('tr:history').then((h) => Array.isArray(h) && setHistory(h));
  }, []);

  const go = async () => {
    const t = text.trim().slice(0, MAX);
    if (!t || busy) return;
    const to = toOf(dir);
    // Same sentence already translated: reuse (works offline too).
    const prev = history.find((h) => h.text === t && h.from === dir && h.to === to);
    if (prev) return setCurrent(prev);
    setBusy(true);
    setErr(null);
    try {
      const res = await api.translate({ text: t, from: dir, to });
      const item: Item = { text: t, from: dir, to, res, at: Date.now() };
      setCurrent(item);
      const next = [item, ...history.filter((h) => !(h.text === t && h.from === dir))].slice(0, 30);
      setHistory(next);
      kvSet('tr:history', next);
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section class="screen sentence" hidden={!active}>
      <header class="topbar">
        <h1 class="title">
          Sentence <span class="zh">句子</span>
        </h1>
      </header>
      <DirSelector value={dir} onChange={setDir} />
      <div class="tbox">
        <textarea
          value={text}
          maxLength={MAX}
          rows={4}
          lang={dir === 'zh' ? 'zh-CN' : dir}
          placeholder={dir === 'zh' ? '输入或粘贴一句话…' : 'Type or paste a sentence, a sign, a menu… 输入或粘贴句子、标牌、菜单…'}
          onInput={(e) => setText((e.currentTarget as HTMLTextAreaElement).value)}
        />
        <div class="tbox-foot">
          <span class="muted count">
            {text.length}/{MAX}
          </span>
          {text && (
            <button type="button" class="iconbtn small" aria-label="Clear 清除" onClick={() => (setText(''), setCurrent(null))}>
              <IconClose size={18} />
            </button>
          )}
        </div>
      </div>
      <button type="button" class="btn btn-accent btn-big" disabled={!text.trim() || busy} onClick={go}>
        {busy ? <Spinner /> : <IconSparkle size={20} />}
        <span>Translate · 翻译</span>
      </button>
      {err && (
        <p class="note warn">
          {err.en}
          <br />
          <span class="zh">{err.zh}</span>
        </p>
      )}
      {current && <Result item={current} />}
      {history.length > 0 && (
        <div class="history">
          <h3 class="label">
            Recent <span class="zh">最近</span>
          </h3>
          <ul>
            {history.slice(0, 12).map((h) => (
              <li>
                <button
                  type="button"
                  class="hist"
                  onClick={() => {
                    setDir(h.from);
                    setText(h.text);
                    setCurrent(h);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                >
                  <span class="hist-src">{h.text}</span>
                  <span class="hist-tr" lang={h.to === 'zh' ? 'zh-CN' : 'ca'}>
                    {h.res.translation}
                  </span>
                  <span class="hist-dir">
                    <DirLabel dir={h.from} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
