# Plan: «Català ⇄ 中文», diccionario de bolsillo para la novia de Arnau

## Contexto
Ella habla mandarín (lee **chino simplificado**), cantonés, inglés y español a nivel B1. Está aprendiendo catalán en el **A1 gratuito del CPNL**.
Quiere una app tipo 西语助手 (Eshelper), pero solo con lo que necesita de verdad, en su **iPhone**, que se abra en 1 s y sirva en clase,
en la calle (carteles y menús), al hablar y al escuchar. El coste de la IA tiene que ser casi cero.

**Sus respuestas (17/10/2026):**
- Lo necesita en todas las situaciones: clase y deberes, carteles, conversación y escucha.
- Escribe con el teclado pinyin y también en catalán. **Ella elige la dirección** (selector).
- En cada palabra quiere ver: **chino + inglés**, **el equivalente en español**, y **audio + frase de ejemplo**.
- Repaso: **unas pocas tarjetas al día** (tipo Anki).

**Decisiones de Arnau:**
- Es una PWA para iPhone, sin App Store.
- Motor híbrido: diccionario offline más Claude Haiku con caché.
- La clave va en un Cloudflare Worker gratuito.
- Su progreso se **sincroniza en la nube**.
- **Solo texto**: sin voz ni cámara (el dictado del teclado de iOS ya funciona gratis).
- Repo propio en `LIFE_OS/catala_zh/`.

## Arquitectura

```
iPhone (PWA en Safari → «Añadir a pantalla de inicio»)
 ├─ App shell precacheada (service worker): abre en <1 s y funciona sin conexión
 ├─ Diccionario en IndexedDB (~6-10 MB, se carga la primera vez): búsqueda instantánea offline
 ├─ Audio: speechSynthesis de iOS (voz ca-ES y zh-CN), gratis y offline
 └─ fetch ──► Cloudflare Worker (gratis)
               ├─ /explain   palabra que no está o «更多 / More» → Haiku 5.5 → caché KV
               ├─ /translate frase o cartel tecleado → traducción + desglose → caché KV
               └─ /sync      tarjetas y progreso ⇄ D1 (código de sincronización, sin login)
```

### 1. Datos (se construyen una vez en el PC, `catala_zh/build/`, Python `.venv`)
- **Wikcionario (kaikki.org, JSON)**:
  - Entradas catalanas: glosas en inglés, género, plural y **formas flexionadas**. De aquí sale el índice inverso `tinc → tenir (pres. 1s)`.
  - Tablas de traducción del inglés: unen catalán, mandarín y español por acepción (pivote).
- **CC-CEDICT**: chino simplificado + pinyin + inglés, para la dirección 中文 → català (pivote por inglés y español).
- **Frecuencia**: `wordfreq` (ca), las 6.000 palabras más comunes, más el vocabulario A1 del CPNL si aparece.
- **Pulido con IA, una sola vez**: Claude **Haiku 5.5** (`claude-haiku-5-5`, 0,10 $/0,50 $ por M de tokens) por **Batch API (−50 %)** y con salida estructurada en JSON.
  - Para cada una de las 6.000 palabras genera: 中文 + pinyin, inglés, español, ejemplo A1 en catalán con su traducción al chino, y notas de género y verbo.
  - Así se resuelven las ambigüedades del pivote. **Coste estimado: menos de 1 $.**
- **Conjugación**: tablas por verbo (de Wikcionario), agrupadas por modo y con el tiempo simple frente al compuesto.
- **Pronombres débiles**: una guía estática (em, et, es, el, la, els, les, li, ho, en, hi y sus combinaciones) en inglés y chino.
  - La redacta Claude y **Arnau la revisa**, porque habla catalán.
- **Salida**: `dict.json.gz` troceado, con el esquema `Entry {ca, pos, gender, forms[], zh[], pinyin[], en[], es[], ex:{ca,zh}}`, y `inflect.json` (forma → lema).
- **Créditos**: Wikcionario (CC BY-SA) y CC-CEDICT (CC BY-SA), en la pantalla «About».

### 2. PWA (`catala_zh/app/`, Vite + Preact + TypeScript; Node 24 ya instalado)
- **Pantalla Buscar** (la principal, con el cursor en el buscador):
  - Selector **CA → 中文 / 中文 → CA** (con ES y EN opcionales).
  - Resultados mientras escribe. Si busca una forma conjugada, ve el lema y la forma.
- **Ficha de palabra**:
  - La palabra con su género y 🔊.
  - 中文 + pinyin, inglés y español.
  - Un ejemplo A1 en catalán y chino, con 🔊.
  - ☆ para guardarla, botón «Conjugació» si es verbo y botón «更多 / More (AI)».
