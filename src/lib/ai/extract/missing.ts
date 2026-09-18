import { FIELD_DICTIONARY, FREIGHT_UNIT_LABEL, getField } from "../schema/field-dictionary";
import type {
  AiExtractResult,
  AiRouteDraft,
  ConflictRecord,
  DueDiligenceItem,
  MissingItem,
  ParameterRecord,
  QuestionRecord,
  ReferenceCandidate,
  SourceType,
} from "../schema/types";
import { AI_PROJECT_EXTRACT_SCHEMA_VERSION, CALCULATION_REQUEST_SCHEMA_VERSION } from "../schema/versions";
import { evaluateP0Gate } from "../p0-gate";

function hasValue(value: string | null | undefined) {
  return value != null && String(value).trim() !== "";
}

function routeFieldValue(route: AiRouteDraft, fieldCode: string) {
  const map: Record<string, string | null> = {
    "route.name": route.route_name,
    "route.origin": route.origin_name,
    "route.destination": route.destination_name,
    "route.distance_km": route.distance_km,
    "cargo.name": route.cargo_name,
    "cargo.daily_volume_ton": route.volume_value,
    "cargo.load_ton": route.load_ton,
    "ops.trips_per_day": route.trips_per_day,
    "ops.trips_per_vehicle_month": route.trips_per_vehicle_month,
    "vehicle.fleet_size": route.vehicle_count,
    "revenue.freight_price": route.freight_price,
    "revenue.freight_price_unit": route.freight_price_unit,
    "cost.toll_per_trip": route.toll_per_trip,
    "cost.loading_unloading_fee": route.loading_unloading_fee,
    "cost.information_fee": route.information_fee,
    "cost.driver_cost_per_trip": route.driver_cost_per_trip,
  };
  return map[fieldCode] ?? null;
}

export function parametersFromRoute(route: AiRouteDraft, sourceType: SourceType = "free_text", sourceRef = "结构化线路"): ParameterRecord[] {
  const pairs: Array<[string, string | null, string | null]> = [
    ["route.origin", route.origin_name, null],
    ["route.destination", route.destination_name, null],
    ["route.distance_km", route.distance_km, "km"],
    ["cargo.daily_volume_ton", route.volume_value, route.volume_unit],
    ["cargo.load_ton", route.load_ton, "吨"],
    ["cargo.name", route.cargo_name, null],
    ["ops.trips_per_day", route.trips_per_day, "趟/日"],
    ["ops.trips_per_vehicle_month", route.trips_per_vehicle_month, "趟/月"],
    ["vehicle.fleet_size", route.vehicle_count, "台"],
    ["revenue.freight_price", route.freight_price, null],
    ["revenue.freight_price_unit", route.freight_price_unit, null],
    ["cost.toll_per_trip", route.toll_per_trip, "元/趟"],
    ["cost.loading_unloading_fee", route.loading_unloading_fee, "元/趟"],
    ["cost.information_fee", route.information_fee, "元/趟"],
    ["cost.driver_cost_per_trip", route.driver_cost_per_trip, "元/趟"],
  ];
  return pairs
    .filter(([, value]) => hasValue(value))
    .map(([field_code, value, unit]) => ({
      field_code,
      value,
      unit,
      raw_value: value,
      source_type: sourceType,
      source_ref: sourceRef,
      confidence: 0.7,
      status: "extracted" as const,
      editable: true,
      reference_meta: null,
      updated_by: "AI" as const,
      route_id: route.id ?? null,
    }));
}

export function mergeParameterCandidates(params: ParameterRecord[]): { parameters: ParameterRecord[]; conflicts: ConflictRecord[] } {
  const groups = new Map<string, ParameterRecord[]>();
  for (const param of params) {
    const key = `${param.route_id ?? "project"}::${param.field_code}`;
    const list = groups.get(key) ?? [];
    list.push(param);
    groups.set(key, list);
  }
  const parameters: ParameterRecord[] = [];
  const conflicts: ConflictRecord[] = [];
  for (const [key, list] of groups) {
    const uniqueValues = Array.from(new Set(list.map((item) => String(item.value ?? "").trim()).filter(Boolean)));
    if (uniqueValues.length > 1) {
      conflicts.push({
        field_code: list[0].field_code,
        route_id: list[0].route_id ?? null,
        candidates: list.map((item) => ({
          value: String(item.value ?? ""),
          unit: item.unit,
          source_type: item.source_type,
          source_ref: item.source_ref,
          raw_value: item.raw_value,
        })),
        resolved_value: null,
        status: "open",
      });
      parameters.push({ ...list[0], status: "conflict", value: null });
    } else {
      parameters.push(list[0]);
    }
    void key;
  }
  return { parameters, conflicts };
}

