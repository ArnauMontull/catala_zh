import type { JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { IconGrammar, IconReview, IconSearch, IconSentence } from './components/icons';
import { codeSkipped, codeStore } from './lib/code';
import { pendingStore } from './lib/deck';
import { setTab, sheetStore, tabStore, type Sheet, type Tab } from './lib/nav';
import { useStore } from './lib/store';
import { toastStore } from './lib/toast';
import { CodeScreen } from './screens/Code';
import { ConjSheet, GrammarScreen } from './screens/Grammar';
import { ReviewScreen } from './screens/Review';
import { SearchScreen } from './screens/Search';
import { SentenceScreen } from './screens/Sentence';
import { SettingsSheet } from './screens/Settings';
import { EntrySheet, WordView } from './screens/Word';

const TABS: { id: Tab; en: string; zh: string; Icon: (p: { size?: number }) => JSX.Element }[] = [
  { id: 'search', en: 'Search', zh: '查词', Icon: IconSearch },
  { id: 'sentence', en: 'Sentence', zh: '句子', Icon: IconSentence },
  { id: 'review', en: 'Review', zh: '复习', Icon: IconReview },
  { id: 'grammar', en: 'Grammar', zh: '语法', Icon: IconGrammar },
];

function SheetView({ sheet }: { sheet: Sheet }) {
  switch (sheet.kind) {
    case 'entry':
      return <EntrySheet id={sheet.id} />;
    case 'ai':
      return <WordView entry={sheet.data.entry} ai={sheet.data} query={sheet.query} />;
    case 'conj':
      return <ConjSheet id={sheet.id} />;
    case 'settings':
      return <SettingsSheet />;
  }
}

function Toasts() {
  const t = useStore(toastStore);
  if (!t) return null;
  return (
    <div class={`toast ${t.long ? 'long' : ''}`} role="status" key={t.id} onClick={() => toastStore.set(null)}>
      <span>{t.en}</span>
      {t.zh && <span class="zh">{t.zh}</span>}
    </div>
  );
}

export function App() {
  const tab = useStore(tabStore);
  const sheets = useStore(sheetStore);
  const pending = useStore(pendingStore);
  const code = useStore(codeStore);
  const skipped = useStore(codeSkipped);
  const [gate, setGate] = useState(!code && !skipped);
  // Screens mount on first visit and then stay mounted (keeps state, instant switching).
  const [visited, setVisited] = useState<Set<Tab>>(() => new Set<Tab>(['search']));
  useEffect(() => {
    if (!visited.has(tab)) setVisited(new Set(visited).add(tab));
  }, [tab]);

  if (gate) return <CodeScreen onDone={() => setGate(false)} />;

  const top = sheets[sheets.length - 1];
  return (
    <div class="app">
      <main class="main" aria-hidden={!!top}>
        <SearchScreen active={tab === 'search'} />
        {visited.has('sentence') && <SentenceScreen active={tab === 'sentence'} />}
        {visited.has('review') && <ReviewScreen active={tab === 'review'} />}
        {visited.has('grammar') && <GrammarScreen active={tab === 'grammar'} />}
      </main>
      {top && (
        <div class="sheet" key={sheets.length} role="dialog" aria-modal="true">
          <SheetView sheet={top} />
        </div>
      )}
      <nav class="tabbar" aria-label="Tabs">
        {TABS.map(({ id, en, zh, Icon }) => (
          <button
            type="button"
            class={`tab ${tab === id ? 'on' : ''}`}
            aria-current={tab === id ? 'page' : undefined}
            onClick={() => {
              setTab(id);
              if (id === tab) window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          >
            <span class="tab-icon">
              <Icon size={24} />
              {id === 'review' && pending > 0 && <span class="tab-badge">{pending > 99 ? '99+' : pending}</span>}
            </span>
            <span class="tab-en">{en}</span>
            <span class="tab-zh">{zh}</span>
          </button>
        ))}
      </nav>
      <Toasts />
    </div>
  );
}
