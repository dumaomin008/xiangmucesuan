import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";
import { AI_CHAT_TIMEOUT_MS as chatFromTs, AI_DOCUMENT_TIMEOUT_MS as documentFromTs } from "@/demo/ai/timeouts";
import {
  AI_CHAT_TIMEOUT_MS,
  AI_DOCUMENT_TIMEOUT_MS,
  explainSuccess,
  probeAiHealth,
  redactAiText,
  runAiProxy,
} from "../../../demo-frontend-package/lib/ai-resilience.mjs";

const root = path.resolve(__dirname, "../../..");
const secret = `sk-${"a".repeat(24)}`;

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
  };
}

function chatFetch(content: string, status = 200) {
  return async () => jsonResponse(status, { choices: [{ message: { content } }] });
}

describe("AI 高可用", () => {
  it("对话与资料解析使用不同超时，且对话不会等到 45 秒", () => {
    expect(AI_CHAT_TIMEOUT_MS).toBe(chatFromTs);
    expect(AI_DOCUMENT_TIMEOUT_MS).toBe(documentFromTs);
    expect(AI_CHAT_TIMEOUT_MS).toBeGreaterThanOrEqual(8000);
    expect(AI_CHAT_TIMEOUT_MS).toBeLessThanOrEqual(10000);
    expect(AI_DOCUMENT_TIMEOUT_MS).toBeGreaterThanOrEqual(20000);
    expect(AI_DOCUMENT_TIMEOUT_MS).toBeLessThanOrEqual(30000);
    expect(AI_CHAT_TIMEOUT_MS).not.toBe(AI_DOCUMENT_TIMEOUT_MS);

    const calc = fs.readFileSync(path.join(root, "demo-frontend-package/calculation-app.js"), "utf8");
    const gateway = fs.readFileSync(path.join(root, "src/lib/ai/services/llm-gateway.ts"), "utf8");
    const provider = fs.readFileSync(path.join(root, "src/lib/ai/providers/openai-compatible.ts"), "utf8");
    const extractor = fs.readFileSync(path.join(root, "src/demo/import/real/ai-provider.ts"), "utf8");
    const importer = fs.readFileSync(path.join(root, "demo-frontend-package/import-app.js"), "utf8");
    expect(calc).toContain("const AI_CHAT_TIMEOUT_MS = 9000");
    expect(calc).not.toContain("45000");
    expect(gateway).not.toContain("45000");
    expect(provider).not.toContain("45000");
    expect(extractor).toContain("const TIMEOUT_MS = 25_000");
    expect(importer).toContain("正在解析资料");
    expect(calc).not.toContain("AI代理调用失败");
    expect(calc).not.toContain("DeepSeek调用失败");
    expect(calc).not.toContain("ENOTFOUND");
  });

  it("健康检查区分未配置、不可达、认证失败和正常，且不返回 Key", async () => {
    const missing = await probeAiHealth({
      apiKey: "",
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-flash",
      provider: "deepseek",
      fetchImpl: async () => {
        throw new Error("should not fetch");
      },
    });
    expect(missing).toEqual({
      configured: false,
      provider: "deepseek",
      model: "deepseek-flash",
      reachable: false,
      status: "not_configured",
    });

    const down = await probeAiHealth({
      apiKey: secret,
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-flash",
      provider: "deepseek",
      fetchImpl: async () => {
        throw Object.assign(new Error(`getaddrinfo ENOTFOUND api.deepseek.com ${secret}`), { code: "ENOTFOUND" });
      },
    });
    expect(down.status).toBe("unreachable");
    expect(down.reachable).toBe(false);
    expect(down.configured).toBe(true);

    const denied = await probeAiHealth({
      apiKey: secret,
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-flash",
      provider: "deepseek",
      fetchImpl: async () => jsonResponse(401, { error: secret }),
    });
    expect(denied.status).toBe("auth_failed");
    expect(denied.reachable).toBe(true);

    const ok = await probeAiHealth({
      apiKey: secret,
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-flash",
      provider: "deepseek",
      fetchImpl: async () => jsonResponse(200, { data: [{ id: "deepseek-flash" }] }),
    });
    expect(ok).toMatchObject({ configured: true, provider: "deepseek", model: "deepseek-flash", reachable: true, status: "healthy" });
    expect(JSON.stringify({ missing, down, denied, ok })).not.toContain(secret);
    expect(Object.keys(ok).sort()).toEqual(["configured", "model", "provider", "reachable", "status"]);
  });

  it("对话超时立即 fallback，且日志不出现 Key", async () => {
    const logs: string[] = [];
    const started = Date.now();
    const result = await runAiProxy({
      kind: "explain",
      apiKey: secret,
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-flash",
      system: "s",
      user: "u",
      timeoutMs: 40,
      fetchImpl: () => new Promise(() => undefined),
      log: (line: string) => logs.push(line),
    });
    expect(Date.now() - started).toBeLessThan(1500);
    expect(result.diag).toBe("timeout");
    expect(result.body.fallback).toBe(true);
    expect("label" in result.body && result.body.label).toBe("本地智能分析");
    expect(logs.join("\n")).not.toContain(secret);
    expect(redactAiText(`Bearer ${secret}`)).not.toContain(secret);
  });
});

