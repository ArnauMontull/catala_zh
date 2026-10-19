import { useEffect, useMemo, useState } from 'preact/hooks';
import { Speak } from '../components/common';
import { IconTrash } from '../components/icons';
import { dictStore } from '../lib/data';
import {
  cardsStore, currentQueue, gradeAndSave, newDoneToday, newPerDayStore, removeWord, schedulePush, setNewPerDay,
} from '../lib/deck';
import { openSheet } from '../lib/nav';
import { isNewCard, parseFsrs, previewIntervals, Rating, type Grade } from '../lib/review';
import { useStore } from '../lib/store';
import type { Card } from '../types';

const BUTTONS: { g: Grade; en: string; zh: string; cls: string }[] = [
  { g: Rating.Again, en: 'Again', zh: '重来', cls: 'again' },
  { g: Rating.Hard, en: 'Hard', zh: '困难', cls: 'hard' },
  { g: Rating.Good, en: 'Good', zh: '良好', cls: 'good' },
  { g: Rating.Easy, en: 'Easy', zh: '简单', cls: 'easy' },
];

function Flashcard({ card, onDone }: { card: Card; onDone: () => void }) {
  // One random direction per showing.
  const caFirst = useMemo(() => Math.random() < 0.5, [card.id, card.updated_at]);
  const [shown, setShown] = useState(false);
  const f = card.front;
  const fresh = isNewCard(card);
  const intervals = useMemo(() => previewIntervals(card), [card]);
  useEffect(() => setShown(false), [card.id, card.updated_at]);

  const ca = (
    <div class="fc-side">
      <div class="fc-word-line">
        <span class="fc-ca" lang="ca">{f.ca}</span>
        <Speak text={f.ca} lang="ca" size={24} />
      </div>
    </div>
  );
  const zh = (
    <div class="fc-side">
      <div class="fc-word-line">
        <span class="fc-zh" lang="zh-CN">{f.zh}</span>
        <Speak text={f.zh.split('；')[0]} lang="zh" size={24} />
      </div>
      {(shown || !caFirst) && <div class="py fc-py">{f.pinyin}</div>}
    </div>
  );

  return (
    <div class="flashcard">
      <div class="fc-top">
        {fresh && <span class="badge-new">new 新词</span>}
        <span class="fc-prompt muted">{caFirst ? 'In Chinese? 中文是什么？' : 'In Catalan? 加泰罗尼亚语怎么说？'}</span>
      </div>
      {caFirst ? ca : zh}
      {shown ? (
        <>
          <hr class="fc-rule" />
          {caFirst ? zh : ca}
          <div class="fc-langs">
            <span><b>EN</b> {f.en}</span>
            <span lang="es"><b>ES</b> {f.es}</span>
          </div>
          {f.ex && (
            <div class="example fc-ex">
              <div class="ex-line">
                <span lang="ca">{f.ex.ca}</span>
                <Speak text={f.ex.ca} lang="ca" size={20} />
              </div>
              <div class="ex-line zh" lang="zh-CN">{f.ex.zh}</div>
            </div>
          )}
          <div class="grades">
            {BUTTONS.map((b) => (
              <button
                type="button"
                class={`grade ${b.cls}`}
                onClick={() => {
                  gradeAndSave(card.id, b.g);
                  onDone();
                }}
              >
                <span class="g-zh">{b.zh}</span>
                <span class="g-en">{b.en}</span>
                <span class="g-int">{intervals[b.g]}</span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <button type="button" class="btn btn-accent btn-big reveal" onClick={() => setShown(true)}>
          Show answer · 显示答案
        </button>
      )}
    </div>
  );
}

function SavedList({ cards }: { cards: Card[] }) {
  const dict = useStore(dictStore);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  if (!cards.length) return null;
  return (
    <details class="saved" open={open} onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}>
      <summary>
        Saved words <span class="zh">生词本</span> <span class="count-pill">{cards.length}</span>
      </summary>
      <ul>
        {cards.map((c) => {
          const due = parseFsrs(c.fsrs).due;
          return (
            <li class="saved-row">
              <button
                type="button"
                class="saved-main"
                onClick={() => (dict?.byId.get(c.id) || c.id.startsWith('ai:')) && openSheet({ kind: 'entry', id: c.id })}
              >
                <span lang="ca" class="saved-ca">{c.front.ca}</span>
                <span lang="zh-CN" class="saved-zh">{c.front.zh}</span>
                <span class="saved-due muted">{isNewCard(c) ? 'new 新' : due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
              </button>
              {confirm === c.id ? (
                <span class="confirm">
                  <button type="button" class="btn btn-danger small" onClick={() => (removeWord(c.id), setConfirm(null))}>
                    Delete 删除
                  </button>
                  <button type="button" class="btn small" onClick={() => setConfirm(null)}>
                    ✕
                  </button>
                </span>
              ) : (
                <button type="button" class="iconbtn" aria-label="Delete 删除" onClick={() => setConfirm(c.id)}>
                  <IconTrash size={20} />
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </details>
  );
}

export function ReviewScreen({ active }: { active: boolean }) {
  const cards = useStore(cardsStore);
  const limit = useStore(newPerDayStore);
  const [tick, setTick] = useState(0);
  const [reviewed, setReviewed] = useState(0);

  // Recompute when cards change, the tab is opened or a minute passes.
  useEffect(() => {
    if (!active) return;
    setTick((t) => t + 1);
    const i = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(i);
  }, [active]);

  const queue = useMemo(() => currentQueue(new Date(), 20 * 60_000), [cards, limit, tick]);
  const saved = useMemo(
    () => Object.values(cards).filter((c) => !c.deleted).sort((a, b) => a.front.ca.localeCompare(b.front.ca, 'ca')),
    [cards],
  );
  const nNew = queue.filter(isNewCard).length;
  const nDue = queue.length - nNew;
  const card = queue[0];

  // Session finished → push to the cloud.
  useEffect(() => {
    if (reviewed > 0 && !card) schedulePush(0);
  }, [reviewed, card]);

  const nextDue = useMemo(() => {
    let min = Infinity;
    for (const c of saved) {
      const d = parseFsrs(c.fsrs).due.getTime();
      if (!isNewCard(c) && d < min) min = d;
    }
    return Number.isFinite(min) ? new Date(min) : null;
  }, [saved]);

  return (
    <section class="screen review" hidden={!active}>
      <header class="topbar">
        <h1 class="title">
          Review <span class="zh">复习</span>
        </h1>
        <div class="stats">
          <span class="stat due" title="Due 待复习">{nDue}</span>
          <span class="stat new" title="New 新词">{nNew}</span>
        </div>
      </header>

      {card ? (
        <Flashcard card={card} onDone={() => setReviewed((n) => n + 1)} />
      ) : (
        <div class="done">
          {saved.length ? (
            <>
              <p class="done-big">
                {reviewed ? 'Fet! ' : 'Tot fet · '}
                <span class="zh">{reviewed ? '完成了！' : '今天没有要复习的'}</span>
              </p>
              {reviewed > 0 && <p class="muted">{reviewed} cards today · 今天复习了 {reviewed} 张</p>}
              {nextDue && (
                <p class="muted">
                  Next: {nextDue.toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' })} · 下次复习
                </p>
              )}
            </>
          ) : (
            <p class="done-big small">
              Tap ☆ on a word to add it here.
              <br />
              <span class="zh">在单词页点 ☆，就会加入复习。</span>
            </p>
          )}
        </div>
      )}

      <div class="limit">
        <span>
          New per day <span class="zh">每日新词</span>
          <small class="muted"> · {newDoneToday()}/{limit} today</small>
        </span>
        <div class="stepper">
          <button type="button" aria-label="Fewer 减少" onClick={() => setNewPerDay(limit - 1)}>
            −
          </button>
          <span>{limit}</span>
          <button type="button" aria-label="More 增加" onClick={() => setNewPerDay(limit + 1)}>
            +
          </button>
        </div>
      </div>

      <SavedList cards={saved} />
    </section>
  );
}
