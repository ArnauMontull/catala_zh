import { useEffect, useState } from 'preact/hooks';
import { Bi, Gender, POS_LABEL, Speak, Spinner } from '../components/common';
import { IconBack, IconGrammar, IconSparkle, IconStar } from '../components/icons';
import { errorText } from '../lib/api';
import { dictStore, loadConj } from '../lib/data';
import { cardsStore, frontFromEntry, isSaved, removeWord, saveWord } from '../lib/deck';
import { closeSheet, openSheet } from '../lib/nav';
import { useStore } from '../lib/store';
import { toast } from '../lib/toast';
import type { Entry, ExplainResponse } from '../types';
import { explainCached } from './Search';

type AnyEntry = Omit<Entry, 'freq'> & { freq?: number };

function SheetBar({ id, entry }: { id: string; entry: AnyEntry }) {
  const cards = useStore(cardsStore);
  const saved = isSaved(cards, id);
  return (
    <div class="sheetbar">
      <button type="button" class="iconbtn" aria-label="Back 返回" onClick={closeSheet}>
        <IconBack />
      </button>
      <button
        type="button"
        class={`iconbtn star ${saved ? 'on' : ''}`}
        aria-pressed={saved}
        aria-label={saved ? 'Remove from review 从生词本删除' : 'Save to review 加入生词本'}
        onClick={() => {
          if (saved) {
            removeWord(id);
            toast('Removed from review', '已从生词本删除');
          } else {
            saveWord(id, frontFromEntry(entry));
            toast('Saved for review ★', '已加入生词本');
          }
        }}
      >
        <IconStar filled={saved} size={26} />
      </button>
    </div>
  );
}

function AiExtra({ data }: { data: ExplainResponse }) {
  return (
    <div class="ai-extra">
      {data.senses.length > 0 && (
        <div class="block">
          <h3 class="label">
            Meanings <span class="zh">释义</span>
          </h3>
          <ol class="senses">
            {data.senses.map((s) => (
              <li>
                <span class="zh-big" lang="zh-CN">{s.zh}</span> <span class="py">{s.pinyin}</span>
                <div class="muted">
                  {s.en} · <span lang="es">{s.es}</span>
                </div>
                {s.note_zh && <div class="note-zh zh">{s.note_zh}</div>}
              </li>
            ))}
          </ol>
        </div>
      )}
      {data.examples.length > 0 && (
        <div class="block">
          <h3 class="label">
            Examples <span class="zh">例句</span>
          </h3>
          {data.examples.map((x) => (
            <div class="example">
              <div class="ex-line">
                <span lang="ca">{x.ca}</span>
                <Speak text={x.ca} lang="ca" size={20} />
              </div>
              <div class="ex-line zh" lang="zh-CN">
                {x.zh}
                <Speak text={x.zh} lang="zh" size={20} />
              </div>
            </div>
          ))}
        </div>
      )}
      {data.note_en && (
        <div class="block note">
          <h3 class="label">Note</h3>
          <p>{data.note_en}</p>
        </div>
      )}
      <p class="ai-credit muted">
        <IconSparkle size={14} /> AI · {data.cached ? 'cached 缓存' : 'new 新'}
      </p>
    </div>
  );
}

