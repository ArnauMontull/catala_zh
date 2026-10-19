import { useState } from 'preact/hooks';
import { Seal } from '../components/common';
import { IconBack } from '../components/icons';
import { api } from '../lib/api';
import { clearCode, codeStore } from '../lib/code';
import { dataStatus, startData } from '../lib/data';
import { newPerDayStore, setNewPerDay, syncNow, syncStore } from '../lib/deck';
import { closeSheet } from '../lib/nav';
import { useStore } from '../lib/store';
import { hasCatalanVoice, speak } from '../lib/tts';
import { CodeScreen } from './Code';

const mask = (c: string) => `${c.slice(0, 4)}-••••-${c.slice(-4)}`;

export function SettingsSheet() {
  const code = useStore(codeStore);
  const status = useStore(dataStatus);
  const sync = useStore(syncStore);
  const limit = useStore(newPerDayStore);
  const [editing, setEditing] = useState(false);
  const caVoice = hasCatalanVoice();

  return (
    <article class="word settings">
      <div class="sheetbar">
        <button type="button" class="iconbtn" aria-label="Back 返回" onClick={closeSheet}>
          <IconBack />
        </button>
        <span class="sheet-title">
          Settings <span class="zh">设置</span>
        </span>
        <span class="iconbtn" />
      </div>
      <div class="sheet-scroll">
        <section class="set-group">
          <h3 class="label">
            Your code <span class="zh">你的代码</span>
          </h3>
          {code && !editing ? (
            <div class="set-row">
              <span class="mono">{mask(code)}</span>
              <span class="set-actions">
                <button type="button" class="btn small" onClick={() => setEditing(true)}>
                  Change 更换
                </button>
                <button type="button" class="btn small" onClick={clearCode}>
                  Remove 删除
                </button>
              </span>
            </div>
          ) : (
            <CodeScreen inSheet onDone={() => setEditing(false)} />
          )}
        </section>

        <section class="set-group">
          <h3 class="label">
            Cloud sync <span class="zh">云同步</span>
          </h3>
          <div class="set-row">
            <span>
              {sync.status === 'off' || !code
                ? 'Off (no code) · 未开启'
                : sync.status === 'syncing'
                  ? 'Syncing… 同步中'
                  : sync.status === 'offline'
                    ? 'Offline, will retry · 离线，稍后重试'
                    : sync.status === 'error'
                      ? 'Error, will retry · 出错，稍后重试'
                      : sync.last
                        ? `Synced ${new Date(sync.last).toLocaleString()} · 已同步`
                        : 'Not synced yet · 尚未同步'}
              {sync.queued > 0 && <small class="muted"> · {sync.queued} waiting 待上传</small>}
            </span>
            <button type="button" class="btn small" disabled={!code} onClick={() => syncNow()}>
              Sync 同步
            </button>
          </div>
        </section>

        <section class="set-group">
          <h3 class="label">
            Review <span class="zh">复习</span>
          </h3>
          <div class="set-row">
            <span>
              New cards per day <span class="zh">每日新词</span>
            </span>
            <div class="stepper">
              <button type="button" aria-label="Fewer 减少" onClick={() => setNewPerDay(limit - 1)}>
                −
              </button>
              <span>{limit}</span>
              <button type="button" aria-label="More 增加" onClick={() => setNewPerDay(limit + 1)}>
                +
              </button>
            </div>
          </div>
        </section>

        <section class="set-group">
          <h3 class="label">
            Voice <span class="zh">语音</span>
          </h3>
          <div class="set-row">
            <span>{caVoice ? 'Catalan voice installed ✓ 已安装加泰罗尼亚语语音' : 'Catalan voice not found · 没有加泰罗尼亚语语音'}</span>
            <button type="button" class="btn small" onClick={() => speak('Bon dia! Com estàs?', 'ca')}>
              Test 试听
            </button>
          </div>
          {!caVoice && (
            <p class="muted small-p">
              Settings › Accessibility › Spoken Content › Voices › Catalan (download «Montserrat» or «Jordi»).
              <br />
              <span class="zh">设置 › 辅助功能 › 朗读内容 › 声音 › 加泰罗尼亚语（下载 Montserrat 或 Jordi）。</span>
            </p>
          )}
        </section>

        <section class="set-group">
          <h3 class="label">
            Dictionary <span class="zh">词典</span>
          </h3>
          <div class="set-row">
            <span>
              {status.entries ? `${status.entries.toLocaleString()} words · 个词` : '—'}
              <small class="muted">
                {' '}
                · {status.version ?? ''} {status.base === 'data-sample' ? '(sample 示例)' : ''}
              </small>
            </span>
            <button type="button" class="btn small" onClick={() => startData(true)}>
              Update 更新
            </button>
          </div>
          {!api.configured() && <p class="muted small-p">AI server not configured (VITE_API_URL).</p>}
        </section>

        <section class="about">
          <Seal size={48} />
          <p>
            <b>Català 中文</b> · Fet amb amor, per a tu. <span class="zh">用心为你做的。</span>
          </p>
          <p class="muted small-p">
            Data: Wiktionary (CC BY-SA 4.0) via kaikki.org · CC-CEDICT (CC BY-SA 4.0) · translations checked with Claude.
            Voices: iOS system speech.
          </p>
        </section>
      </div>
    </article>
  );
}
