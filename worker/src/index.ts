// Worker de «Català ⇄ 中文». Rutas (CONTRATOS.md §3):
//   GET /health · POST /explain · POST /translate · GET /sync · POST /sync

import { PROMPT_VERSION, UpstreamError, explain, translate } from "./ai";
import { getCards, parseCards, putCards } from "./sync";
import type { Env, ExplainRequest, Lang, TranslateRequest } from "./types";

const LANGS: readonly Lang[] = ["ca", "zh", "es", "en"];
const TARGETS = ["ca", "zh"] as const;
const MAX_WORD = 60;
const MAX_TEXT = 500;
const DEV_ORIGINS = ["http://localhost:5173", "http://localhost:4173"];
const DAY_S = 86_400;

// ---------- utilidades ----------

/** norm() del contrato §1: minúsculas, sin diacríticos, sin "·" ni ".", espacios colapsados. */
export function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[·.]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Clave de caché (contrato §1): como norm() pero conservando los acentos, para que «té» y «te» no choquen. */
export function cacheNorm(s: string): string {
  return s.normalize("NFC").toLowerCase().replace(/l[.·]l/g, "l·l").replace(/\s+/g, " ").trim();
}

const normFor = (s: string, lang: Lang) => (lang === "zh" ? s.trim() : cacheNorm(s));
const charLen = (s: string) => [...s].length; // puntos de código, no unidades UTF-16

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function corsHeaders(req: Request, env: Env): Record<string, string> {
  const origin = req.headers.get("Origin");
  const allowed = [env.ALLOWED_ORIGIN, ...DEV_ORIGINS].filter(Boolean);
  if (!origin || !allowed.includes(origin)) return { Vary: "Origin" };
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Code",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
const err = (status: number, error: string) => json({ error }, status);

/** Compara el código con cada uno de ALLOWED_CODES en tiempo constante (sin salir antes). */
async function checkCode(code: string | null, env: Env): Promise<string | null> {
  if (!code) return null;
  const candidate = code.trim().toUpperCase();
  const allowed = (env.ALLOWED_CODES ?? "")
    .split(",")
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean);
  if (candidate.length === 0 || allowed.length === 0) return null;
  // Se comparan los sha256 (misma longitud siempre) con timingSafeEqual.
  const enc = new TextEncoder();
  const a = await crypto.subtle.digest("SHA-256", enc.encode(candidate));
  let ok = false;
  for (const c of allowed) {
    const b = await crypto.subtle.digest("SHA-256", enc.encode(c));
    if (crypto.subtle.timingSafeEqual(a, b)) ok = true;
  }
  return ok ? candidate : null;
}

async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return undefined;
  }
}

function parseExplain(b: any): ExplainRequest | null {
  if (!b || typeof b.word !== "string" || !LANGS.includes(b.lang)) return null;
  const word = b.word.trim();
  if (word.length === 0 || charLen(word) > MAX_WORD) return null;
  return { word, lang: b.lang };
}

function parseTranslate(b: any): TranslateRequest | null {
  if (!b || typeof b.text !== "string" || !LANGS.includes(b.from) || !TARGETS.includes(b.to)) return null;
  const text = b.text.trim();
  if (text.length === 0 || charLen(text) > MAX_TEXT) return null;
  return { text, from: b.from, to: b.to };
}

const today = () => new Date().toISOString().slice(0, 10); // UTC

/**
 * Caché + límite diario alrededor de una llamada a la IA.
 * - Acierto de caché: cached:true y no cuenta.
 * - Fallo: comprueba el límite, cuenta la llamada y guarda la respuesta.
 */
async function cachedAI<T extends object>(
  env: Env,
  code: string,
  endpoint: "explain" | "translate",
  keyInput: unknown,
  ttl: number | undefined,
  produce: () => Promise<T>,
): Promise<Response> {
  const key = "c:" + (await sha256Hex(PROMPT_VERSION + endpoint + JSON.stringify(keyInput)));
  const hit = await env.CACHE.get<T>(key, "json");
  if (hit) return json({ ...hit, cached: true });

  const limit = Number.parseInt(env.DAILY_LIMIT ?? "", 10) || 150;
  const countKey = `count:${code}:${today()}`;
  const count = Number.parseInt((await env.CACHE.get(countKey)) ?? "0", 10) || 0;
  if (count >= limit) return err(429, "daily_limit");
  // Se cuenta antes de llamar: una llamada fallida también cuesta. (KV no es atómico;
  // con un solo usuario por código la carrera es irrelevante.)
  await env.CACHE.put(countKey, String(count + 1), { expirationTtl: 2 * DAY_S });

  let result: T;
  try {
    result = await produce();
  } catch (e) {
    if (e instanceof UpstreamError) {
      console.error(`upstream ${endpoint}: ${e.message}`);
      return err(502, "upstream");
    }
    throw e;
  }
  await env.CACHE.put(key, JSON.stringify(result), ttl ? { expirationTtl: ttl } : undefined);
  return json({ ...result, cached: false });
}

// ---------- router ----------

async function route(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";

  if (path === "/health" && req.method === "GET") return json({ ok: true });

  const known = ["/explain", "/translate", "/sync"];
  if (!known.includes(path)) return err(404, "not_found");

  const code = await checkCode(req.headers.get("X-Code"), env);
  if (!code) return err(401, "bad_code");

  if (path === "/explain" && req.method === "POST") {
    const input = parseExplain(await readJson(req));
    if (!input) return err(400, "bad_request");
    const keyInput = { word: normFor(input.word, input.lang), lang: input.lang };
    return cachedAI(env, code, "explain", keyInput, undefined, async () => {
      const r = await explain(env, input);
      r.entry.id = "ai:" + norm(r.entry.ca);
      return r;
    });
  }

  if (path === "/translate" && req.method === "POST") {
    const input = parseTranslate(await readJson(req));
    if (!input) return err(400, "bad_request");
    const keyInput = { text: normFor(input.text, input.from), from: input.from, to: input.to };
    return cachedAI(env, code, "translate", keyInput, 30 * DAY_S, () => translate(env, input));
  }

  if (path === "/sync" && req.method === "GET") {
    const raw = url.searchParams.get("since") ?? "0";
    const since = Number(raw);
    if (!/^\d+$/.test(raw) || !Number.isSafeInteger(since)) return err(400, "bad_request");
    return json(await getCards(env, code, since));
  }

  if (path === "/sync" && req.method === "POST") {
    const cards = parseCards(await readJson(req));
    if (!cards) return err(400, "bad_request");
    return json(await putCards(env, code, cards));
  }

  return err(405, "method_not_allowed");
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const cors = corsHeaders(req, env);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    let res: Response;
    try {
      res = await route(req, env);
    } catch (e) {
      console.error("unhandled", e);
      res = err(500, "internal");
    }
    for (const [k, v] of Object.entries(cors)) res.headers.set(k, v);
    return res;
  },
} satisfies ExportedHandler<Env>;
