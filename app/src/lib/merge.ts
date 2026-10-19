import type { Card } from '../types';

/**
 * Last-write-wins merge by updated_at (deleted cards are kept as tombstones).
 * Ties keep the local version. Returns the merged map and the ids that changed locally.
 */
export function mergeCards(
  local: Record<string, Card>,
  incoming: Card[],
): { merged: Record<string, Card>; changed: string[] } {
  const merged: Record<string, Card> = { ...local };
  const changed: string[] = [];
  for (const c of incoming) {
    if (!c || typeof c.id !== 'string' || typeof c.updated_at !== 'number') continue;
    const mine = merged[c.id];
    if (!mine || c.updated_at > mine.updated_at) {
      merged[c.id] = c;
      changed.push(c.id);
    }
  }
  return { merged, changed };
}
