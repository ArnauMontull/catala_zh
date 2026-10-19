// Pure FSRS helpers (ts-fsrs). Card.fsrs is stored as JSON with ISO dates (CONTRATOS §3).
import { createEmptyCard, fsrs, Rating, State, type Card as FsrsCard, type Grade } from 'ts-fsrs';
import type { Card } from '../types';

export { Rating, State };
export type { Grade };

export type FsrsJSON = {
  due: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: number;
  last_review?: string;
};

export const scheduler = fsrs({ enable_fuzz: true, request_retention: 0.9 });

export function serialize(c: FsrsCard): FsrsJSON {
  const out: FsrsJSON = {
    due: new Date(c.due).toISOString(),
    stability: c.stability,
    difficulty: c.difficulty,
    elapsed_days: c.elapsed_days,
    scheduled_days: c.scheduled_days,
    learning_steps: c.learning_steps,
    reps: c.reps,
    lapses: c.lapses,
    state: c.state,
  };
  if (c.last_review) out.last_review = new Date(c.last_review).toISOString();
  return out;
}

export function newFsrs(now: Date = new Date()): FsrsJSON {
  return serialize(createEmptyCard(now));
}

/** Parses the opaque fsrs blob; anything broken becomes a fresh card. */
export function parseFsrs(j: unknown, now: Date = new Date()): FsrsCard {
  const o = j as Partial<FsrsJSON> | null;
  if (!o || typeof o !== 'object' || !o.due || Number.isNaN(Date.parse(o.due))) return createEmptyCard(now);
  return {
    due: new Date(o.due),
    stability: Number(o.stability) || 0,
    difficulty: Number(o.difficulty) || 0,
    elapsed_days: Number(o.elapsed_days) || 0,
    scheduled_days: Number(o.scheduled_days) || 0,
    learning_steps: Number(o.learning_steps) || 0,
    reps: Number(o.reps) || 0,
    lapses: Number(o.lapses) || 0,
    state: (Number(o.state) || 0) as State,
    last_review: o.last_review ? new Date(o.last_review) : undefined,
  };
}

export const isNewCard = (c: Card) => parseFsrs(c.fsrs).state === State.New;

export type QueueOpts = {
  newLimit: number;
  /** Number of new cards already introduced today. */
  newDoneToday: number;
  /** When nothing else is due, learning cards due within this window are shown early. */
  learnAheadMs?: number;
};

/** Due review cards (oldest due first) followed by new cards, up to the daily new limit. */
export function buildQueue(cards: Card[], now: Date, opts: QueueOpts): Card[] {
  const t = now.getTime();
  const due: [number, Card][] = [];
  const fresh: Card[] = [];
  const ahead: [number, Card][] = [];
  const learnAhead = opts.learnAheadMs ?? 20 * 60 * 1000;
  for (const c of cards) {
    if (c.deleted) continue;
    const f = parseFsrs(c.fsrs, now);
    if (f.state === State.New) {
      fresh.push(c);
      continue;
    }
    const d = f.due.getTime();
    if (d <= t) due.push([d, c]);
    else if ((f.state === State.Learning || f.state === State.Relearning) && d <= t + learnAhead) ahead.push([d, c]);
  }
  due.sort((a, b) => a[0] - b[0]);
  fresh.sort((a, b) => a.updated_at - b.updated_at || a.id.localeCompare(b.id));
  const room = Math.max(0, opts.newLimit - opts.newDoneToday);
  const q = [...due.map((x) => x[1]), ...fresh.slice(0, room)];
  if (q.length === 0 && ahead.length) {
    ahead.sort((a, b) => a[0] - b[0]);
    return ahead.map((x) => x[1]);
  }
  return q;
}

/** Applies a rating; returns the updated card (updated_at = now). */
export function gradeCard(card: Card, grade: Grade, now: Date = new Date()): Card {
  const f = parseFsrs(card.fsrs, now);
  const { card: next } = scheduler.next(f, now, grade);
  return { ...card, fsrs: serialize(next), updated_at: now.getTime() };
}

/** Short interval text for each button: "1m", "10m", "1d", "3d", "2mo". */
export function previewIntervals(card: Card, now: Date = new Date()): Record<Grade, string> {
  const f = parseFsrs(card.fsrs, now);
  const prev = scheduler.repeat(f, now);
  const out = {} as Record<Grade, string>;
  for (const g of [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy] as Grade[]) {
    out[g] = formatInterval(prev[g].card.due.getTime() - now.getTime());
  }
  return out;
}

export function formatInterval(ms: number): string {
  const m = Math.max(1, Math.round(ms / 60000));
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  if (d < 31) return `${d}d`;
  const mo = Math.round(d / 30);
  if (mo < 12) return `${mo}mo`;
  return `${(d / 365).toFixed(1)}y`;
}

export const localDay = (d: Date = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
