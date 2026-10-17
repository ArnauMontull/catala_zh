import { applyD1Migrations } from "cloudflare:test";
import { env, exports } from "cloudflare:workers";
import { beforeAll, describe, expect, it } from "vitest";

const CODE = "TEST-CODE-AAAA";
const BASE = "https://worker.test";

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

function call(path: string, init: RequestInit & { code?: string | null } = {}) {
  const headers = new Headers(init.headers);
  if (init.code !== null) headers.set("X-Code", init.code ?? CODE);
  if (init.body) headers.set("Content-Type", "application/json");
  return exports.default.fetch(new Request(BASE + path, { ...init, headers }));
}
const post = (path: string, body: unknown, code?: string | null) =>
  call(path, { method: "POST", body: JSON.stringify(body), code });

const today = () => new Date().toISOString().slice(0, 10);
const counter = async (code = CODE) => Number((await env.CACHE.get(`count:${code}:${today()}`)) ?? "0");

describe("auth y salud", () => {
  it("GET /health sin código → 200 {ok:true}", async () => {
    const r = await call("/health", { code: null });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true });
  });

  it("sin código → 401 bad_code", async () => {
    const r = await post("/explain", { word: "nen", lang: "ca" }, null);
    expect(r.status).toBe(401);
    expect(await r.json()).toEqual({ error: "bad_code" });
  });

  it("código incorrecto → 401; en minúsculas se acepta", async () => {
    expect((await call("/sync?since=0", { code: "XXXX-XXXX-XXXX" })).status).toBe(401);
    expect((await call("/sync?since=0", { code: "test-code-aaaa" })).status).toBe(200);
  });
});

describe("/explain con MOCK_AI y caché", () => {
  it("1ª vez cached:false, 2ª cached:true sin subir el contador", async () => {
    const before = await counter();
    const r1 = await post("/explain", { word: "Col·legi", lang: "ca" });
    expect(r1.status).toBe(200);
    const b1: any = await r1.json();
    expect(b1.cached).toBe(false);
    expect(b1.entry.id).toBe("ai:collegi");
    expect(b1.senses.length).toBeGreaterThan(0);
    expect(await counter()).toBe(before + 1);

    // Misma clave tras norm(): mayúsculas, punt volat y espacios.
    const r2 = await post("/explain", { word: "  COL·LEGI ", lang: "ca" });
    const b2: any = await r2.json();
    expect(b2.cached).toBe(true);
    expect(b2.entry).toEqual(b1.entry);
    expect(await counter()).toBe(before + 1);
  });

  it("lang fuera del enum o word > 60 → 400", async () => {
    expect((await post("/explain", { word: "nen", lang: "fr" })).status).toBe(400);
    expect((await post("/explain", { word: "a".repeat(61), lang: "ca" })).status).toBe(400);
  });
});

describe("límite diario", () => {
  it("al pasar DAILY_LIMIT (3 en tests) → 429 daily_limit; la caché sigue funcionando", async () => {
    const code = "OTRO-CODE-BBBB";
    for (let i = 0; i < 3; i++) {
      const r = await post("/explain", { word: `paraula${i}`, lang: "ca" }, code);
      expect(r.status).toBe(200);
    }
    const r = await post("/explain", { word: "paraula-nova", lang: "ca" }, code);
    expect(r.status).toBe(429);
    expect(await r.json()).toEqual({ error: "daily_limit" });
    expect(await counter(code)).toBe(3);

    const cachedHit = await post("/explain", { word: "paraula0", lang: "ca" }, code);
    expect(cachedHit.status).toBe(200);
    expect(((await cachedHit.json()) as any).cached).toBe(true);
  });
});

