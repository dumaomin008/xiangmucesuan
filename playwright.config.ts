import path from "node:path";
import { defineConfig, devices } from "@playwright/test";
import { ACCEPTANCE_ORIGIN, ACCEPTANCE_PORT, acceptanceDatabaseUrl } from "./scripts/init-acceptance-db";

const databaseUrl = acceptanceDatabaseUrl();
process.env.DATABASE_URL = databaseUrl;

export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  forbidOnly: true,
  retries: 0,
  reporter: [
    ["list"],
    ["json", { outputFile: "docs/acceptance-artifacts/playwright.json" }],
    ["html", { open: "never", outputFolder: "docs/acceptance-artifacts/playwright-html" }],
  ],
  globalSetup: require.resolve("./tests/acceptance-global-setup.ts"),
  use: {
    baseURL: ACCEPTANCE_ORIGIN,
    extraHTTPHeaders: {
      "x-demo-role": "MANAGER",
      "x-demo-user": "acceptance-bot",
    },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    locale: "zh-CN",
  },
  webServer: {
    command: `npx next start -p ${ACCEPTANCE_PORT}`,
    url: ACCEPTANCE_ORIGIN,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      PORT: String(ACCEPTANCE_PORT),
    },
  },
  projects: [
    {
      name: "api",
      testDir: "./tests/integration",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "e2e",
      testDir: "./tests/e2e",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["api"],
    },
  ],
  outputDir: path.join("docs", "acceptance-artifacts", "test-results"),
});
