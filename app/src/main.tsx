import { render } from 'preact';
import { App } from './App';
import { restoreCode } from './lib/code';
import { retryDataIfEmpty, startData } from './lib/data';
import { initSyncTriggers, loadDeck, syncNow } from './lib/deck';
import { unlockTTS } from './lib/tts';
import './styles.css';

render(<App />, document.getElementById('app')!);

// Everything else happens after the first paint.
const later = (fn: () => void) => requestAnimationFrame(() => setTimeout(fn, 0));
later(() => {
  void startData();
  void loadDeck().then(() => restoreCode()).then(() => syncNow());
  initSyncTriggers();
  window.addEventListener('online', retryDataIfEmpty);
});

// iOS: speech must be started once inside a user gesture.
const unlock = () => {
  unlockTTS();
  window.removeEventListener('pointerdown', unlock, true);
};
window.addEventListener('pointerdown', unlock, true);