describe("/translate", () => {
  it("text de 600 caracteres → 400 bad_request", async () => {
    const r = await post("/translate", { text: "a".repeat(600), from: "ca", to: "zh" });
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ error: "bad_request" });
  });

  it("to fuera de ca|zh → 400; válido → 200 con pinyin si to=zh", async () => {
    expect((await post("/translate", { text: "hola", from: "ca", to: "es" })).status).toBe(400);
    const r = await post("/translate", { text: "Hola, com estàs?", from: "ca", to: "zh" });
    expect(r.status).toBe(200);
    const b: any = await r.json();
    expect(b.cached).toBe(false);
    expect(typeof b.translation).toBe("string");
    expect(typeof b.pinyin).toBe("string");
    expect(Array.isArray(b.words)).toBe(true);
  });
});

describe("/sync", () => {
  const front = { ca: "nen", zh: "孩子", pinyin: "hái zi", en: "child", es: "niño" };

  it("ida y vuelta, gana la última escritura y el borrado se propaga", async () => {
    const t0 = 1_700_000_000_000;
    let r = await post("/sync", {
      cards: [
        { id: "nen", front, fsrs: { due: "2026-10-18T00:00:00.000Z", reps: 1 }, updated_at: t0 },
        { id: "ai:collegi", front: { ...front, ca: "col·legi" }, fsrs: { reps: 0 }, updated_at: t0 },
      ],
    });
    expect(r.status).toBe(200);
    const p: any = await r.json();
    expect(p.ok).toBe(true);
    expect(typeof p.now).toBe("number");

    // Escritura más nueva gana; una más vieja se ignora.
    await post("/sync", { cards: [{ id: "nen", front, fsrs: { reps: 2 }, updated_at: t0 + 10 }] });
    await post("/sync", { cards: [{ id: "nen", front, fsrs: { reps: 99 }, updated_at: t0 + 5 }] });
    // Borrado.
    await post("/sync", { cards: [{ id: "ai:collegi", front, fsrs: null, updated_at: t0 + 20, deleted: true }] });

    r = await call(`/sync?since=${t0 - 1}`);
    const g: any = await r.json();
    const byId = Object.fromEntries(g.cards.map((c: any) => [c.id, c]));
    expect(byId["nen"].fsrs).toEqual({ reps: 2 });
    expect(byId["nen"].updated_at).toBe(t0 + 10);
    expect(byId["nen"].deleted).toBeUndefined();
    expect(byId["ai:collegi"].deleted).toBe(true);
    expect(typeof g.now).toBe("number");

    // since filtra; otro código no ve estas tarjetas.
    const g2: any = await (await call(`/sync?since=${t0 + 15}`)).json();
    expect(g2.cards.map((c: any) => c.id)).toEqual(["ai:collegi"]);
    const g3: any = await (await call(`/sync?since=0`, { code: "OTRO-CODE-BBBB" })).json();
    expect(g3.cards).toEqual([]);
  });

  it("más de 500 tarjetas o since inválido → 400", async () => {
    const cards = Array.from({ length: 501 }, (_, i) => ({ id: `w${i}`, front, fsrs: {}, updated_at: 1 }));
    expect((await post("/sync", { cards })).status).toBe(400);
    expect((await call("/sync?since=abc")).status).toBe(400);
  });
});

describe("CORS", () => {
  it("OPTIONS desde el origen permitido y localhost → 204 con cabeceras", async () => {
    for (const origin of ["https://catala-zh.example", "http://localhost:5173", "http://localhost:4173"]) {
      const r = await call("/explain", {
        method: "OPTIONS",
        code: null,
        headers: { Origin: origin, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "x-code" },
      });
      expect(r.status).toBe(204);
      expect(r.headers.get("Access-Control-Allow-Origin")).toBe(origin);
      expect(r.headers.get("Access-Control-Allow-Headers")).toContain("X-Code");
      expect(r.headers.get("Access-Control-Allow-Methods")).toContain("POST");
    }
  });

  it("origen no permitido → sin Access-Control-Allow-Origin", async () => {
    const r = await call("/explain", { method: "OPTIONS", code: null, headers: { Origin: "https://evil.example" } });
    expect(r.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("las respuestas normales (también errores) llevan CORS", async () => {
    const r = await call("/explain", { method: "POST", code: null, headers: { Origin: "http://localhost:5173" } });
    expect(r.status).toBe(401);
    expect(r.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:5173");
  });
});
