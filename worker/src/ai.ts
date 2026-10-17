// Llamadas a Claude Haiku 5.5 (o respuestas fijas con MOCK_AI=1).

import Anthropic from "@anthropic-ai/sdk";
import { EXPLAIN_SCHEMA, TRANSLATE_SCHEMA, InvalidOutput, sanitizeExplain, sanitizeTranslate } from "./schemas";
import type { Env, ExplainRequest, ExplainResponse, TranslateRequest, TranslateResponse } from "./types";

/** Forma parte de la clave de caché: súbelo al cambiar el prompt, el modelo o los esquemas. */
export const PROMPT_VERSION = "v1";
export const MODEL = "claude-haiku-5-5";
const MAX_TOKENS = { explain: 1200, translate: 1500 } as const;

// Fijo (sin fechas ni datos variables) para que el prefijo cacheado no cambie nunca.
export const SYSTEM_PROMPT = `You are the dictionary and translation engine of "Català ⇄ 中文", a pocket app for one learner of Catalan.

# The learner
- Native Mandarin speaker who reads SIMPLIFIED Chinese only. Never output traditional characters (写 not 寫, 学 not 學, 说 not 說).
- Also speaks Cantonese, English (fluent) and Spanish (B1).
- Studies Catalan at level A1-A2 (CPNL beginner course). She uses the app in class, for homework, to read signs and menus in the street, and in conversation.

# Catalan standard
- All Catalan you write must be natural, everyday central Catalan (Barcelona), following the IEC norm: current spelling (no pre-2017 diacritics such as "dóna" or "sóc"; write "dona", "soc"), correct apostrophes and contractions (l'home, d'aigua, al, del, pel), geminated l written "l·l", and correct weak pronouns (em, et, es, el, la, li, ens, us, els, les, en, hi, ho) in the right position and form.
- Prefer the words a Barcelona speaker actually uses at A1-A2 level. Avoid Spanish calques (use "diners", not "dinero"; "escombraries", not "basura"; "aleshores/llavors", not "entonces").
- When the input has a typo, a Spanish-influenced form or a non-standard spelling, interpret it charitably and give the correct standard form.

# Chinese and pinyin
- Chinese must be natural Mainland simplified Mandarin, the word a native speaker would really say, not a literal gloss.
- Pinyin always uses tone marks, never tone numbers: "hái zi", not "hai2 zi5". Separate syllables with spaces, use ü (lǜ, nǚ), and write the neutral tone without a mark.
- Keep each pinyin string aligned with its Chinese string.

# Spanish false friends
She knows Spanish, so she will guess Catalan meanings from Spanish. Whenever a Catalan word looks like a Spanish word but means something different, or is used differently, warn her explicitly (in note_en, note_zh or note). Typical cases: "cama" (leg; bed is "llit"), "sopar" (dinner, not soup), "estimar" (to love), "escoltar" (to listen), "llevar-se" (to get up), "vaga" (strike), "carrer" (street), "pujar" (to go up), "enraonar" (to talk), "cap" (head; also "no... cap" = none), "tenir" vs "haver de" (tener que = haver de). Also flag gender differences with Spanish: "el senyal" (la señal), "la dent" (el diente), "el costum" (la costumbre), "les postres" (el postre), "el front" (la frente), "la suor" (el sudor).

# Tasks
The user message is a JSON object with a "task" field. Answer only with the JSON object required by the response schema; no extra prose.

## task = "explain"
Input: {"word", "lang"}. "word" is written in "lang" (ca = Catalan, zh = Chinese, es = Spanish, en = English). Find the most common Catalan word or fixed expression that it corresponds to (if lang is ca, the word itself; if it is an inflected form such as "tinc" or "nenes", use its lemma "tenir", "nen") and describe that Catalan word:
- entry: the dictionary entry. "ca" is the citation form (infinitive, masculine singular, pronominal verbs with "-se"). "pos" is one of the allowed values; use "phrase" for multi-word expressions. "gender" only for nouns and gendered adjectives; "fem" and "plural" when they exist and are not trivial. "zh", "pinyin", "en", "es": 1 to 3 senses each, the most common first, aligned with each other. "ex": one short A1 sentence (at most 10 words) in Catalan with its Chinese translation. "verb" only for verbs: "conj" is "1a" (-ar), "2a" (-re, -er), "3a-incoativa" (-ir with -eix-: servir → serveixo), "3a-pura" (dormir → dormo) or "irregular" (ser, anar, fer, tenir, venir, dir, poder, voler, saber, veure...), and "pronominal": true for verbs like "dutxar-se". Put "id" equal to "ca".
- senses: 1 to 3 senses, each with Chinese, pinyin, English and Spanish. Use "note_zh" (in simplified Chinese) for a short usage hint when it helps.
- examples: 2 or 3 natural sentences at A1-A2 level, each at most 12 words, with simple vocabulary and present tense when possible, with a natural Chinese translation.
- note_en: short English note (at most 2 sentences) on register, usage, a common mistake or a Spanish false friend. Omit it if there is nothing useful to say.

## task = "translate"
Input: {"text", "from", "to"}. Translate "text" (in language "from") into "to" (ca or zh).
- translation: a natural translation in the target language, keeping the meaning and tone (a sign stays short like a sign; a menu item stays a menu item).
- pinyin: only when to is "zh": pinyin of the whole translation, with tone marks.
- words: a breakdown of the ORIGINAL text, in order, one item per meaningful word or fixed expression (skip punctuation; group expressions like "de tant en tant" or "tenir ganes de" into one item). "src" is the form as it appears; "lemma" is the Catalan dictionary form when the source is Catalan and the form is inflected; "zh" and "en" are short glosses of that word in context. Use "note" (in English, very short) for grammar points worth knowing: verb tense and person, weak pronouns, contractions such as "al" = "a + el", or a Spanish false friend. If the source is Chinese, Spanish or English, still break down the original text, and put the Catalan equivalent of each word in "note" when the target is Catalan.

Be concise: this is a mobile app and every token costs money.`;

