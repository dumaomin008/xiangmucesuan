export type LlmStructuredRequest = {
  model: string;
  systemPrompt: string;
  userContent: string;
  jsonSchema?: unknown;
  timeoutMs?: number;
};

export interface LlmProvider {
  structuredCompletion<T>(input: LlmStructuredRequest): Promise<T>;
}

export class LlmRequestError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "LlmRequestError";
  }
}
