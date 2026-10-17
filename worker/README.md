# Worker de «Català ⇄ 中文»

Proxy en Cloudflare Workers que:
- guarda la clave de Anthropic (nunca llega al iPhone),
- llama a Claude Haiku 5.5 (`/explain`, `/translate`) y cachea las respuestas en KV,
- limita a 150 llamadas reales al día por código,
- sincroniza las tarjetas de repaso en D1 (`/sync`, gana la última escritura).

API exacta en `../CONTRATOS.md` §3.

## Archivos
| Archivo | Qué hace |
|---|---|
| `src/index.ts` | Router, auth `X-Code`, CORS, validación, caché KV y contador diario |
| `src/ai.ts` | Prompt de sistema, llamada al SDK y respuestas fijas con `MOCK_AI=1` |
| `src/schemas.ts` | Esquemas JSON de salida y validación mínima |
| `src/sync.ts` | Lectura y upsert de tarjetas en D1 |
| `src/types.ts` | Tipos copiados del contrato |
| `migrations/0001_init.sql` | Tabla `cards` |
| `test/worker.test.ts` | Tests (vitest dentro del runtime de Workers) |

## Probar en local (sin clave)
```bash
cd catala_zh/worker
npm install
npm test                       # 13 tests, con MOCK_AI=1
cp .dev.vars.example .dev.vars # deja MOCK_AI=1 y pon un código en ALLOWED_CODES
npm run db:migrate:local       # crea la tabla en el D1 local (.wrangler/)
npm run dev                    # http://127.0.0.1:8787
curl http://127.0.0.1:8787/health
curl -X POST http://127.0.0.1:8787/explain -H "X-Code: ABCD-EFGH-JKLM" -H "Content-Type: application/json" -d "{\"word\":\"nen\",\"lang\":\"ca\"}"
```

## Desplegar (Arnau, una sola vez)
Todo desde `catala_zh/worker`. Usa siempre `npx` (wrangler está instalado en local).

1. **Iniciar sesión en Cloudflare** (abre el navegador):
   ```bash
   npx wrangler login
   ```
2. **Crear el KV** y copiar el `id` que imprime en `wrangler.toml` (bloque `[[kv_namespaces]]`):
   ```bash
   npx wrangler kv namespace create CACHE
   ```
3. **Crear la base de datos D1** y copiar el `database_id` en `wrangler.toml` (bloque `[[d1_databases]]`):
   ```bash
   npx wrangler d1 create catala_zh
   ```
4. **Aplicar la migración** en la base remota:
   ```bash
   npx wrangler d1 migrations apply catala_zh --remote
   ```
5. **Poner la URL de la PWA** en `wrangler.toml` → `[vars]` → `ALLOWED_ORIGIN` (p. ej. `https://catala-zh.pages.dev`, sin barra final). Deja `MOCK_AI = "0"`.
6. **Generar el código de ella** (y otro para ti, si quieres):
   ```bash
   npm run gen-code -- 2
   ```
7. **Guardar los secretos** (cada comando pide el valor; no se guardan en ningún archivo):
   ```bash
   npx wrangler secret put ANTHROPIC_API_KEY   # la clave de console.anthropic.com
   npx wrangler secret put ALLOWED_CODES       # los códigos del paso 6, separados por comas
   ```
8. **Desplegar**:
   ```bash
   npx wrangler deploy
   ```
   Imprime la URL (`https://catala-zh-api.<tu-subdominio>.workers.dev`): esa es la `VITE_API_URL` de la app.
9. **Comprobar**:
   ```bash
   curl https://catala-zh-api.<tu-subdominio>.workers.dev/health
   ```

### Después
- Ver logs en vivo: `npx wrangler tail`.
- Añadir o quitar un código: vuelve a ejecutar `npx wrangler secret put ALLOWED_CODES` con la lista completa.
- Cambiar el límite diario: `DAILY_LIMIT` en `wrangler.toml` y `npx wrangler deploy`.
- Si cambias el prompt o los esquemas, sube `PROMPT_VERSION` en `src/ai.ts` (invalida la caché vieja).

## Detalles
- **Caché**: clave `sha256(PROMPT_VERSION + endpoint + JSON normalizado)`, con `norm()` del contrato aplicado a `word`/`text`
  (el chino solo se recorta). `/explain` no caduca y `/translate` caduca a los 30 días. Lo que sale de la caché lleva `cached: true` y no cuenta para el límite.
- **Límite**: `count:<código>:<AAAA-MM-DD>` (UTC) en KV, TTL 2 días. Se cuenta antes de llamar a Anthropic.
- **Códigos**: se comparan en mayúsculas y en tiempo constante (sha256 + `timingSafeEqual`).
- **Errores**: `400 bad_request`, `401 bad_code`, `429 daily_limit`, `502 upstream`; además `404 not_found`, `405 method_not_allowed` y `500 internal`.
