// Esquemas JSON para output_config.format (structured outputs) y validación mínima.
// Limitaciones de la API: todos los objetos con additionalProperties:false; sin
// minLength/maxLength/minimum ni restricciones complejas de arrays. Los límites
// "de 1 a 3" se aplican después, en sanitize*().

import type { ExplainResponse, TranslateResponse } from "./types";

const str = { type: "string" } as const;
const strArr = { type: "array", items: str } as const;

export const POS = ["noun", "verb", "adj", "adv", "pron", "prep", "conj", "det", "intj", "num", "phrase"] as const;

// Omit<Entry, "freq">. El id lo pone el Worker ("ai:" + norm(ca)), pero se pide igual
// para que la forma coincida con la del build (Batch API).
export const ENTRY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["id", "ca", "pos", "zh", "pinyin", "en", "es"],
  properties: {
    id: str,
    ca: str,
    pos: { type: "string", enum: [...POS] },
    gender: { type: "string", enum: ["m", "f", "mf"] },
    fem: str,
    plural: str,
    zh: strArr,
    pinyin: strArr,
    en: strArr,
    es: strArr,
    ex: {
      type: "object",
      additionalProperties: false,
      required: ["ca", "zh"],
      properties: { ca: str, zh: str, en: str },
    },
    verb: {
      type: "object",
      additionalProperties: false,
      required: ["conj"],
      properties: {
        conj: { type: "string", enum: ["1a", "2a", "3a-incoativa", "3a-pura", "irregular"] },
        pronominal: { type: "boolean" },
      },
    },
  },
} as const;

// ExplainResponse sin `cached`.
export const EXPLAIN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["entry", "senses", "examples"],
  properties: {
    entry: ENTRY_SCHEMA,
    senses: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["zh", "pinyin", "en", "es"],
        properties: { zh: str, pinyin: str, en: str, es: str, note_zh: str },
      },
    },
    examples: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["ca", "zh"],
        properties: { ca: str, zh: str },
      },
    },
    note_en: str,
  },
} as const;

// TranslateResponse sin `cached`.
export const TRANSLATE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["translation", "words"],
  properties: {
    translation: str,
    pinyin: str,
    words: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["src", "zh", "en"],
        properties: { src: str, lemma: str, zh: str, en: str, note: str },
      },
    },
  },
} as const;

// ---------- Validación mínima de la salida del modelo ----------

const isStr = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
const isStrArr = (v: unknown): v is string[] => Array.isArray(v) && v.length > 0 && v.every(isStr);

export class InvalidOutput extends Error {}

function fail(msg: string): never {
  throw new InvalidOutput(msg);
}

/** Comprueba los campos mínimos y recorta a lo que dice el contrato. Lanza InvalidOutput. */
export function sanitizeExplain(raw: unknown): Omit<ExplainResponse, "cached"> {
  if (!raw || typeof raw !== "object") fail("not an object");
  const r = raw as Record<string, any>;
  const e = r.entry;
  if (!e || typeof e !== "object") fail("entry");
  if (!isStr(e.ca)) fail("entry.ca");
  if (!(POS as readonly string[]).includes(e.pos)) fail("entry.pos");
  for (const k of ["zh", "pinyin", "en", "es"] as const) if (!isStrArr(e[k])) fail(`entry.${k}`);
  if (!Array.isArray(r.senses) || r.senses.length === 0) fail("senses");
  for (const s of r.senses) if (!s || !isStr(s.zh) || !isStr(s.pinyin) || !isStr(s.en) || !isStr(s.es)) fail("sense");
  if (!Array.isArray(r.examples) || r.examples.length === 0) fail("examples");
  for (const x of r.examples) if (!x || !isStr(x.ca) || !isStr(x.zh)) fail("example");

  const n = Math.min(3, e.zh.length, e.pinyin.length);
  const entry: ExplainResponse["entry"] = {
    id: e.id, // lo sobrescribe el llamador con "ai:" + norm(ca)
    ca: e.ca.trim(),
    pos: e.pos,
    zh: e.zh.slice(0, n),
    pinyin: e.pinyin.slice(0, n),
    en: e.en.slice(0, 3),
    es: e.es.slice(0, 3),
  };
  if (e.gender === "m" || e.gender === "f" || e.gender === "mf") entry.gender = e.gender;
  if (isStr(e.fem)) entry.fem = e.fem;
  if (isStr(e.plural)) entry.plural = e.plural;
  if (e.ex && isStr(e.ex.ca) && isStr(e.ex.zh)) {
    entry.ex = { ca: e.ex.ca, zh: e.ex.zh, ...(isStr(e.ex.en) ? { en: e.ex.en } : {}) };
  }
  if (e.verb && isStr(e.verb.conj)) {
    entry.verb = { conj: e.verb.conj, ...(typeof e.verb.pronominal === "boolean" ? { pronominal: e.verb.pronominal } : {}) };
  }

  const out: Omit<ExplainResponse, "cached"> = {
    entry,
    senses: r.senses.slice(0, 3).map((s: any) => ({
      zh: s.zh,
      pinyin: s.pinyin,
      en: s.en,
      es: s.es,
      ...(isStr(s.note_zh) ? { note_zh: s.note_zh } : {}),
    })),
    examples: r.examples.slice(0, 3).map((x: any) => ({ ca: x.ca, zh: x.zh })),
  };
  if (isStr(r.note_en)) out.note_en = r.note_en;
  return out;
}

export function sanitizeTranslate(raw: unknown, to: "ca" | "zh"): Omit<TranslateResponse, "cached"> {
  if (!raw || typeof raw !== "object") fail("not an object");
  const r = raw as Record<string, any>;
  if (!isStr(r.translation)) fail("translation");
  if (!Array.isArray(r.words)) fail("words");
  const words = r.words
    .filter((w: any) => w && isStr(w.src) && typeof w.zh === "string" && typeof w.en === "string")
    .map((w: any) => ({
      src: w.src,
      ...(isStr(w.lemma) ? { lemma: w.lemma } : {}),
      zh: w.zh,
      en: w.en,
      ...(isStr(w.note) ? { note: w.note } : {}),
    }));
  const out: Omit<TranslateResponse, "cached"> = { translation: r.translation, words };
  if (to === "zh" && isStr(r.pinyin)) out.pinyin = r.pinyin;
  return out;
}
