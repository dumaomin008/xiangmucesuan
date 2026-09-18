import { getField } from "./schema/field-dictionary";
import type { DueDiligenceItem, ParameterRecord, QuestionRecord } from "./schema/types";

const SENSITIVE = new Set([
  "revenue.freight_price",
  "ops.trips_per_vehicle_month",
  "energy.electricity_price",
  "energy.loaded_consumption",
  "vehicle.fleet_size",
  "vehicle.monthly_rent",
  "cargo.load_ton",
]);

function missingScore(priority: string) {
  if (priority === "P0") return 1;
  if (priority === "P1") return 0.65;
  return 0.3;
}

function confidenceScore(status: string, confidence: number | null) {
  if (status === "missing" || status === "conflict") return 0.15;
  if (status === "reference" || status === "default") return 0.4;
  if (confidence != null) return Math.max(0.2, Math.min(confidence, 0.95));
  return 0.7;
}

export function buildDueDiligence(input: {
  questions: QuestionRecord[];
  parameters: ParameterRecord[];
}): DueDiligenceItem[] {
  return input.questions
    .filter((q) => q.status === "open" || q.status === "skipped")
    .map((q) => {
      const param = input.parameters.find((p) => p.field_code === q.field_code && (p.route_id ?? null) === (q.route_id ?? null));
      const def = getField(q.field_code);
      const miss = missingScore(q.priority);
      const sens = SENSITIVE.has(q.field_code) ? 0.9 : 0.45;
      const conf = 1 - confidenceScore(param?.status || "missing", param?.confidence ?? null);
      const score = miss * sens * (0.5 + conf);
      return {
        id: q.id,
        priority: score >= 0.5 ? "P0" : score >= 0.25 ? "P1" : "P2",
        item: q.question,
        reason: q.reason,
        current_assumption: param?.value ? `${param.value}（${param.status}）` : "缺失",
        impact_metrics: q.impact_metrics.length ? q.impact_metrics : def?.impactMetrics || [],
        sensitivity: SENSITIVE.has(q.field_code) ? "高" : "中",
        suggested_method: def?.aiCompletable === "forbidden" ? "客户确认/合同核验" : "现场计时/车辆实测/历史台账",
        completion_status: q.status === "answered" ? "已确认" : "未获取",
      } satisfies DueDiligenceItem;
    })
    .sort((a, b) => {
      const order: Record<DueDiligenceItem["priority"], number> = { P0: 0, P1: 1, P2: 2 };
      return order[a.priority] - order[b.priority];
    });
}
