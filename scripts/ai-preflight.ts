/**
 * 演示前 AI 自检。只打印 PASS / FAIL 与原因，禁止输出 API Key。
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { calculateProject } from "../src/calculation";
import { profitableInput } from "../src/demo/seed/inputs";
import { resolveDocumentAiConfig } from "../src/demo/import/real/ai-config";
import {
  AI_CHAT_TIMEOUT_MS,
  explainSuccess,
  probeAiHealth,
  redactAiText,
  runAiProxy,
} from "../demo-frontend-package/lib/ai-resilience.mjs";

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

const results: { name: string; ok: boolean; reason: string }[] = [];

function record(name: string, ok: boolean, reason: string) {
  const safe = redactAiText(reason);
  results.push({ name, ok, reason: safe });
  console.log(`[${ok ? "PASS" : "FAIL"}] ${name}${safe ? ` — ${safe}` : ""}`);
}

async function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const server = readFileSync(path.join(root, "demo-frontend-package/server.mjs"), "utf8");
  const proxyOk = server.includes("runAiProxy") && server.includes("/api/ai/health") && server.includes("AI_CHAT_TIMEOUT_MS");
  record("AI Proxy", proxyOk, proxyOk ? "explain/intent/health 已挂载" : "演示服务未挂载 AI 代理或健康检查");

  const config = resolveDocumentAiConfig();
  record("DeepSeek API Key", config.configured, config.configured ? `provider=${config.provider} model=${config.model}` : "未配置");

  if (!config.configured) {
    record("DeepSeek 网络可达", false, "未配置，无法探测");
    record("DeepSeek 最小请求", false, "未配置，无法请求");
  } else {
    const health = await probeAiHealth({
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      model: config.model,
      provider: config.provider,
    });
    const leaked = JSON.stringify(health).includes(config.apiKey);
    record(
      "DeepSeek 网络可达",
      !leaked && health.reachable === true && health.status !== "unreachable" && health.status !== "not_configured",
      leaked ? "健康检查返回了密钥" : `status=${health.status} reachable=${health.reachable}`,
    );

    const minimal = await runAiProxy({
      kind: "explain",
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      model: config.model,
      system: "只回复 OK，不要输出其他内容。",
      user: "ping",
      timeoutMs: AI_CHAT_TIMEOUT_MS,
      log: (line: string) => console.error(redactAiText(line)),
    });
    const text = "text" in minimal.body ? String(minimal.body.text || "") : "";
    const textLeak = text.includes(config.apiKey);
    record(
      "DeepSeek 最小请求",
      !textLeak && minimal.diag === "ok" && Boolean(text) && minimal.body?.fallback !== true,
      textLeak ? "响应包含密钥" : `diag=${minimal.diag}`,
    );
  }

  try {
    const output = calculateProject(profitableInput());
    const profit = output.monthlyProfit.toString();
    record("Calculation Engine", /^-?\d/.test(profit), `monthlyProfit=${profit}`);
  } catch (error) {
    record("Calculation Engine", false, error instanceof Error ? error.name : "engine_failed");
  }

  const modes: Array<{ name: string; fetchImpl: () => Promise<{ ok: boolean; status: number; json: () => Promise<unknown>; text: () => Promise<string> }> | never }> = [
    {
      name: "401",
      fetchImpl: async () => ({ ok: false, status: 401, json: async () => ({}), text: async () => "" }),
    },
    {
      name: "500",
      fetchImpl: async () => ({ ok: false, status: 500, json: async () => ({}), text: async () => "" }),
    },
    {
      name: "invalid-json",
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        json: async () => {
          throw new SyntaxError("Unexpected token");
        },
        text: async () => "{",
      }),
    },
  ];
  const shape = Object.keys(explainSuccess("x", "m")).sort().join(",");
  let fallbackOk = true;
  let fallbackReason = "结构与成功调用兼容";
  for (const mode of modes) {
    const result = await runAiProxy({
      kind: "explain",
      apiKey: "configured-for-drill",
      baseUrl: "https://api.deepseek.com",
      model: config.model || "drill-model",
      system: "s",
      user: "u",
      timeoutMs: 200,
      fetchImpl: mode.fetchImpl as unknown as typeof fetch,
      log: () => undefined,
    });
    const keys = Object.keys(result.body).sort().join(",");
    if (!result.body.fallback || !result.body.ok || keys !== shape || /monthlyProfit|irr/i.test(JSON.stringify(result.body))) {
      fallbackOk = false;
      fallbackReason = `${mode.name} 未降级或结构不兼容`;
      break;
    }
  }
  const abort = await runAiProxy({
    kind: "explain",
    apiKey: "configured-for-drill",
    baseUrl: "https://api.deepseek.com",
    model: "drill-model",
    system: "s",
    user: "u",
    timeoutMs: 30,
    fetchImpl: (() => new Promise(() => undefined)) as unknown as typeof fetch,
    log: () => undefined,
  });
  if (abort.diag !== "timeout" || abort.body.fallback !== true) {
    fallbackOk = false;
    fallbackReason = "超时未立即降级";
  }
  record("fallback", fallbackOk, fallbackReason);

  const failed = results.filter((item) => !item.ok);
  console.log(failed.length ? "OVERALL: FAIL" : "OVERALL: PASS");
  process.exit(failed.length ? 1 : 0);
}

main().catch((error) => {
  console.error(`[FAIL] preflight — ${redactAiText(error instanceof Error ? error.name : "error")}`);
  console.log("OVERALL: FAIL");
  process.exit(1);
});
