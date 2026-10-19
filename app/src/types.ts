// Copied literally from ../../CONTRATOS.md (frozen 17/10/2026). Change the contract first.

// §2 manifest.json
export type Manifest = {
  version: string;
  counts: { entries: number; forms: number };
  files: { name: string; bytes: number; sha256: string }[];
};

// §2 entries.json: Entry[]
export type Entry = {
  id: string;            // lema catalán; si hay homógrafos, "banc#2"
  ca: string;            // forma de cita: "tenir", "nen", "adonar-se'n"
  pos: "noun"|"verb"|"adj"|"adv"|"pron"|"prep"|"conj"|"det"|"intj"|"num"|"phrase";
  gender?: "m"|"f"|"mf"; // solo sustantivos y adjetivos con género
  fem?: string;          // forma femenina, p. ej. "nena" para "nen"
  plural?: string;
  zh: string[];          // chino SIMPLIFICADO, de 1 a 3 acepciones, la más común primero
  pinyin: string[];      // alineado con zh, con marcas de tono: "hái zi"
  en: string[];          // de 1 a 3 acepciones
  es: string[];          // de 1 a 3 equivalentes en español
  ex?: { ca: string; zh: string; en?: string };  // frase A1 corta (≤ 10 palabras)
  freq: number;          // posición por frecuencia (1 = la más común)
  verb?: { conj: string; pronominal?: boolean };  // conj: "1a", "2a", "3a-incoativa", "3a-pura", "irregular"
};

// §2 index.json
export type Index = {
  forms: Record<string, [string, string][]>; // norm(forma) → [[entryId, tag]], p. ej. "tinc" → [["tenir","ind.pres.1s"]]
  zh:    Record<string, string[]>;           // palabra china → entryIds
  es:    Record<string, string[]>;           // norm(palabra es) → entryIds
  en:    Record<string, string[]>;           // norm(palabra en) → entryIds
};

// §2 conj.json: Record<entryId, Conj>
export type Conj = Record<Tense, string[]>; // 6 personas: jo, tu, ell/ella/vostè, nosaltres, vosaltres, ells/elles/vostès
export type Tense =
  "ind.pres"|"ind.imperf"|"ind.pret"|"ind.fut"|"cond.pres"|
  "ind.perf"|"ind.plusq"|"ind.pret_perif"|"ind.fut_perf"|"cond.perf"|
  "subj.pres"|"subj.imperf"|"subj.perf"|"subj.plusq"|
  "imp"; // imp: 6 posiciones, con "" donde no existe (jo)
// Formas no personales en la clave especial "np": [infinitiu, gerundi, participi_m, participi_f, participi_mpl, participi_fpl]
export type ConjFile = Record<string, Partial<Conj> & { np?: string[] }>;

// §2 febles.json
export type Febles = { sections: { id: string; title_en: string; title_zh: string;
  body_en: string; body_zh: string;              // markdown sencillo
  table?: { head: string[]; rows: string[][] };
  examples: { ca: string; zh: string; en: string }[] }[] };

// §3 API del Worker
export type Lang = "ca"|"zh"|"es"|"en";
export type ExplainRequest = { word: string; lang: "ca"|"zh"|"es"|"en" };
export type TranslateRequest = { text: string; from: "ca"|"zh"|"es"|"en"; to: "ca"|"zh" };

export type ExplainResponse = {
  entry: Omit<Entry, "freq">;   // misma forma que en entries.json; id = "ai:" + norm(ca)
  senses: { zh: string; pinyin: string; en: string; es: string; note_zh?: string }[];
  examples: { ca: string; zh: string }[];  // 2 o 3, nivel A1-A2
  note_en?: string;             // uso, registro, falsos amigos con el español
  cached: boolean;
};
export type TranslateResponse = {
  translation: string;          // en el idioma `to`
  pinyin?: string;              // solo si to == "zh"
  words: { src: string; lemma?: string; zh: string; en: string; note?: string }[]; // desglose de la frase original
  cached: boolean;
};
export type Card = {
  id: string;                   // entryId o "ai:..."
  front: { ca: string; zh: string; pinyin: string; en: string; es: string; ex?: {ca: string; zh: string} };
  fsrs: unknown;                // Card de ts-fsrs serializado (fechas en ISO), opaco para el Worker
  updated_at: number;           // ms; el Worker guarda la versión con el updated_at mayor (gana la última escritura)
  deleted?: boolean;
};
export type SyncGetResponse = { cards: Card[]; now: number };
export type SyncPostResponse = { ok: true; now: number };
export type ApiErrorBody = { error: "bad_request"|"bad_code"|"daily_limit"|"upstream"|string };
