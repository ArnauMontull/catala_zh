import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest(async () => ({
      wrangler: { configPath: "./wrangler.toml" },
      miniflare: {
        bindings: {
          ALLOWED_CODES: "TEST-CODE-AAAA,OTRO-CODE-BBBB",
          ALLOWED_ORIGIN: "https://catala-zh.example",
          DAILY_LIMIT: "3",
          MOCK_AI: "1",
          TEST_MIGRATIONS: await readD1Migrations("./migrations"),
        },
      },
    })),
  ],
});
