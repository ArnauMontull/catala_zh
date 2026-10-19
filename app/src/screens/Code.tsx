import { useRef, useState } from 'preact/hooks';
import { Seal, Spinner } from '../components/common';
import { api, ApiError } from '../lib/api';
import { clearCode, formatCode, isValidCode, saveCode, skipCode } from '../lib/code';
import { syncNow } from '../lib/deck';

/** First-run screen to paste the personal code. Skippable: offline search works without it. */
export function CodeScreen({ onDone, inSheet }: { onDone: () => void; inSheet?: boolean }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const valid = isValidCode(code);

  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setErr(null);
    saveCode(code);
    try {
      // Cheap check that does not use AI quota. Offline: accept and verify later.
      if (api.configured()) await api.syncGet(Date.now());
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.code === 'bad_code')) {
        clearCode();
        setErr('This code is not valid. 这个代码无效。');
        setBusy(false);
        return;
      }
    }
    setBusy(false);
    void syncNow();
    onDone();
  };

  const paste = async () => {
    try {
      const t = await navigator.clipboard.readText();
      setCode(formatCode(t));
    } catch {
      input.current?.focus();
    }
  };

  return (
    <div class={`codescreen ${inSheet ? 'in-sheet' : ''}`}>
      <div class="stripes" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </div>
      <div class="code-inner">
        <Seal size={84} />
        <h1 class="code-title">
          <span lang="ca">Benvinguda!</span>
          <span class="zh">欢迎！</span>
        </h1>
        <p class="code-sub">
          Paste your personal code to unlock the AI and save your progress in the cloud.
          <br />
          <span class="zh">粘贴你的专属代码，就能使用 AI 并把学习进度保存到云端。</span>
        </p>
        <form
          class="code-form"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <input
            ref={input}
            class="code-input"
            value={code}
            onInput={(e) => setCode(formatCode((e.currentTarget as HTMLInputElement).value))}
            placeholder="XXXX-XXXX-XXXX"
            inputMode="text"
            autocapitalize="characters"
            autocomplete="one-time-code"
            autocorrect="off"
            spellcheck={false}
            maxLength={14}
            aria-label="Code 代码"
          />
          <div class="code-buttons">
            <button type="button" class="btn" onClick={paste}>
              Paste · 粘贴
            </button>
            <button type="submit" class="btn btn-accent" disabled={!valid || busy}>
              {busy ? <Spinner /> : null}
              Continue · 继续
            </button>
          </div>
          {err && <p class="note warn">{err}</p>}
        </form>
        {!inSheet && (
          <button
            type="button"
            class="linkbtn"
            onClick={() => {
              skipCode();
              onDone();
            }}
          >
            Skip for now · 暂时跳过
            <small>The offline dictionary works without a code. 没有代码也可以离线查词。</small>
          </button>
        )}
      </div>
    </div>
  );
}
