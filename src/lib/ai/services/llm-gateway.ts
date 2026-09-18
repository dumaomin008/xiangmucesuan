import { AI_CHAT_TIMEOUT_MS, AI_DOCUMENT_TIMEOUT_MS } from "@/demo/ai/timeouts";
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
  chatTimeoutMs: number;
  documentTimeoutMs: number;
};

export function getLlmGatewayConfig(): LlmGatewayConfig {
  return {
    provider: process.env.AI_LLM_PROVIDER || "openai-compatible",
    model: process.env.AI_LLM_MODEL || "gpt-4o-mini",
    apiKey: process.env.AI_LLM_API_KEY || null,
    baseUrl: process.env.AI_LLM_BASE_URL || "https://api.openai.com/v1",
    promptVersion: process.env.AI_PROMPT_VERSION || "extract_v1",
    chatTimeoutMs: Number(process.env.AI_CHAT_TIMEOUT_MS || AI_CHAT_TIMEOUT_MS),
    documentTimeoutMs: Number(process.env.AI_DOCUMENT_TIMEOUT_MS || AI_DOCUMENT_TIMEOUT_MS),
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
  scene?: "chat" | "document";
}): Promise<T> {
  const config = getLlmGatewayConfig();
  if (!config.apiKey) throw new LlmNotConfiguredError();
  const provider = getProvider();
  const timeoutMs =
    input.timeoutMs ?? (input.scene === "document" ? config.documentTimeoutMs : config.chatTimeoutMs);
  const run = () =>
    provider.structuredCompletion<T>({
      model: config.model || "gpt-4o-mini",
      systemPrompt: input.systemPrompt,
      userContent: input.userContent,
      jsonSchema: input.jsonSchema,
      timeoutMs,
    });
  if (input.scene !== "document") return run();
  try {
    return await once(run);
  } catch (err) {
    if (err instanceof LlmNotConfiguredError) throw err;
    return once(run);
  }
}

export function isRetryableLlmError(err: unknown) {
  return err instanceof LlmRequestError || err instanceof LlmNotConfiguredError;
}
