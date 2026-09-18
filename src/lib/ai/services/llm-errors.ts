export class LlmNotConfiguredError extends Error {
  code = "LLM_NOT_CONFIGURED";
  constructor(message = "未配置 AI_LLM_API_KEY，无法调用大模型。") {
    super(message);
    this.name = "LlmNotConfiguredError";
  }
}
