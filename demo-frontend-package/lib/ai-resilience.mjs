/**
 * 演示用 AI 高可用：分场景超时、失败分类、兼容 fallback、健康检查。
 * 禁止把 API Key 放进返回体或日志。
 */

export const AI_CHAT_TIMEOUT_MS = 9000;
export const AI_DOCUMENT_TIMEOUT_MS = 25000;
export const AI_HEALTH_TIMEOUT_MS = 5000;
export const AI_USER_READY = "AI 服务正常";
export const AI_USER_FALLBACK = "AI 深度分析暂不可用，测算功能不受影响";

function withUserMessage(body) {
  const ready = body.status === "healthy" && body.configured === true && body.reachable === true;
  return { ...body, userMessage: ready ? AI_USER_READY : AI_USER_FALLBACK };
}

export function redactAiText(value) {
  return String(value ?? "")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/sk-[A-Za-z0-9_-]{8,}/g, "[redacted]");
}

export function classifyAiFailure(input = {}) {
  if (input.reason === "invalid_json") return { code: "invalid_json", detail: "invalid_json" };
  if (input.reason === "empty") return { code: "empty_content", detail: "empty_content" };

  const error = input.error;
  const status = input.status;
  const name = error && typeof error === "object" && "name" in error ? String(error.name) : "";
  const message = error && typeof error === "object" && "message" in error ? String(error.message) : "";
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  const blob = `${name} ${code} ${message}`;

  if (name === "AbortError" || /AbortError|\baborted\b/i.test(blob)) {
    return { code: "timeout", detail: "aborted" };
  }
  if (/ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ECONNRESET|ENETUNREACH|EHOSTUNREACH|Failed to fetch|fetch failed|getaddrinfo/i.test(blob)) {
    return { code: "network", detail: "network" };
  }
  if (status === 401 || status === 403) return { code: "auth_failed", detail: `http_${status}` };
  if (status === 402) return { code: "payment_required", detail: "http_402" };
  if (status === 429) return { code: "rate_limited", detail: "http_429" };
  if (typeof status === "number" && status >= 500) return { code: "upstream_5xx", detail: `http_${status}` };
  if (typeof status === "number" && status >= 400) return { code: "upstream_http", detail: `http_${status}` };
  return { code: "unknown", detail: "unknown" };
}

export function explainSuccess(text, model) {
  return {
    ok: true,
    source: "remote_llm",
    fallback: false,
    text,
    model: model || null,
    label: "AI智能分析",
  };
}

export function explainFallback() {
  return {
    ok: true,
    source: "local_analysis",
    fallback: true,
    text: "",
    model: null,
    label: "本地智能分析",
  };
}

export function intentSuccess(intent, model) {
  return {
    ok: true,
    source: "remote_llm_intent",
    fallback: false,
    intent,
    model: model || null,
  };
}

export function intentFallback() {
  return {
    ok: true,
    source: "local_rules",
    fallback: true,
    intent: null,
    model: null,
  };
}

function extractIntent(text) {
  const trimmed = String(text || "").trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) {
    const error = new Error("AI_INVALID_JSON");
    throw error;
  }
  return JSON.parse(trimmed.slice(start, end + 1));
}

