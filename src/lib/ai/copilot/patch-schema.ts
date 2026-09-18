import type { ScenarioAction, ScenarioIntent } from "./intent";

export const SCENARIO_PATCH_WHITELIST = [
  "revenue.freight_price",
  "energy.electricity_price",
  "ops.trips_per_vehicle_month",
  "vehicle.fleet_size",
  "energy.loaded_consumption",
  "vehicle.monthly_rent",
] as const;

export type ScenarioPatchField = (typeof SCENARIO_PATCH_WHITELIST)[number];

const OPERATIONS = new Set(["multiply", "set", "add"]);
const SCOPES = new Set(["all_routes", "project"]);
const KINDS = new Set(["explain", "scenario", "due_diligence"]);
const FORBIDDEN_KPI_FIELDS = [
  "monthly_profit",
  "monthly_revenue",
  "monthly_total_cost",
  "profit_margin",
  "irr",
  "cash_flow",
];

export function isWhitelistedPatchField(fieldCode: string): fieldCode is ScenarioPatchField {
  return (SCENARIO_PATCH_WHITELIST as readonly string[]).includes(fieldCode);
}

export function sanitizeScenarioIntent(raw: unknown): ScenarioIntent {
  if (!raw || typeof raw !== "object") {
    throw new Error("意图解析结果不是对象");
  }
  const data = raw as Record<string, unknown>;
  const kind = String(data.kind || "");
  if (!KINDS.has(kind)) {
    throw new Error("意图类型不在白名单内");
  }
  const title = String(data.title || "").trim() || (kind === "scenario" ? "模拟方案" : "解释测算结果");
  const actionsRaw = Array.isArray(data.actions) ? data.actions : [];
  const actions: ScenarioAction[] = [];
  for (const item of actionsRaw) {
    if (!item || typeof item !== "object") throw new Error("ScenarioPatch action 非法");
    const action = item as Record<string, unknown>;
    const fieldCode = String(action.field_code || "");
    if (FORBIDDEN_KPI_FIELDS.includes(fieldCode) || /profit|revenue|irr|cash/i.test(fieldCode)) {
      throw new Error("禁止在 ScenarioPatch 中写入测算结果字段");
    }
    if (!isWhitelistedPatchField(fieldCode)) {
      throw new Error(`field_code 不在白名单：${fieldCode}`);
    }
    const operation = String(action.operation || "");
    const scope = String(action.scope || "");
    const value = Number(action.value);
    if (!OPERATIONS.has(operation)) throw new Error("operation 不在白名单");
    if (!SCOPES.has(scope)) throw new Error("scope 不在白名单");
    if (!Number.isFinite(value)) throw new Error("ScenarioPatch value 必须是数字");
    if (fieldCode === "vehicle.fleet_size" && scope !== "project") {
      throw new Error("车辆数只能使用 project scope");
    }
    actions.push({
      field_code: fieldCode,
      scope: scope as ScenarioAction["scope"],
      operation: operation as ScenarioAction["operation"],
      value,
    });
  }
  if (kind === "scenario" && actions.length === 0) {
    throw new Error("场景意图必须包含至少一个合法 ScenarioPatch");
  }
  return {
    kind: kind as ScenarioIntent["kind"],
    title,
    actions: kind === "scenario" ? actions : [],
    parser: "llm",
  };
}
