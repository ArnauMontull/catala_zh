// Text-to-speech with the iOS system voices (free, offline).
// iOS needs a first speak() inside a user gesture: unlockTTS() does it on the first tap.
import { lsGet, lsSet } from './kv';
import { toast } from './toast';

const synth: SpeechSynthesis | undefined = typeof speechSynthesis !== 'undefined' ? speechSynthesis : undefined;
let voices: SpeechSynthesisVoice[] = [];

function loadVoices() {
  if (!synth) return;
  try {
    voices = synth.getVoices();
  } catch {
    voices = [];
  }
}
if (synth) {
  loadVoices();
  synth.addEventListener?.('voiceschanged', loadVoices);
}

const lc = (v: SpeechSynthesisVoice) => v.lang.toLowerCase().replace('_', '-');

export function pickVoice(lang: 'ca' | 'zh'): { voice?: SpeechSynthesisVoice; lang: string; fallback: boolean } {
  if (!voices.length) loadVoices();
  if (lang === 'ca') {
    const ca = voices.find((v) => lc(v).startsWith('ca'));
    if (ca) return { voice: ca, lang: ca.lang, fallback: false };
    const es = voices.find((v) => lc(v) === 'es-es') ?? voices.find((v) => lc(v).startsWith('es'));
    return { voice: es, lang: es?.lang ?? 'ca-ES', fallback: true };
  }
  const zh =
    voices.find((v) => lc(v) === 'zh-cn') ??
    voices.find((v) => lc(v).startsWith('zh-hans')) ??
    voices.find((v) => lc(v).startsWith('zh') && !/hk|tw|yue/.test(lc(v)));
  return { voice: zh, lang: zh?.lang ?? 'zh-CN', fallback: false };
}

export const hasCatalanVoice = () => {
  loadVoices();
  return voices.some((v) => lc(v).startsWith('ca'));
};

let unlocked = false;
export function unlockTTS() {
  if (unlocked || !synth) return;
  unlocked = true;
  try {
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    synth.speak(u);
  } catch {
    /* ignore */
  }
}

export function speak(text: string, lang: 'ca' | 'zh') {
  if (!synth || !text) return;
  unlockTTS();
  const { voice, lang: l, fallback } = pickVoice(lang);
  if (fallback && voices.length && lsGet('cz.caVoiceWarned') !== '1') {
    lsSet('cz.caVoiceWarned', '1');
    toast(
      'No Catalan voice on this iPhone, using Spanish. Install it: Settings › Accessibility › Spoken Content › Voices › Catalan.',
      '手机没有加泰罗尼亚语语音，暂用西班牙语。安装方法：设置 › 辅助功能 › 朗读内容 › 声音 › 加泰罗尼亚语。',
      true,
    );
  }
  try {
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    if (voice) u.voice = voice;
    u.lang = l;
    u.rate = lang === 'ca' ? 0.9 : 0.85;
    synth.speak(u);
  } catch {
    /* ignore */
  }
}