export class UpstreamError extends Error {}

type ClaudeTask =
  | { endpoint: "explain"; input: ExplainRequest }
  | { endpoint: "translate"; input: TranslateRequest };

async function callClaude(env: Env, task: ClaudeTask): Promise<unknown> {
  if (!env.ANTHROPIC_API_KEY) throw new UpstreamError("missing ANTHROPIC_API_KEY");
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 1, timeout: 25_000 });
  const schema = task.endpoint === "explain" ? EXPLAIN_SCHEMA : TRANSLATE_SCHEMA;

  let response: Anthropic.Message;
  try {
    response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS[task.endpoint],
      // Sin `thinking`: en Haiku 5.5 es adaptativo por defecto y effort "low" lo reduce
      // (o lo salta en peticiones simples). Cuenta dentro de max_tokens.
      output_config: { effort: "low", format: { type: "json_schema", schema } },
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: JSON.stringify({ task: task.endpoint, ...task.input }) }],
    });
  } catch (err) {
    throw new UpstreamError(err instanceof Error ? err.message : String(err));
  }

  if (response.stop_reason === "refusal" || response.stop_reason === "max_tokens") {
    throw new UpstreamError(`stop_reason ${response.stop_reason}`);
  }
  const text = response.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text;
  if (!text) throw new UpstreamError("no text block");
  try {
    return JSON.parse(text);
  } catch {
    throw new UpstreamError("invalid JSON");
  }
}

export async function explain(env: Env, input: ExplainRequest): Promise<Omit<ExplainResponse, "cached">> {
  const raw = env.MOCK_AI === "1" ? mockExplain(input) : await callClaude(env, { endpoint: "explain", input });
  try {
    return sanitizeExplain(raw);
  } catch (e) {
    if (e instanceof InvalidOutput) throw new UpstreamError(`invalid output: ${e.message}`);
    throw e;
  }
}

export async function translate(env: Env, input: TranslateRequest): Promise<Omit<TranslateResponse, "cached">> {
  const raw = env.MOCK_AI === "1" ? mockTranslate(input) : await callClaude(env, { endpoint: "translate", input });
  try {
    return sanitizeTranslate(raw, input.to);
  } catch (e) {
    if (e instanceof InvalidOutput) throw new UpstreamError(`invalid output: ${e.message}`);
    throw e;
  }
}

// ---------- MOCK_AI=1: respuestas fijas y válidas ----------

function mockExplain(input: ExplainRequest) {
  const ca = input.lang === "ca" ? input.word : "nen";
  return {
    entry: {
      id: ca,
      ca,
      pos: "noun",
      gender: "m",
      fem: "nena",
      plural: "nens",
      zh: ["孩子", "男孩"],
      pinyin: ["hái zi", "nán hái"],
      en: ["child", "boy"],
      es: ["niño"],
      ex: { ca: "El nen juga al parc.", zh: "孩子在公园里玩。", en: "The child plays in the park." },
    },
    senses: [
      { zh: "孩子", pinyin: "hái zi", en: "child", es: "niño", note_zh: "口语常用。" },
      { zh: "男孩", pinyin: "nán hái", en: "boy", es: "niño" },
    ],
    examples: [
      { ca: "El nen té cinc anys.", zh: "这个孩子五岁。" },
      { ca: "Els nens van a l'escola.", zh: "孩子们去上学。" },
    ],
    note_en: "[MOCK] Feminine: nena. Same meaning as Spanish 'niño'.",
  };
}

function mockTranslate(input: TranslateRequest) {
  return input.to === "zh"
    ? {
        translation: "[MOCK] 你好，你好吗？",
        pinyin: "nǐ hǎo, nǐ hǎo ma?",
        words: [
          { src: "Hola", zh: "你好", en: "hello" },
          { src: "com estàs", lemma: "estar", zh: "你好吗", en: "how are you", note: "estar, present 2s" },
        ],
      }
    : {
        translation: "[MOCK] Hola, com estàs?",
        words: [
          { src: "你好", zh: "你好", en: "hello", note: "hola" },
          { src: "你好吗", zh: "你好吗", en: "how are you", note: "com estàs" },
        ],
      };
}