export async function runAiProxy(options) {
  const kind = options.kind === "intent" ? "intent" : "explain";
  const timeoutMs = options.timeoutMs ?? AI_CHAT_TIMEOUT_MS;
  const log = typeof options.log === "function" ? options.log : () => {};
  const fallback = () => (kind === "intent" ? intentFallback() : explainFallback());
  const scene = options.scene || kind;

  if (!options.apiKey) {
    log(`[ai:${scene}] not_configured`);
    return { body: fallback(), diag: "not_configured" };
  }

  const controller = new AbortController();
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  let timer;
  const abortError = new Error("aborted");
  abortError.name = "AbortError";
  try {
    const fetchPromise = Promise.resolve(
      fetchImpl(`${String(options.baseUrl || "").replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${options.apiKey}`,
        },
        body: JSON.stringify({
          model: options.model,
          temperature: options.temperature ?? (kind === "intent" ? 0 : 0.2),
          thinking: { type: "disabled" },
          messages: [
            { role: "system", content: options.system || "" },
            { role: "user", content: options.user || "" },
          ],
        }),
      }),
    ).then(
      (value) => ({ settled: true, value }),
      (error) => ({ settled: true, error }),
    );
    const winner = await Promise.race([
      fetchPromise,
      new Promise((resolve) => {
        timer = setTimeout(() => {
          controller.abort();
          resolve({ settled: true, error: abortError });
        }, timeoutMs);
      }),
    ]);
    if (winner.error) throw winner.error;
    const upstream = winner.value;

    if (!upstream.ok) {
      await upstream.text().catch(() => "");
      const failure = classifyAiFailure({ status: upstream.status });
      log(`[ai:${scene}] ${failure.code}`);
      return { body: fallback(), diag: failure.code };
    }

    let data;
    try {
      data = await upstream.json();
    } catch {
      log(`[ai:${scene}] invalid_json`);
      return { body: fallback(), diag: "invalid_json" };
    }

    const content = data?.choices?.[0]?.message?.content;
    const text = typeof content === "string" ? content.trim() : "";
    if (!text) {
      log(`[ai:${scene}] empty_content`);
      return { body: fallback(), diag: "empty_content" };
    }

    if (kind === "intent") {
      try {
        return { body: intentSuccess(extractIntent(text), options.model), diag: "ok" };
      } catch {
        log(`[ai:${scene}] invalid_json`);
        return { body: fallback(), diag: "invalid_json" };
      }
    }

    return { body: explainSuccess(text, options.model), diag: "ok" };
  } catch (error) {
    const failure = classifyAiFailure({ error });
    log(`[ai:${scene}] ${failure.code}`);
    return { body: fallback(), diag: failure.code };
  } finally {
    clearTimeout(timer);
  }
}

export async function probeAiHealth(options) {
  const provider = options.provider || "deepseek";
  const model = String(options.model || "").trim();
  const base = {
    configured: Boolean(options.apiKey && model),
    provider,
    model,
    reachable: false,
    status: "not_configured",
  };
  if (!options.apiKey || !model) return withUserMessage(base);

  const controller = new AbortController();
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const log = typeof options.log === "function" ? options.log : () => {};
  let timer;
  const abortError = new Error("aborted");
  abortError.name = "AbortError";
  try {
    const fetchPromise = Promise.resolve(
      fetchImpl(`${String(options.baseUrl || "").replace(/\/$/, "")}/models`, {
        method: "GET",
        signal: controller.signal,
        headers: { Authorization: `Bearer ${options.apiKey}` },
      }),
    ).then(
      (value) => ({ value }),
      (error) => ({ error }),
    );
    const winner = await Promise.race([
      fetchPromise,
      new Promise((resolve) => {
        timer = setTimeout(() => {
          controller.abort();
          resolve({ error: abortError });
        }, options.timeoutMs ?? AI_HEALTH_TIMEOUT_MS);
      }),
    ]);
    if (winner.error) throw winner.error;
    const upstream = winner.value;
    if (upstream.status === 401 || upstream.status === 403) {
      await upstream.text?.().catch(() => "");
      log("[ai:health] auth_failed");
      return withUserMessage({ ...base, configured: true, reachable: true, status: "auth_failed" });
    }
    if (!upstream.ok) {
      await upstream.text?.().catch(() => "");
      log(`[ai:health] degraded http_${upstream.status}`);
      return withUserMessage({ ...base, configured: true, reachable: true, status: "degraded" });
    }
    let data;
    try {
      data = await upstream.json();
    } catch {
      log("[ai:health] invalid_json");
      return withUserMessage({ ...base, configured: true, reachable: true, status: "degraded" });
    }
    const ids = Array.isArray(data?.data) ? data.data.map((item) => item && item.id).filter(Boolean) : [];
    if (!ids.includes(model)) {
      log("[ai:health] model_unavailable");
      return withUserMessage({ ...base, configured: true, reachable: true, status: "model_unavailable" });
    }
    return withUserMessage({ ...base, configured: true, reachable: true, status: "healthy" });
  } catch {
    log("[ai:health] unreachable");
    return withUserMessage({ ...base, configured: true, reachable: false, status: "unreachable" });
  } finally {
    clearTimeout(timer);
  }
}
