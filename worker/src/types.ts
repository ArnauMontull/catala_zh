// Tipos copiados de CONTRATOS.md (secciones 2 y 3). Si cambian, cámbialos allí primero.

export type Lang = "ca" | "zh" | "es" | "en";
export type TargetLang = "ca" | "zh";

export type Entry = {
  id: string; // lema catalán; si hay homógrafos, "banc#2"
  ca: string; // forma de cita: "tenir", "nen", "adonar-se'n"
  pos: "noun" | "verb" | "adj" | "adv" | "pron" | "prep" | "conj" | "det" | "intj" | "num" | "phrase";
  gender?: "m" | "f" | "mf"; // solo sustantivos y adjetivos con género
  fem?: string; // forma femenina, p. ej. "nena" para "nen"
  plural?: string;
  zh: string[]; // chino SIMPLIFICADO, de 1 a 3 acepciones, la más común primero
  pinyin: string[]; // alineado con zh, con marcas de tono: "hái zi"
  en: string[]; // de 1 a 3 acepciones
  es: string[]; // de 1 a 3 equivalentes en español
  ex?: { ca: string; zh: string; en?: string }; // frase A1 corta (≤ 10 palabras)
  freq: number; // posición por frecuencia (1 = la más común)
  verb?: { conj: string; pronominal?: boolean }; // "1a", "2a", "3a-incoativa", "3a-pura", "irregular"
};

export type ExplainResponse = {
  entry: Omit<Entry, "freq">; // id = "ai:" + norm(ca)
  senses: { zh: string; pinyin: string; en: string; es: string; note_zh?: string }[];
  examples: { ca: string; zh: string }[]; // 2 o 3, nivel A1-A2
  note_en?: string; // uso, registro, falsos amigos con el español
  cached: boolean;
};

export type TranslateResponse = {
  translation: string; // en el idioma `to`
  pinyin?: string; // solo si to == "zh"
  words: { src: string; lemma?: string; zh: string; en: string; note?: string }[];
  cached: boolean;
};

export type Card = {
  id: string; // entryId o "ai:..."
  front: { ca: string; zh: string; pinyin: string; en: string; es: string; ex?: { ca: string; zh: string } };
  fsrs: unknown; // Card de ts-fsrs serializado, opaco para el Worker
  updated_at: number; // ms; gana la última escritura
  deleted?: boolean;
};

export type ExplainRequest = { word: string; lang: Lang };
export type TranslateRequest = { text: string; from: Lang; to: TargetLang };

export interface Env {
  CACHE: KVNamespace;
  DB: D1Database;
  ANTHROPIC_API_KEY?: string;
  ALLOWED_CODES?: string;
  ALLOWED_ORIGIN?: string;
  DAILY_LIMIT?: string;
  MOCK_AI?: string;
}
