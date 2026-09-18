import type { AIAnalysisReport } from "./schema";
import { FALLBACK_ANALYSIS_NOTICE } from "./schema";

const NUMBER_RE = /-?\d+(?:\.\d+)?/g;

export function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : trimmed;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error("AI_INVALID_JSON");
  }
  return JSON.parse(raw.slice(start, end + 1)) as unknown;
}

export function collectAllowedNumbers(report: AIAnalysisReport): number[] {
  const found: number[] = [];
  const walk = (value: unknown) => {
    if (typeof value === "number" && Number.isFinite(value)) {
      found.push(value);
      return;
    }
    if (typeof value === "string") {
      const matches = value.match(NUMBER_RE) || [];
      for (const item of matches) found.push(Number(item));
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    if (value && typeof value === "object") {
      Object.values(value).forEach(walk);
    }
  };
  walk(report);
  return found;
}

function nearly(left: number, right: number): boolean {
  if (!Number.isFinite(left) || !Number.isFinite(right)) return false;
  const diff = Math.abs(left - right);
  const scale = Math.max(Math.abs(left), Math.abs(right), 1);
  return diff <= 0.11 || diff / scale <= 0.02;
}

export function numberIsAllowed(value: number, allowed: number[]): boolean {
  return allowed.some(
    (item) =>
      nearly(value, item) ||
      nearly(value, item * 100) ||
      nearly(value, item / 100) ||
      nearly(value, item / 10000) ||
      nearly(value, item / 12),
  );
}

export function narrativeIsGrounded(text: string, report: AIAnalysisReport): boolean {
  return narrativeUsesKnownNumbers(text, collectAllowedNumbers(report));
}

export function narrativeUsesKnownNumbers(text: string, allowed: number[]): boolean {
  const matches = text.match(NUMBER_RE) || [];
  return matches.every((raw) => numberIsAllowed(Number(raw), allowed));
}

type NarrativePatch = {
  conclusion?: string;
  highlights?: string[];
  anomaly?: string;
  optimize?: string;
  risks?: Array<{ name?: string; description?: string; suggestion?: string }>;
  recommendations?: Array<{ action?: string; reason?: string }>;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function asText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function readNarrativePatch(raw: unknown): NarrativePatch | null {
  const record = typeof raw === "string" ? asRecord(safeParse(raw)) : asRecord(raw);
  if (!record) return null;
  const summary = asRecord(record.summary);
  const costInsight = asRecord(record.costInsight);
  const risks = Array.isArray(record.risks)
    ? record.risks.map((item) => {
        const row = asRecord(item);
        return {
          name: asText(row?.name),
          description: asText(row?.description),
          suggestion: asText(row?.suggestion),
        };
      })
    : undefined;
  const recommendations = Array.isArray(record.recommendations)
    ? record.recommendations.map((item) => {
        const row = asRecord(item);
        return { action: asText(row?.action), reason: asText(row?.reason) };
      })
    : undefined;
  const highlights = Array.isArray(summary?.highlights)
    ? summary.highlights.map((item) => asText(item)).filter((item): item is string => Boolean(item))
    : undefined;
  return {
    conclusion: asText(summary?.conclusion),
    highlights,
    anomaly: asText(costInsight?.anomaly),
    optimize: asText(costInsight?.optimize),
    risks,
    recommendations,
  };
}

function safeParse(text: string): unknown {
  try {
    return extractJsonObject(text);
  } catch {
    return null;
  }
}

function keep(text: string | undefined, allowed: number[]): string | undefined {
  if (!text) return undefined;
  return narrativeUsesKnownNumbers(text, allowed) ? text : undefined;
}

export function mergeNarrative(base: AIAnalysisReport, raw: unknown): AIAnalysisReport {
  const patch = readNarrativePatch(raw);
  if (!patch) {
    return { ...base, mode: "fallback", notice: FALLBACK_ANALYSIS_NOTICE };
  }
  const allowed = collectAllowedNumbers(base);
  const next: AIAnalysisReport = {
    ...base,
    summary: { ...base.summary, highlights: [...base.summary.highlights] },
    costInsight: { ...base.costInsight },
    risks: base.risks.map((item) => ({ ...item, affectedMetrics: [...item.affectedMetrics] })),
    recommendations: base.recommendations.map((item) => ({ ...item })),
    keyMetrics: base.keyMetrics,
    costStructure: base.costStructure,
    scenarios: base.scenarios,
    sensitivity: base.sensitivity,
    trend: base.trend,
  };
  let used = false;
  const conclusion = keep(patch.conclusion, allowed);
  if (conclusion) {
    next.summary.conclusion = conclusion;
    used = true;
  }
  const highlights = patch.highlights?.map((item) => keep(item, allowed)).filter((item): item is string => Boolean(item));
  if (highlights && highlights.length) {
    next.summary.highlights = highlights.slice(0, 4);
    used = true;
  }
  const anomaly = keep(patch.anomaly, allowed);
  if (anomaly) {
    next.costInsight.anomaly = anomaly;
    used = true;
  }
  const optimize = keep(patch.optimize, allowed);
  if (optimize) {
    next.costInsight.optimize = optimize;
    used = true;
  }
  if (patch.risks) {
    for (const incoming of patch.risks) {
      const target = next.risks.find((item) => item.name === incoming.name);
      if (!target) continue;
      const description = keep(incoming.description, allowed);
      const suggestion = keep(incoming.suggestion, allowed);
      if (description) {
        target.description = description;
        used = true;
      }
      if (suggestion) {
        target.suggestion = suggestion;
        used = true;
      }
    }
  }
  if (patch.recommendations) {
    patch.recommendations.slice(0, 5).forEach((incoming, index) => {
      const target = next.recommendations[index];
      if (!target) return;
      const action = keep(incoming.action, allowed);
      const reason = keep(incoming.reason, allowed);
      if (action) {
        target.action = action;
        used = true;
      }
      if (reason) {
        target.reason = reason;
        used = true;
      }
    });
  }
  next.mode = used ? "online" : "fallback";
  next.notice = used ? null : FALLBACK_ANALYSIS_NOTICE;
  return next;
}