describe("AI 故障演练不阻断测算", () => {
  const code = fs.readFileSync(path.join(root, "demo-frontend-package/lib/pm-calc.bundle.js"), "utf8");

  function engine() {
    const store = new Map<string, string>();
    const localStorage = {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
    };
    const sandbox: Record<string, unknown> = { window: {}, localStorage, console, setTimeout, clearTimeout };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(code, sandbox, { filename: "pm-calc.bundle.js" });
    const PmCalc = (sandbox as { PmCalc?: Record<string, unknown> }).PmCalc as {
      ensureRepos: () => void;
      createDefaultInput: () => { routes: { segments: { electricityPrice: string }[] }[] };
      calculateProject: (input: unknown) => { monthlyProfit: { toString: () => string } };
    };
    PmCalc.ensureRepos();
    return PmCalc;
  }

  async function drill(name: string, fetchImpl: typeof fetch) {
    const logs: string[] = [];
    const result = await runAiProxy({
      kind: "explain",
      apiKey: secret,
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-flash",
      system: "只解释，不要计算",
      user: "解读",
      timeoutMs: 200,
      fetchImpl,
      log: (line: string) => logs.push(String(line)),
    });
    const successShape = explainSuccess("样例", "deepseek-flash");
    expect(Object.keys(result.body).sort(), name).toEqual(Object.keys(successShape).sort());
    expect(result.body.ok, name).toBe(true);
    expect(JSON.stringify(result.body), name).not.toMatch(/monthlyProfit|monthlyRevenue|"irr"|profitMargin/);
    expect(logs.join("\n"), name).not.toContain(secret);

    const api = engine();
    const input = api.createDefaultInput();
    input.routes[0].segments[0].electricityPrice = "0.66";
    const first = api.calculateProject(input);
    const second = api.calculateProject(input);
    expect(first.monthlyProfit.toString(), name).toMatch(/^-?\d/);
    expect(second.monthlyProfit.toString(), name).toBe(first.monthlyProfit.toString());
    return result;
  }

  it("A DeepSeek 正常时解读结构兼容，测算数字仍来自引擎", async () => {
    const result = await drill("A", chatFetch("结论：请查看引擎结果。风险：电价。建议：复核合同。") as unknown as typeof fetch);
    expect(result.body.fallback).toBe(false);
    expect("label" in result.body && result.body.label).toBe("AI智能分析");
    expect("text" in result.body && result.body.text).toContain("引擎结果");
  });

  it("B API Key 错误", async () => {
    const result = await drill("B", (async () => jsonResponse(401, { error: { message: secret } })) as unknown as typeof fetch);
    expect(result.diag).toBe("auth_failed");
    expect(result.body.fallback).toBe(true);
  });

  it("C 网络断开", async () => {
    const result = await drill(
      "C",
      (async () => {
        throw Object.assign(new TypeError("Failed to fetch"), { code: "ENOTFOUND" });
      }) as unknown as typeof fetch,
    );
    expect(result.diag).toBe("network");
    expect(result.body.source).toBe("local_analysis");
  });

  it("D 请求超时", async () => {
    const result = await drill(
      "D",
      (() => new Promise(() => undefined)) as unknown as typeof fetch,
    );
    expect(result.diag).toBe("timeout");
  });

  it("E DeepSeek 返回 500", async () => {
    const result = await drill("E", (async () => jsonResponse(500, { error: "boom" })) as unknown as typeof fetch);
    expect(result.diag).toBe("upstream_5xx");
    expect(result.body.fallback).toBe(true);
  });

  it("F 非法 JSON 与空内容", async () => {
    const bad = await drill(
      "F-json",
      (async () => ({
        ok: true,
        status: 200,
        json: async () => {
          throw new SyntaxError("Unexpected token");
        },
        text: async () => "not-json",
      })) as unknown as typeof fetch,
    );
    expect(bad.diag).toBe("invalid_json");
    const empty = await drill("F-empty", chatFetch("   ") as unknown as typeof fetch);
    expect(empty.diag).toBe("empty_content");
    expect("text" in empty.body && empty.body.text).toBe("");
  });

  it("402 与 429 同样降级且不生成财务指标", async () => {
    const pay = await drill("402", (async () => jsonResponse(402, {})) as unknown as typeof fetch);
    const rate = await drill("429", (async () => jsonResponse(429, {})) as unknown as typeof fetch);
    expect(pay.diag).toBe("payment_required");
    expect(rate.diag).toBe("rate_limited");
    expect(pay.body.fallback).toBe(true);
    expect(rate.body.fallback).toBe(true);
  });
});
