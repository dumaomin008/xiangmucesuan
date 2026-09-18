/**
 * LLM Gateway：统一封装供应商、鉴权、超时、重试。
 * Prompt 版本尚未冻结，本轮拒绝执行任何未版本化 Prompt，避免把猜测写进抽取结果。
 */
export class LlmNotConfiguredError extends Error {
  code = "LLM_NOT_CONFIGURED";
  constructor(message = "Prompt 与模型供应商尚未冻结，LLM Gateway 拒绝执行未版本化 Prompt。") {
    super(message);
    this.name = "LlmNotConfiguredError";
  }
}

export type LlmGatewayConfig = {
  provider: string | null;
  endpoint: string | null;
  promptVersion: string | null;
};

export function getLlmGatewayConfig(): LlmGatewayConfig {
  return {
    provider: process.env.AI_LLM_PROVIDER || null,
    endpoint: process.env.AI_LLM_GATEWAY_URL || null,
    promptVersion: process.env.AI_PROMPT_VERSION || null,
  };
}

export async function completeStructuredJson(_input: {
  schemaVersion: string;
  promptVersion: string | null;
  payload: unknown;
}): Promise<never> {
  const config = getLlmGatewayConfig();
  if (!config.promptVersion) {
    throw new LlmNotConfiguredError();
  }
  throw new LlmNotConfiguredError("已配置 Prompt 版本，但供应商适配尚未接入。");
}
