import type { SchemeCalculationInput } from "@/lib/engine/types";
import { completeStructuredJson } from "../services/llm-gateway";
import { buildEngineAnalysisReport, type BuildAnalysisOptions } from "./build-report";
import { ANALYSIS_SYSTEM_PROMPT } from "./prompt";
import { mergeNarrative } from "./guard";
import { DEMO_ANALYSIS_NOTICE, FALLBACK_ANALYSIS_NOTICE, type AIAnalysisReport, type AnalysisMode } from "./schema";

export function resolveAnalysisMode(env: NodeJS.ProcessEnv = process.env): Exclude<AnalysisMode, "fallback"> {
  const explicit = String(env.AI_MODE || env.DEMO_AI_MODE || "").trim().toLowerCase();
  if (explicit === "demo" || explicit === "local") return "demo";
  if (explicit === "online") return "online";
  return env.AI_LLM_API_KEY ? "online" : "demo";
}

export function buildLocalAnalysisReport(input: SchemeCalculationInput, options: BuildAnalysisOptions = {}): AIAnalysisReport | null {
  try {
    return buildEngineAnalysisReport(input, options);
  } catch {
    return null;
  }
}

export async function enrichAnalysisReport(
  report: AIAnalysisReport,
  options: {
    mode?: Exclude<AnalysisMode, "fallback">;
    complete?: (input: { systemPrompt: string; userContent: string }) => Promise<unknown>;
  } = {},
): Promise<AIAnalysisReport> {
  const mode = options.mode ?? resolveAnalysisMode();
  if (mode !== "online") {
    return { ...report, mode: "demo", notice: DEMO_ANALYSIS_NOTICE };
  }
  try {
    const userContent = JSON.stringify({
      instruction: "只改写结论文字。不得改动任何金额、比率、回收期和敏感性数字。",
      report,
    });
    const raw = options.complete
      ? await options.complete({ systemPrompt: ANALYSIS_SYSTEM_PROMPT, userContent })
      : await completeStructuredJson<unknown>({
          systemPrompt: ANALYSIS_SYSTEM_PROMPT,
          userContent,
          scene: "chat",
        });
    return mergeNarrative(report, raw);
  } catch {
    return { ...report, mode: "fallback", notice: FALLBACK_ANALYSIS_NOTICE };
  }
}
