import { parseIntentRuleBased, type ScenarioIntent } from "./intent";
import { sanitizeScenarioIntent } from "./patch-schema";
import { INTENT_SYSTEM_PROMPT, buildIntentUserPrompt } from "../extract/prompts";
import { completeStructuredJson, isLlmConfigured } from "../services/llm-gateway";

export async function resolveIntent(
  question: string,
  llmComplete?: () => Promise<unknown>,
): Promise<ScenarioIntent> {
  const rule = parseIntentRuleBased(question);
  if (rule.kind !== "unmatched") return rule;

  const runLlm = llmComplete || (isLlmConfigured() ? () => completeStructuredJson<unknown>({
    systemPrompt: INTENT_SYSTEM_PROMPT,
    userContent: buildIntentUserPrompt(question),
    scene: "chat",
  }) : null);

  if (!runLlm) {
    return { kind: "explain", title: "解释测算结果", actions: [], parser: "fallback" };
  }

  try {
    const raw = await runLlm();
    return sanitizeScenarioIntent(raw);
  } catch {
    return { kind: "explain", title: "解释测算结果", actions: [], parser: "fallback" };
  }
}