export function WordView({ entry, ai, query, minimal }: { entry: AnyEntry; ai?: ExplainResponse; query?: string; minimal?: boolean }) {
  const [more, setMore] = useState<{ loading?: boolean; data?: ExplainResponse; err?: { en: string; zh: string } }>({});
  const [hasConj, setHasConj] = useState(false);

  useEffect(() => {
    let alive = true;
    if (entry.pos === 'verb') loadConj().then((c) => alive && setHasConj(!!c?.[entry.id]));
    return () => {
      alive = false;
    };
  }, [entry.id, entry.pos]);

  const askMore = async () => {
    setMore({ loading: true });
    try {
      setMore({ data: await explainCached(entry.ca, 'ca') });
    } catch (e) {
      setMore({ err: errorText(e) });
    }
  };

  const forms = [entry.fem && `f. ${entry.fem}`, entry.plural && `pl. ${entry.plural}`].filter(Boolean).join(' · ');
  const extra = ai ?? more.data;

  return (
    <article class="word">
      <SheetBar id={entry.id} entry={entry} />
      <div class="sheet-scroll">
        {query && ai && norm2(query) !== norm2(entry.ca) && (
          <p class="muted from-query">
            «{query}» →
          </p>
        )}
        <header class="word-head">
          <div class="word-ca-line">
            <h1 class="word-ca" lang="ca">{entry.ca}</h1>
            <Speak text={entry.ca} lang="ca" size={26} />
          </div>
          <div class="word-meta">
            <Gender g={entry.gender} />
            {!minimal && <span class="pos">{POS_LABEL[entry.pos] ?? entry.pos}</span>}
            {entry.verb && <span class="pos">{entry.verb.conj}{entry.verb.pronominal ? ' · pron.' : ''}</span>}
            {forms && <span class="forms" lang="ca">{forms}</span>}
          </div>
        </header>

        <div class="block zh-block">
          {entry.zh.map((z, i) => (
            <div class={`zh-sense ${i === 0 ? 'first' : ''}`}>
              <span class="zh-big" lang="zh-CN">{z}</span>
              <span class="py">{entry.pinyin[i]}</span>
              {i === 0 && <Speak text={z} lang="zh" size={22} />}
            </div>
          ))}
        </div>

        <div class="block langs">
          <div class="lang-row">
            <span class="lang-tag">EN</span>
            <span>{entry.en.join('; ')}</span>
          </div>
          <div class="lang-row">
            <span class="lang-tag">ES</span>
            <span lang="es">{entry.es.join(', ')}</span>
          </div>
        </div>

        {entry.ex && (
          <div class="block example card-ex">
            <h3 class="label">
              Example <span class="zh">例句</span>
            </h3>
            <div class="ex-line">
              <span lang="ca">{entry.ex.ca}</span>
              <Speak text={entry.ex.ca} lang="ca" size={20} />
            </div>
            <div class="ex-line zh" lang="zh-CN">
              {entry.ex.zh}
              <Speak text={entry.ex.zh} lang="zh" size={20} />
            </div>
            {entry.ex.en && <div class="muted ex-en">{entry.ex.en}</div>}
          </div>
        )}

        <div class="actions">
          {hasConj && (
            <button type="button" class="btn" onClick={() => openSheet({ kind: 'conj', id: entry.id })}>
              <IconGrammar size={20} />
              <span>Conjugació · 动词变位</span>
            </button>
          )}
          {!ai && !more.data && (
            <button type="button" class="btn btn-soft" onClick={askMore} disabled={more.loading}>
              {more.loading ? <Spinner /> : <IconSparkle size={20} />}
              <span>更多 / More (AI)</span>
            </button>
          )}
        </div>
        {more.err && (
          <p class="note warn">
            {more.err.en}
            <br />
            <span class="zh">{more.err.zh}</span>
          </p>
        )}
        {extra && <AiExtra data={extra} />}
      </div>
    </article>
  );
}

const norm2 = (s: string) => s.trim().toLowerCase();

export function EntrySheet({ id }: { id: string }) {
  const dict = useStore(dictStore);
  const cards = useStore(cardsStore);
  const entry = dict?.byId.get(id);
  if (entry) return <WordView entry={entry} />;
  // Saved AI word or not loaded yet: rebuild a minimal entry from the card.
  const c = cards[id];
  if (c) {
    const f = c.front;
    const fake: AnyEntry = {
      id, ca: f.ca, pos: 'phrase', zh: f.zh.split('；'), pinyin: f.pinyin.split('；'),
      en: f.en.split('; '), es: f.es.split(', '), ex: f.ex,
    };
    return <WordView entry={fake} minimal />;
  }
  return (
    <article class="word">
      <div class="sheetbar">
        <button type="button" class="iconbtn" aria-label="Back 返回" onClick={closeSheet}>
          <IconBack />
        </button>
      </div>
      <p class="note">
        <Bi en="Loading…" zh="加载中…" />
      </p>
    </article>
  );
}