- **Pantalla Frase**: pega o escribe una frase o un cartel y ve la traducción al chino, más el desglose palabra por palabra (cada palabra se puede tocar).
- **Pantalla Repàs**: FSRS (librería `ts-fsrs`), 10 palabras nuevas al día como máximo, unos 5 minutos. Las tarjetas van de catalán a 中文 y al revés, con audio.
- **Pantalla Gramàtica**: tablas de verbos y la guía de pronombres débiles.
- **Interfaz** en inglés con etiquetas en chino. Fuente grande y modo oscuro.

### 3. Worker (`catala_zh/worker/`, Wrangler)
- **Llamadas a Haiku 5.5** (SDK `@anthropic-ai/sdk`):
  - `effort: "low"`, `max_tokens` ajustado y prompt de sistema fijo con `cache_control`.
  - Salida JSON estricta mediante `output_config.format`.
- **Caché en KV** con la clave `sha256(versión_prompt + endpoint + texto normalizado)`: la misma consulta no se paga dos veces.
- **Protección**:
  - Un token secreto va en la URL de instalación de la PWA.
  - Hay un tope de **150 llamadas al día**, con un contador en KV.
  - La clave de Anthropic se guarda con `wrangler secret`.
- **Coste en vivo**: unos 0,0003 $ por consulta. Con 30 consultas al día salen **menos de 0,30 $ al mes**.
- **Sincronización (D1)**:
  - Tabla `cards(sync_id, word, fsrs_state, updated_at)`.
  - Si cambia la misma tarjeta en dos sitios, gana la última escritura.
  - La app funciona offline y sincroniza al abrirse o al acabar el repaso.

## Ejecución con subagentes
0. **Yo (Opus) congelo los contratos**:
   - El esquema `Entry` y los JSON de la API de `/explain`, `/translate` y `/sync`.
   - Los guardo en `catala_zh/CONTRATOS.md`, junto con este plan en `PLAN.md` (regla de guardar los plannings en el repo).
1. **Tres agentes en paralelo** (`general-purpose`), cada uno en su subcarpeta y con los contratos ya escritos:
   - **A, Datos**: descarga kaikki y CC-CEDICT, hace el pivote, el índice inverso y el batch de Haiku, y deja tests pytest.
     Muestra la barra de progreso con `scripts/progreso.py` durante las descargas y el batch.
   - **B, PWA**: pantallas, service worker, IndexedDB, FSRS y TTS. Mientras no estén los datos reales, usa un `dict` de muestra con 200 palabras.
   - **C, Worker**: endpoints, KV, D1, tope diario y tests con `wrangler dev`.
2. **`haiku-helper`** se encarga del trabajo mecánico: renombrar, leer logs y contar entradas.
3. **Yo integro**:
   - Uno los datos reales con la PWA y la PWA con el Worker.
   - Reviso una muestra de 50 traducciones y repaso la guía de pronombres débiles con Arnau.
4. **Commits** por bloques en el repo `catala_zh` y push a GitHub. Añado una entrada en `perfil/decisiones.md`.

## Pasos de Arnau (los dejaré en `catala_zh/PASOS_ARNAU.md`)
1. En console.anthropic.com, crear una clave de API y cargar 5 $. Esa clave no estaba en mis carpetas: OpenCook usa Gemini, y su `anthropic_api_key` es opcional.
2. Crear una cuenta gratuita en Cloudflare y ejecutar `npx wrangler login` (te pasaré el comando con `!`).
3. Crear el repo en GitHub (ya tienes cuenta) y conectar Cloudflare Pages para que despliegue en cada push.
4. En su iPhone: abrir el enlace en Safari, pulsar Compartir → «Añadir a pantalla de inicio» y ponerla en el dock.

## Verificación
- **pytest de datos**:
  - `tinc` → tenir; `nena` → 女孩.
  - `你好` → hola; `menjar` tiene un ejemplo A1.
  - Al menos el 95 % de las 6.000 palabras tienen 中文 y español.
- **Worker**:
  - La misma consulta dos veces sale de la caché, sin llamar a Anthropic.
  - Al superar el tope diario, devuelve un 429 controlado.
  - La sincronización de ida y vuelta conserva el estado FSRS.
- **PWA**:
  - Lighthouse PWA en verde.
  - **En modo avión** busca palabras y repasa tarjetas.
  - Abre en frío en menos de 1 s en el iPhone.
  - El audio en catalán suena. Si iOS no tiene la voz ca-ES, la descargamos en Ajustes › Accesibilidad.
- **Prueba real**: ella la usa una semana y apuntamos lo que falta en `PLAN.md` para una v2 (quizá voz o cámara).
