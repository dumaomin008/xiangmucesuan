import { defineConfig, devices } from "@playwright/test";

const DEMO_PORT = Number(process.env.DEMO_E2E_PORT || 4173);
const REAL_PORT = Number(process.env.DEMO_E2E_REAL_PORT || 4174);
const DEMO_ORIGIN = `http://127.0.0.1:${DEMO_PORT}`;
const REAL_ORIGIN = `http://127.0.0.1:${REAL_PORT}`;

export default defineConfig({
  testDir: "./tests/demo-e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: DEMO_ORIGIN,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    locale: "zh-CN",
  },
  webServer: [
    {
      command: `node demo-frontend-package/server.mjs`,
      url: `${DEMO_ORIGIN}/#/login`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        ...process.env,
        PORT: String(DEMO_PORT),
        HOST: "127.0.0.1",
        DOCUMENT_PARSER_MODE: "demo",
        DEMO_AI_API_KEY: "",
      },
    },
    {
      command: `node demo-frontend-package/server.mjs`,
      url: `${REAL_ORIGIN}/#/login`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        ...process.env,
        PORT: String(REAL_PORT),
        HOST: "127.0.0.1",
        DOCUMENT_PARSER_MODE: "real",
        DEMO_AI_API_KEY: "",
      },
    },
  ],
  projects: [
    {
      name: "demo-e2e",
      testIgnore: "**/real-import.spec.ts",
      use: { ...devices["Desktop Chrome"], baseURL: DEMO_ORIGIN },
    },
    {
      name: "real-import-e2e",
      testMatch: "**/real-import.spec.ts",
      use: { ...devices["Desktop Chrome"], baseURL: REAL_ORIGIN },
    },
  ],
});
