import { LlmNotConfiguredError } from "./llm-errors";
import { createOpenAiCompatibleProvider } from "../providers/openai-compatible";
import { LlmRequestError, type LlmProvider } from "../providers/types";

export { LlmNotConfiguredError } from "./llm-errors";
export { LlmRequestError } from "../providers/types";

export type LlmGatewayConfig = {
  provider: string | null;
  model: string | null;
  apiKey: string | null;
  baseUrl: string;
  promptVersion: string;
  timeoutMs: number;
};

export function getLlmGatewayConfig(): LlmGatewayConfig {
  return {
    provider: process.env.AI_LLM_PROVIDER || "openai-compatible",
    model: process.env.AI_LLM_MODEL || "gpt-4o-mini",
    apiKey: process.env.AI_LLM_API_KEY || null,
    baseUrl: process.env.AI_LLM_BASE_URL || "https://api.openai.com/v1",
    promptVersion: process.env.AI_PROMPT_VERSION || "extract_v1",
    timeoutMs: Number(process.env.AI_LLM_TIMEOUT_MS || 45000),
  };
}

export function isLlmConfigured() {
  const config = getLlmGatewayConfig();
  return Boolean(config.apiKey && config.promptVersion && config.model);
}

function getProvider(): LlmProvider {
  const config = getLlmGatewayConfig();
  if (!config.apiKey) throw new LlmNotConfiguredError();
  return createOpenAiCompatibleProvider({ apiKey: config.apiKey, baseUrl: config.baseUrl });
}

async function once<T>(fn: () => Promise<T>) {
  return fn();
}

export async function completeStructuredJson<T>(input: {
  systemPrompt: string;
  userContent: string;
  jsonSchema?: unknown;
  timeoutMs?: number;
}): Promise<T> {
  const config = getLlmGatewayConfig();
  if (!config.apiKey) throw new LlmNotConfiguredError();
  const provider = getProvider();
  const run = () =>
    provider.structuredCompletion<T>({
      model: config.model || "gpt-4o-mini",
      systemPrompt: input.systemPrompt,
      userContent: input.userContent,
      jsonSchema: input.jsonSchema,
      timeoutMs: input.timeoutMs ?? config.timeoutMs,
    });
  try {
    return await once(run);
  } catch (err) {
    if (err instanceof LlmNotConfiguredError) throw err;
    try {
      return await once(run);
    } catch (retryErr) {
      throw retryErr;
    }
  }
}

export function isRetryableLlmError(err: unknown) {
  return err instanceof LlmRequestError || err instanceof LlmNotConfiguredError;
}
