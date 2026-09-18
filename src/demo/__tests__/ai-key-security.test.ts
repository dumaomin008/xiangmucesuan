import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { formatAiConfigLog, resolveDocumentAiConfig } from "@/demo/import/real/ai-config";

const root = path.resolve(__dirname, "../../..");
const skipDir = new Set(["node_modules", ".git", ".next", "out", "playwright-report", "test-results", "docs"]);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (skipDir.has(name)) continue;
    if (name === ".env" || (name.startsWith(".env.") && name !== ".env.example")) continue;
    const full = path.join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|js|mjs|json|md|css|html|env|example)$/.test(name) && stat.size < 1_500_000) out.push(full);
  }
  return out;
}

describe("AI Key 安全", () => {
  it("配置只来自环境变量，日志不含 Key", () => {
    const config = resolveDocumentAiConfig({
      AI_PROVIDER: "deepseek",
      AI_API_KEY: "sk-should-not-print",
      AI_BASE_URL: "https://api.deepseek.com",
      AI_MODEL: "deepseek-flash",
    } as NodeJS.ProcessEnv);
    const lines = formatAiConfigLog(config).join("\n");
    expect(lines).toContain("AI Provider: deepseek");
    expect(lines).toContain("AI Model: deepseek-flash");
    expect(lines).toContain("AI Configured: true");
    expect(lines).not.toContain("sk-should-not-print");
    expect(lines).not.toContain("Authorization");
  });

  it("未设置 AI_MODEL 时不算已配置，且不猜测模型名", () => {
    const config = resolveDocumentAiConfig({
      AI_PROVIDER: "deepseek",
      AI_API_KEY: "sk-should-not-print",
      AI_BASE_URL: "https://api.deepseek.com",
    } as NodeJS.ProcessEnv);
    expect(config.model).toBe("");
    expect(config.configured).toBe(false);
    expect(JSON.stringify(config)).not.toContain("deepseek-flash");
    expect(JSON.stringify(config)).not.toContain("gpt-4o-mini");
  });

  it("仓库与前端包不包含真实 Key，浏览器不直连 DeepSeek", () => {
    const gitignore = readFileSync(path.join(root, ".gitignore"), "utf8");
    expect(gitignore).toMatch(/^\.env$/m);
    expect(gitignore).toContain(".env.local");
    const demoIgnore = readFileSync(path.join(root, "demo-frontend-package/.gitignore"), "utf8");
    expect(demoIgnore).toContain(".env");

    const keyRe = /sk-[A-Za-z0-9]{20,}/;
    const hits = walk(root).filter((file) => keyRe.test(readFileSync(file, "utf8")));
    expect(hits).toEqual([]);

    const browserFiles = ["import-app.js", "calculation-app.js", "lib/pm-calc.bundle.js", "index.html"];
    for (const name of browserFiles) {
      const text = readFileSync(path.join(root, "demo-frontend-package", name), "utf8");
      expect(text).not.toContain("api.deepseek.com");
      expect(text).not.toMatch(keyRe);
    }
    const server = readFileSync(path.join(root, "demo-frontend-package/server.mjs"), "utf8");
    expect(server).not.toMatch(/console\.log\([^)]*apiKey/);
    expect(server).not.toMatch(/console\.log\([^)]*Authorization/);
  });
});
