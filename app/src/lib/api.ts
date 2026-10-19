// Typed client for the Worker API (CONTRATOS.md §3).
import type {
  ApiErrorBody, Card, ExplainRequest, ExplainResponse, SyncGetResponse, SyncPostResponse,
  TranslateRequest, TranslateResponse,
} from '../types';
import { getCode } from './code';

export type ApiErrorCode = 'offline' | 'no_code' | 'no_api' | 'timeout' | 'bad_request' | 'bad_code' | 'daily_limit' | 'upstream' | string;

export class ApiError extends Error {
  constructor(public status: number, public code: ApiErrorCode) {
    super(code);
  }
}

const API_URL: string = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '');

async function call<T>(method: 'GET' | 'POST', path: string, body?: unknown, auth = true, timeoutMs = 20000): Promise<T> {
  if (!API_URL) throw new ApiError(0, 'no_api');
  const code = getCode();
  if (auth && !code) throw new ApiError(401, 'no_code');
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new ApiError(0, 'offline');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res: Response;
  try {
    const headers: Record<string, string> = {};
    if (auth && code) headers['X-Code'] = code;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    res = await fetch(API_URL + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: ctrl.signal,
    });
  } catch (e) {
    throw new ApiError(0, (e as Error)?.name === 'AbortError' ? 'timeout' : 'offline');
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    let err: ApiErrorBody = { error: 'upstream' };
    try {
      err = (await res.json()) as ApiErrorBody;
    } catch {
      /* non-JSON error */
    }
    throw new ApiError(res.status, err.error || String(res.status));
  }
  return (await res.json()) as T;
}

export const api = {
  configured: () => !!API_URL,
  health: () => call<{ ok: true }>('GET', '/health', undefined, false, 8000),
  explain: (req: ExplainRequest) => call<ExplainResponse>('POST', '/explain', req),
  translate: (req: TranslateRequest) => call<TranslateResponse>('POST', '/translate', req),
  syncGet: (since: number) => call<SyncGetResponse>('GET', `/sync?since=${Math.max(0, Math.floor(since))}`),
  syncPost: (cards: Card[]) => call<SyncPostResponse>('POST', '/sync', { cards }),
};

/** Bilingual message for an API error. */
export function errorText(e: unknown): { en: string; zh: string } {
  const code = e instanceof ApiError ? e.code : 'offline';
  switch (code) {
    case 'offline':
    case 'timeout':
      return { en: "You're offline. Try again when you have connection.", zh: '没有网络，请联网后再试。' };
    case 'no_code':
      return { en: 'Add your code in Settings to use AI.', zh: '请先在设置里输入你的代码。' };
    case 'no_api':
      return { en: 'The AI server is not configured yet.', zh: 'AI 服务器还没有配置。' };
    case 'bad_code':
      return { en: 'This code is not valid.', zh: '这个代码无效。' };
    case 'daily_limit':
      return { en: 'Daily AI limit reached. It resets tomorrow.', zh: '今天的 AI 次数已用完，明天再试。' };
    case 'bad_request':
      return { en: 'The request was not valid.', zh: '请求无效。' };
    default:
      return { en: 'The AI is busy. Please try again.', zh: 'AI 暂时不可用，请稍后再试。' };
  }
}
