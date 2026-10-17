// Sincronización de tarjetas en D1: gana la última escritura (updated_at mayor).

import type { Card, Env } from "./types";

export const MAX_CARDS_PER_POST = 500;
const MAX_ID_LEN = 200;

type Row = { id: string; front: string; fsrs: string; updated_at: number; deleted: number };

export async function getCards(env: Env, code: string, since: number): Promise<{ cards: Card[]; now: number }> {
  // `now` se toma ANTES de leer: si alguien escribe durante la consulta, la próxima
  // petición con since=now lo volverá a ver (mejor duplicado que perdido).
  const now = Date.now();
  const { results } = await env.DB.prepare(
    "SELECT id, front, fsrs, updated_at, deleted FROM cards WHERE code = ? AND updated_at > ? ORDER BY updated_at",
  )
    .bind(code, since)
    .all<Row>();
  const cards: Card[] = results.map((r) => ({
    id: r.id,
    front: JSON.parse(r.front),
    fsrs: JSON.parse(r.fsrs),
    updated_at: r.updated_at,
    ...(r.deleted ? { deleted: true } : {}),
  }));
  return { cards, now };
}

/** Valida el cuerpo de POST /sync. Devuelve null si no es válido. */
export function parseCards(body: unknown): Card[] | null {
  if (!body || typeof body !== "object" || !Array.isArray((body as any).cards)) return null;
  const cards = (body as any).cards as unknown[];
  if (cards.length > MAX_CARDS_PER_POST) return null;
  for (const c of cards) {
    if (!c || typeof c !== "object") return null;
    const card = c as Record<string, unknown>;
    if (typeof card.id !== "string" || card.id.length === 0 || card.id.length > MAX_ID_LEN) return null;
    if (!card.front || typeof card.front !== "object" || Array.isArray(card.front)) return null;
    if (typeof card.updated_at !== "number" || !Number.isFinite(card.updated_at) || card.updated_at < 0) return null;
    if (card.deleted !== undefined && typeof card.deleted !== "boolean") return null;
  }
  return cards as Card[];
}

export async function putCards(env: Env, code: string, cards: Card[]): Promise<{ ok: true; now: number }> {
  if (cards.length > 0) {
    const stmt = env.DB.prepare(
      `INSERT INTO cards (code, id, front, fsrs, updated_at, deleted) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (code, id) DO UPDATE SET
         front = excluded.front, fsrs = excluded.fsrs,
         updated_at = excluded.updated_at, deleted = excluded.deleted
       WHERE excluded.updated_at > cards.updated_at`,
    );
    await env.DB.batch(
      cards.map((c) =>
        stmt.bind(
          code,
          c.id,
          JSON.stringify(c.front),
          JSON.stringify(c.fsrs ?? null),
          Math.trunc(c.updated_at),
          c.deleted ? 1 : 0,
        ),
      ),
    );
  }
  return { ok: true, now: Date.now() };
}
