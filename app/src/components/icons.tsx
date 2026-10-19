import type { ComponentChildren } from 'preact';

type P = { size?: number; class?: string };
const svg = (d: ComponentChildren, { size = 24, class: c }: P, fill = false) => (
  <svg
    class={c}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={fill ? 'currentColor' : 'none'}
    stroke={fill ? 'none' : 'currentColor'}
    stroke-width="1.9"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    {d}
  </svg>
);

export const IconSearch = (p: P) => svg(<><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></>, p);
export const IconSentence = (p: P) =>
  svg(<><path d="M4 5.5h16v10H9l-5 4z" /><path d="M8 9.5h8M8 12.5h5" /></>, p);
export const IconReview = (p: P) =>
  svg(<><rect x="3.5" y="6.5" width="13" height="13" rx="2.5" /><path d="M7.5 4.5h10a3 3 0 0 1 3 3v10" /></>, p);
export const IconGrammar = (p: P) =>
  svg(<><path d="M5 4.5h11a3 3 0 0 1 3 3v12H8a3 3 0 0 1-3-3z" /><path d="M5 16.5a3 3 0 0 1 3-3h11M9 8.5h6" /></>, p);
export const IconSpeaker = (p: P) =>
  svg(<><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" /><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" /></>, p);
export const IconStar = (p: P & { filled?: boolean }) =>
  svg(<path d="m12 3.8 2.5 5.1 5.6.8-4 3.9.9 5.6-5-2.6-5 2.6.9-5.6-4-3.9 5.6-.8z" />, p, !!p.filled);
export const IconBack = (p: P) => svg(<path d="M15 5l-7 7 7 7" />, p);
export const IconClose = (p: P) => svg(<path d="M6 6l12 12M18 6 6 18" />, p);
export const IconGear = (p: P) =>
  svg(
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </>,
    p,
  );
export const IconSparkle = (p: P) =>
  svg(<path d="M12 3.5 13.8 9l5.7 1.9-5.7 1.9L12 18.5l-1.8-5.7-5.7-1.9L10.2 9zM19 3v3M17.5 4.5h3" />, p);
export const IconTrash = (p: P) =>
  svg(<><path d="M4.5 7h15M10 11v6M14 11v6" /><path d="M6.5 7l1 12.5h9L17.5 7M9.5 7V4.5h5V7" /></>, p);
export const IconChevron = (p: P) => svg(<path d="m6 9 6 6 6-6" />, p);
