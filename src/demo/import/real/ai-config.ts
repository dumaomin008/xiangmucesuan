/**
 * 资料语义提取的模型配置。
 * Key 只读环境变量，禁止写入日志、前端或 Git。
 */

export type DocumentAiConfig = {
  provider: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  configured: boolean;
};

export function resolveDocumentAiConfig(env: NodeJS.ProcessEnv = process.env): DocumentAiConfig {
  const apiKey = env.AI_API_KEY || env.DEMO_AI_API_KEY || "";
  const explicitProvider = (env.AI_PROVIDER || "").trim().toLowerCase();
  const fallbackBase = explicitProvider === "openai" || explicitProvider === "openai-compatible"
    ? "https://api.openai.com/v1"
    : "https://api.deepseek.com";
  const baseUrl = (env.AI_BASE_URL || env.DEMO_AI_BASE_URL || fallbackBase).replace(/\/$/, "");
  const provider =
    explicitProvider ||
    (baseUrl.includes("deepseek") ? "deepseek" : "openai-compatible");
  const model =
    env.AI_MODEL ||
    env.DEMO_AI_MODEL ||
    (provider === "deepseek" ? "deepseek-flash" : "gpt-4o-mini");
  return {
    provider,
    apiKey,
    baseUrl,
    model,
    configured: Boolean(apiKey),
  };
}

export function chatCompletionsUrl(baseUrl: string): string {
  const base = baseUrl.replace(/\/$/, "");
  return `${base}/chat/completions`;
}

/** 启动日志只允许这三行，不得包含 Key 或 Authorization。 */
export function formatAiConfigLog(config: DocumentAiConfig): string[] {
  return [
    `AI Provider: ${config.provider}`,
    `AI Model: ${config.model}`,
    `AI Configured: ${config.configured}`,
  ];
}

export function logDocumentAiConfig(config: DocumentAiConfig = resolveDocumentAiConfig()): void {
  for (const line of formatAiConfigLog(config)) console.log(line);
}
