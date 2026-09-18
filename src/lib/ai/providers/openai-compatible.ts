import { LlmRequestError, type LlmProvider, type LlmStructuredRequest } from "./types";

function extractJson(text: string) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : trimmed;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) throw new LlmRequestError("LLM_INVALID_JSON", "模型未返回可解析 JSON");
  return JSON.parse(raw.slice(start, end + 1));
}

export function createOpenAiCompatibleProvider(config: {
  apiKey: string;
  baseUrl: string;
}): LlmProvider {
  return {
    async structuredCompletion<T>(input: LlmStructuredRequest): Promise<T> {
      const timeoutMs = input.timeoutMs ?? 45000;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(`${config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
          method: "POST",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.apiKey}`,
          },
          body: JSON.stringify({
            model: input.model,
            temperature: 0.1,
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: input.systemPrompt },
              { role: "user", content: input.userContent },
            ],
          }),
        });
        if (!res.ok) {
          const body = await res.text().catch(() => "");
          throw new LlmRequestError("LLM_HTTP_ERROR", `模型服务返回 ${res.status}${body ? `：${body.slice(0, 180)}` : ""}`);
        }
        const payload = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
        const content = payload.choices?.[0]?.message?.content;
        if (!content) throw new LlmRequestError("LLM_EMPTY", "模型没有返回内容");
        return extractJson(content) as T;
      } catch (err) {
        if (err instanceof LlmRequestError) throw err;
        if (err instanceof Error && err.name === "AbortError") {
          throw new LlmRequestError("LLM_TIMEOUT", "AI服务响应较慢，正在重试。");
        }
        throw new LlmRequestError("LLM_NETWORK", err instanceof Error ? err.message : "模型网络异常");
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