export function buildMissingAndQuestions(input: {
  routes: AiRouteDraft[];
  parameters: ParameterRecord[];
  projectFleetSize: string | null;
  references: ReferenceCandidate[];
}): { missing: MissingItem[]; questions: QuestionRecord[]; dueDiligence: DueDiligenceItem[] } {
  const missing: MissingItem[] = [];
  const questions: QuestionRecord[] = [];
  const dueDiligence: DueDiligenceItem[] = [];
  const paramValue = (fieldCode: string, routeId?: string | null) =>
    input.parameters.find((item) => item.field_code === fieldCode && (item.route_id ?? null) === (routeId ?? null) && item.status !== "conflict" && item.status !== "missing");

  const ask = (fieldCode: string, route: AiRouteDraft | null, current: string | null) => {
    const def = getField(fieldCode);
    if (!def?.questionPriority) return;
    if (hasValue(current) && paramValue(fieldCode, route?.id)?.status !== "conflict") return;
    if (fieldCode === "vehicle.fleet_size" && hasValue(input.projectFleetSize)) return;
    const ref = input.references.find((item) => item.field_code === fieldCode);
    const name = route ? `${def.name}（${route.route_name || "未命名线路"}）` : def.name;
    missing.push({
      field_code: fieldCode,
      name,
      priority: def.questionPriority,
      route_id: route?.id ?? null,
      reason: def.questionReason,
    });
    questions.push({
      priority: def.questionPriority,
      field_code: fieldCode,
      route_id: route?.id ?? null,
      question: `请确认${name}`,
      reason: def.questionReason || "该字段对测算完整性有影响。",
      impact_metrics: def.impactMetrics,
      has_reference: Boolean(ref),
      answer_action: null,
      answer_value: null,
      status: "open",
    });
    dueDiligence.push({
      priority: def.questionPriority,
      item: name,
      reason: def.questionReason,
      current_assumption: current || "缺失",
      impact_metrics: def.impactMetrics,
      sensitivity: null,
      suggested_method: def.aiCompletable === "forbidden" ? "客户确认/合同核验" : "客户确认/现场核实",
      completion_status: "未获取",
    });
  };

  for (const def of FIELD_DICTIONARY.filter((item) => item.scope === "project" && item.questionPriority)) {
    const current = paramValue(def.fieldCode, null)?.value ?? (def.fieldCode === "vehicle.fleet_size" ? input.projectFleetSize : null);
    ask(def.fieldCode, null, current ?? null);
  }

  for (const route of input.routes.filter((item) => item.enabled)) {
    for (const def of FIELD_DICTIONARY.filter((item) => item.scope === "route" && item.questionPriority)) {
      ask(def.fieldCode, route, routeFieldValue(route, def.fieldCode));
    }
  }

  return { missing, questions, dueDiligence };
}

export function buildCalculationRequest(
  routes: AiRouteDraft[],
  questions: QuestionRecord[],
  parameters: ParameterRecord[] = [],
  projectFleetSize: string | null = null,
) {
  return evaluateP0Gate({ routes, questions, parameters, projectFleetSize });
}

export function completeness(parameters: ParameterRecord[], questions: QuestionRecord[]) {
  const p0Open = questions.filter((item) => item.priority === "P0" && item.status === "open").length;
  const p1Open = questions.filter((item) => item.priority === "P1" && item.status === "open").length;
  const p2Open = questions.filter((item) => item.priority === "P2" && item.status === "open").length;
  return {
    tracked: questions.length,
    filled: questions.filter((item) => item.status !== "open").length,
    p0Open,
    p1Open,
    p2Open,
    extracted: parameters.filter((item) => item.status === "extracted" || item.status === "confirmed").length,
    conflict: parameters.filter((item) => item.status === "conflict").length,
  };
}

export function emptyExtract(project: { name: string | null; customer: string | null; region: string | null }): AiExtractResult {
  return {
    schema_version: AI_PROJECT_EXTRACT_SCHEMA_VERSION,
    project,
    routes: [],
    parameters: [],
    conflicts: [],
    missing_items: [],
    questions: [],
    reference_candidates: [],
    calculation_request: {
      schema_version: CALCULATION_REQUEST_SCHEMA_VERSION,
      ready: false,
      blocking_p0: [],
      blocking: [],
      routes_confirmed: false,
      engine_mapped_fields_only: true,
    },
    analysis: null,
    risks: [],
    due_diligence_next: [],
  };
}

export function freightUnitLabel(code: string | null) {
  if (!code) return "";
  return FREIGHT_UNIT_LABEL[code] || code;
}
