import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { norm } from '../src/lib/norm';
import { formatCode, isValidCode } from '../src/lib/code';
import { makeDict, buildLookups, search } from '../src/lib/search';
import { mergeCards } from '../src/lib/merge';
import { gradeCard, newFsrs, parseFsrs } from '../src/lib/review';
import type { Card } from '../src/types';

const load = (f: string) => JSON.parse(readFileSync(new URL(`../public/data/${f}`, import.meta.url), 'utf8'));

describe('norm (CONTRATOS §1)', () => {
  it('quita acentos, punto volat y mayúsculas', () => {
    expect(norm('Col·legi')).toBe('collegi');
    expect(norm('què')).toBe('que');
    expect(norm('  Bon   dia ')).toBe('bon dia');
  });
});

describe('código de acceso', () => {
  it('formatea y valida', () => {
    expect(formatCode('ahfj w7aq-x3pm')).toBe('AHFJ-W7AQ-X3PM');
    expect(isValidCode('AHFJ-W7AQ-X3PM')).toBe(true);
    expect(isValidCode('AHFJ-W7AQ')).toBe(false);
  });
});

describe('búsqueda con los datos reales', async () => {
  const dict = makeDict(load('entries.json'), load('index.json'));
  await buildLookups(dict, false);

  it('forma conjugada → lema', () => {
    const hit = search(dict, 'tinc', 'ca')[0];
    expect(hit.entry.id).toBe('tenir');
  });
  it('femenino → masculino', () => {
    expect(search(dict, 'nena', 'ca')[0].entry.id).toBe('nen');
  });
  it('chino → catalán', () => {
    expect(search(dict, '吃', 'zh').map((h) => h.entry.id)).toContain('menjar');
  });
});

describe('repaso y sincronización', () => {
  const card = (updated_at: number, fsrs = newFsrs()): Card => ({
    id: 'casa',
    front: { ca: 'casa', zh: '家', pinyin: 'jiā', en: 'house', es: 'casa' },
    fsrs,
    updated_at,
  });

  it('gana la última escritura', () => {
    const { merged } = mergeCards({ casa: card(10) }, [card(5)]);
    expect(merged.casa.updated_at).toBe(10);
    const { merged: m2, changed } = mergeCards({ casa: card(10) }, [card(20)]);
    expect(m2.casa.updated_at).toBe(20);
    expect(changed).toContain('casa');
  });

  it('el estado FSRS sobrevive a JSON (ida y vuelta)', () => {
    const graded = gradeCard(card(1), 3 as never);
    const back = JSON.parse(JSON.stringify(graded)) as Card;
    expect(parseFsrs(back.fsrs).reps).toBe(parseFsrs(graded.fsrs).reps);
    expect(parseFsrs(back.fsrs).reps).toBeGreaterThan(0);
  });
});
