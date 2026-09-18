import { parseIntentRuleBased, type ScenarioIntent } from "./intent";
import { sanitizeScenarioIntent } from "./patch-schema";
import { classifyQuestion } from "../analysis/answer-plan";
import { INTENT_SYSTEM_PROMPT, buildIntentUserPrompt } from "../extract/prompts";
import { completeStructuredJson, isLlmConfigured } from "../services/llm-gateway";

const ANALYTICAL = new Set(["risk", "cost", "profit", "sensitivity", "comparison", "due_diligence", "clarify"]);

export async function resolveIntent(
  question: string,
  llmComplete?: () => Promise<unknown>,
): Promise<ScenarioIntent> {
  const rule = parseIntentRuleBased(question);
  if (rule.kind !== "unmatched") return rule;
  if (ANALYTICAL.has(classifyQuestion(question))) {
    const kind = classifyQuestion(question) === "due_diligence" ? "due_diligence" : "explain";
    return { kind, title: kind === "due_diligence" ? "下一步尽调" : "解释测算结果", actions: [], parser: "rule", clarify: rule.clarify };
  }

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
