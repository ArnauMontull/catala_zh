import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { Dir } from '../lib/search';
import { speak } from '../lib/tts';
import { IconChevron, IconSpeaker } from './icons';

export function Speak({ text, lang, label, size = 22 }: { text: string; lang: 'ca' | 'zh'; label?: string; size?: number }) {
  const [on, setOn] = useState(false);
  return (
    <button
      type="button"
      class={`speak ${on ? 'is-on' : ''}`}
      aria-label={label ?? (lang === 'ca' ? 'Listen in Catalan 朗读' : 'Listen in Chinese 朗读')}
      onClick={(e) => {
        e.stopPropagation();
        speak(text, lang);
        setOn(true);
        setTimeout(() => setOn(false), 900);
      }}
    >
      <IconSpeaker size={size} />
    </button>
  );
}

const DIR_LABEL: Record<Dir, [string, string]> = {
  ca: ['CA', '中文'],
  zh: ['中文', 'CA'],
  es: ['ES', 'CA'],
  en: ['EN', 'CA'],
};

export function DirLabel({ dir }: { dir: Dir }) {
  const [a, b] = DIR_LABEL[dir];
  return (
    <span class="dirlabel">
      <span>{a}</span>
      <span class="arrow">→</span>
      <span>{b}</span>
    </span>
  );
}

export function DirSelector({ value, onChange }: { value: Dir; onChange: (d: Dir) => void }) {
  const [menu, setMenu] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menu) return;
    const close = (e: Event) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [menu]);
  const other = value === 'es' || value === 'en';
  return (
    <div class="dirsel" ref={ref} role="tablist" aria-label="Direction 方向">
      {(['ca', 'zh'] as Dir[]).map((d) => (
        <button type="button" role="tab" aria-selected={value === d} class={`seg ${value === d ? 'on' : ''}`} onClick={() => onChange(d)}>
          <DirLabel dir={d} />
        </button>
      ))}
      <button
        type="button"
        class={`seg seg-more ${other ? 'on' : ''}`}
        aria-haspopup="menu"
        aria-expanded={menu}
        onClick={() => setMenu(!menu)}
      >
        {other ? <DirLabel dir={value} /> : <span class="dirlabel">ES · EN</span>}
        <IconChevron size={16} />
      </button>
      {menu && (
        <div class="menu" role="menu">
          {(['es', 'en'] as Dir[]).map((d) => (
            <button
              type="button"
              role="menuitem"
              class={value === d ? 'on' : ''}
              onClick={() => {
                onChange(d);
                setMenu(false);
              }}
            >
              <DirLabel dir={d} />
              <small>{d === 'es' ? 'Español → català' : 'English → Catalan'}</small>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Seal({ size = 64 }: { size?: number }) {
  return (
    <svg class="seal" width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect x="3" y="3" width="58" height="58" rx="14" fill="var(--accent)" />
      <rect x="8" y="8" width="48" height="48" rx="10" fill="none" stroke="var(--on-accent)" stroke-opacity=".45" stroke-width="1.5" />
      <text x="20.5" y="40" text-anchor="middle" font-family="ui-serif, Georgia, serif" font-size="22" font-style="italic" fill="var(--on-accent)">
        ca
      </text>
      <text x="43" y="41" text-anchor="middle" font-family="'PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif" font-size="22" font-weight="600" fill="var(--on-accent)">
        中
      </text>
    </svg>
  );
}

export const Spinner = () => <span class="spinner" aria-label="Loading 加载中" />;

export function Bi({ en, zh, class: c }: { en: ComponentChildren; zh: ComponentChildren; class?: string }) {
  return (
    <span class={`bi ${c ?? ''}`}>
      {en} <span class="zh">{zh}</span>
    </span>
  );
}

const GENDER: Record<string, [string, string]> = { m: ['m', '阳性'], f: ['f', '阴性'], mf: ['m/f', '阴阳同形'] };
export function Gender({ g }: { g?: string }) {
  if (!g || !GENDER[g]) return null;
  return (
    <span class={`gender g-${g}`} title={GENDER[g][1]}>
      {GENDER[g][0]}
    </span>
  );
}

export const POS_LABEL: Record<string, string> = {
  noun: 'noun 名词',
  verb: 'verb 动词',
  adj: 'adjective 形容词',
  adv: 'adverb 副词',
  pron: 'pronoun 代词',
  prep: 'preposition 介词',
  conj: 'conjunction 连词',
  det: 'determiner 限定词',
  intj: 'interjection 感叹词',
  num: 'number 数词',
  phrase: 'phrase 短语',
};
