# Contratos (congelados 17/10/2026)

Las tres piezas (`build/`, `app/`, `worker/`) solo se hablan a través de lo que hay aquí.
Si cambias algo, cámbialo aquí primero y avisa a las otras dos partes.

## 1. Normalización de búsqueda (idéntica en Python y TS)
`norm(s)`:
- Pasa a minúsculas.
- Aplica NFD y quita las marcas diacríticas (U+0300–U+036F).
- Quita `·` y `.`, y colapsa los espacios.

Ejemplos: `Col·legi` → `collegi`; `què` → `que`. Para el chino no se normaliza nada (solo trim).

## 2. Datos estáticos (`app/public/data/`, los genera `build/`)
Todo es JSON plano en UTF-8 (Cloudflare lo comprime al servirlo).

### `manifest.json`
```json
{ "version": "2026-10-17.1", "counts": {"entries": 6000, "forms": 90000},
  "files": [{"name": "entries.json", "bytes": 123, "sha256": "..."}] }
```
La app vuelve a descargar los datos solo si cambia `version`.

### `entries.json`: `Entry[]`
```ts
type Entry = {
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
```
Si a una palabra le faltan zh, es o en, no se incluye en `entries.json`; esa palabra se pide a `/explain`.

### `index.json`: índices de búsqueda inversa
```ts
type Index = {
  forms: Record<string, [string, string][]>; // norm(forma) → [[entryId, tag]], p. ej. "tinc" → [["tenir","ind.pres.1s"]]
  zh:    Record<string, string[]>;           // palabra china → entryIds
  es:    Record<string, string[]>;           // norm(palabra es) → entryIds
  en:    Record<string, string[]>;           // norm(palabra en) → entryIds
};
```
El lema también aparece en `forms` con la etiqueta `"lemma"`. Para el prefijo (resultados mientras escribe), la app ordena por `freq`.

### `conj.json`: `Record<entryId, Conj>`
```ts
type Conj = Record<Tense, string[]>; // 6 personas: jo, tu, ell/ella/vostè, nosaltres, vosaltres, ells/elles/vostès
type Tense =
  "ind.pres"|"ind.imperf"|"ind.pret"|"ind.fut"|"cond.pres"|
  "ind.perf"|"ind.plusq"|"ind.pret_perif"|"ind.fut_perf"|"cond.perf"|
  "subj.pres"|"subj.imperf"|"subj.perf"|"subj.plusq"|
  "imp"; // imp: 6 posiciones, con "" donde no existe (jo)
// Formas no personales en la clave especial "np": [infinitiu, gerundi, participi_m, participi_f, participi_mpl, participi_fpl]
```
Etiquetas de `index.forms`: `"<tense>.<1s|2s|3s|1p|2p|3p>"`, `"np.ger"`, `"np.part"` y `"lemma"`.

### `febles.json`: guía de pronombres débiles
```ts
type Febles = { sections: { id: string; title_en: string; title_zh: string;
  body_en: string; body_zh: string;              // markdown sencillo
  table?: { head: string[]; rows: string[][] };
  examples: { ca: string; zh: string; en: string }[] }[] };
```

## 3. API del Worker
- URL base: `VITE_API_URL`.
- Todas las peticiones llevan la cabecera `X-Code: <codi>`.
- El código es a la vez la autenticación y el `sync_id`. Formato `XXXX-XXXX-XXXX`, en mayúsculas.
- La lista de códigos válidos está en el secreto `ALLOWED_CODES`, separada por comas.
- La primera vez que ella abre la PWA, si no hay código, sale una pantalla para pegarlo.

| Método y ruta | Cuerpo | Respuesta 200 |
|---|---|---|
| `GET /health` | – | `{ok:true}` (sin código) |
| `POST /explain` | `{word: string, lang: "ca"\|"zh"\|"es"\|"en"}` | `ExplainResponse` |
| `POST /translate` | `{text: string (≤ 500 caracteres), from: "ca"\|"zh"\|"es"\|"en", to: "ca"\|"zh"}` | `TranslateResponse` |
| `GET /sync?since=<ms>` | – | `{cards: Card[], now: number}` (incluye las borradas) |
| `POST /sync` | `{cards: Card[]}` | `{ok: true, now: number}` |

```ts
type ExplainResponse = {
  entry: Omit<Entry, "freq">;   // misma forma que en entries.json; id = "ai:" + norm(ca)
  senses: { zh: string; pinyin: string; en: string; es: string; note_zh?: string }[];
  examples: { ca: string; zh: string }[];  // 2 o 3, nivel A1-A2
  note_en?: string;             // uso, registro, falsos amigos con el español
  cached: boolean;
};
type TranslateResponse = {
  translation: string;          // en el idioma `to`
  pinyin?: string;              // solo si to == "zh"
  words: { src: string; lemma?: string; zh: string; en: string; note?: string }[]; // desglose de la frase original
  cached: boolean;
};
type Card = {
  id: string;                   // entryId o "ai:..."
  front: { ca: string; zh: string; pinyin: string; en: string; es: string; ex?: {ca: string; zh: string} };
  fsrs: unknown;                // Card de ts-fsrs serializado (fechas en ISO), opaco para el Worker
  updated_at: number;           // ms; el Worker guarda la versión con el updated_at mayor (gana la última escritura)
  deleted?: boolean;
};
```

**Errores**: `{error: string}`, con los siguientes estados:
- 400 `bad_request`
- 401 `bad_code`
- 429 `daily_limit` (150 llamadas a Anthropic al día por código; las que salen de la caché no cuentan)
- 502 `upstream`

**CORS**: abierto al origen de la PWA (`ALLOWED_ORIGIN`) y a `http://localhost:5173`.

## 4. Modelo de IA
- Modelo `claude-haiku-5-5`, con `output_config.effort = "low"` y JSON estricto mediante `output_config.format`.
- El prompt de sistema es fijo y lleva `cache_control`.
- `PROMPT_VERSION` forma parte de la clave de caché.
- El build (Batch API) usa el mismo esquema que `ExplainResponse.entry`, más un ejemplo, para que los datos precalculados y los que se piden en vivo tengan la misma forma.
