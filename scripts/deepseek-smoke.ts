/**
 * 真实 DeepSeek 冒烟。缺 Key 时明确 SKIPPED，不能记为 PASS。
 * 不进入 npm test。
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DeepSeekDocumentExtractor, redactSecrets } from "../src/demo/import/real/ai-provider";
import { resolveDocumentAiConfig } from "../src/demo/import/real/ai-config";
import { mergeRuleAndLlm } from "../src/demo/import/real/merger";
import { DeterministicContentExtractor } from "../src/demo/import/real/extractor";
import { PARAMETER_REGISTRY } from "../src/demo/import/real/registry";
import type { DocumentChunk } from "../src/demo/import/real/chunks";

function loadLocalEnv() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  for (const rel of [".env", ".env.local", "demo-frontend-package/.env", "demo-frontend-package/.env.local"]) {
    const envPath = path.join(root, rel);
    if (!existsSync(envPath)) continue;
    for (const line of readFileSync(envPath, "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx <= 0) continue;
      const key = trimmed.slice(0, idx).trim();
      const value = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, "");
      if (!(key in process.env)) process.env[key] = value;
    }
  }
}

loadLocalEnv();

const config = resolveDocumentAiConfig();
if (!config.configured) {
  console.log("SKIPPED: AI_API_KEY not configured");
  process.exit(0);
}

const chunk: DocumentChunk = {
  id: "smoke-1",
  fileId: "smoke",
  fileName: "smoke.txt",
  documentType: "docx",
  text: "本项目首批计划投入30辆新能源牵引车，后续根据货量增加至35辆。",
  location: { paragraph: 1 },
};

const fields = PARAMETER_REGISTRY.map((item) => ({ field: item.field, label: item.label, aliases: item.aliases }));
const extractor = new DeepSeekDocumentExtractor(config);
const remote = await extractor.extract({ chunks: [chunk], fields });
const rule = await new DeterministicContentExtractor().extract({ chunks: [chunk], fields });
const merged = mergeRuleAndLlm(rule.items, remote.items, [chunk]);
const fleet = merged.items.filter((item) => item.field === "fleetSize");
const values = fleet.map((item) => Number(item.normalizedValue)).filter((n) => Number.isFinite(n));
const usage = remote.usage;

console.log("DeepSeek Smoke");
console.log(`AI Provider: ${config.provider}`);
console.log(`AI Model: ${config.model}`);
console.log(`AI Configured: true`);
console.log(`HTTP/JSON degraded: ${Boolean(remote.degraded)}`);
console.log(`fleet candidates: ${values.join(",") || "(none)"}`);
console.log(`rejected sample: ${merged.rejected.slice(0, 6).join(",") || "(none)"}`);
console.log(
  `usage prompt=${usage?.promptTokens ?? 0} completion=${usage?.completionTokens ?? 0} total=${usage?.totalTokens ?? 0} requests=${usage?.requests ?? 0} failures=${usage?.failures ?? 0}`,
);

const leaked = redactSecrets(JSON.stringify({ values, rejected: merged.rejected, usage }));
if (/sk-[A-Za-z0-9]{8,}/.test(leaked)) {
  console.error("SMOKE FAILED: output contained a key");
  process.exit(1);
}
if (remote.degraded && remote.items.length === 0) {
  console.error("SMOKE FAILED: DeepSeek 没有返回可校验 JSON");
  process.exit(1);
}
if (values.length === 1 && values[0] === 35) {
  console.error("SMOKE FAILED: 静默采用了规划值 35");
  process.exit(1);
}
const blocked = remote.items.some((item) => item.field === "monthlyProfit" || item.field === "irr");
if (blocked) {
  console.error("SMOKE FAILED: 模型结果越过字段白名单");
  process.exit(1);
}
console.log("SMOKE OK");
