/** CONTRATOS.md §1 — must stay identical to the Python build. */
export function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[·.]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Chinese is not normalised, only trimmed. */
export const normZh = (s: string): string => s.trim();

export const hasCJK = (s: string): boolean => /[㐀-鿿豈-﫿]/.test(s);
