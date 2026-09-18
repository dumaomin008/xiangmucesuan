/**
 * LLM 结构化意图：仅允许输出操作意图，禁止写入 KPI。
 * Schema 校验失败则丢弃，回退本地规则。
 */
import type { AssistantIntent, AssistantIntentKind, QueryTarget } from "./intent";
import type { AssistantParamKey, ParamPatch, ParamScope } from "./params";
import { FIELD_META } from "./params";

const KINDS: AssistantIntentKind[] = [
  "query",
  "diagnose",
  "modify",
  "create_scenario",
  "compare",
  "sensitivity",
  "advice",
  "report",
  "confirm",
  "cancel",
  "scope_choice",
  "unmatched",
];

const PARAM_KEYS = Object.keys(FIELD_META) as AssistantParamKey[];
const SCOPES: ParamScope[] = ["project", "vehicle", "all_routes", "route", "segment"];
const OPS = ["set", "add", "multiply"] as const;

/** 禁止 LLM 碰的引擎 KPI 字段名（出现即整单作废） */
const FORBIDDEN_KPI_KEYS = [
  "monthlyProfit",
  "monthlyRevenue",
  "monthlyTotalCost",
  "profitMargin",
  "irr",
  "cashFlow",
  "cumulativeCashFlow",
  "npv",
  "paybackPeriod",
];

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

function hasForbiddenKpi(obj: unknown, depth = 0): boolean {
  if (depth > 6 || obj == null) return false;
  if (Array.isArray(obj)) return obj.some((x) => hasForbiddenKpi(x, depth + 1));
  if (!isPlainObject(obj)) return false;
  for (const key of Object.keys(obj)) {
    if (FORBIDDEN_KPI_KEYS.includes(key)) return true;
    if (hasForbiddenKpi(obj[key], depth + 1)) return true;
  }
  return false;
}

function parsePatch(raw: unknown): ParamPatch | null {
  if (!isPlainObject(raw)) return null;
  const field = String(raw.field || raw.parameter || "");
  if (!PARAM_KEYS.includes(field as AssistantParamKey)) return null;
  const operation = String(raw.operation || "set");
  if (!OPS.includes(operation as (typeof OPS)[number])) return null;
  const value = Number(raw.value);
  if (!Number.isFinite(value)) return null;
  const meta = FIELD_META[field as AssistantParamKey];
  const scopeRaw = raw.scope != null ? String(raw.scope) : undefined;
  const scope = scopeRaw && SCOPES.includes(scopeRaw as ParamScope) ? (scopeRaw as ParamScope) : undefined;
  return {
    field: field as AssistantParamKey,
    label: meta.label,
    operation: operation as ParamPatch["operation"],
    value,
    unit: meta.unit,
    scope,
    routeId: raw.routeId != null ? String(raw.routeId) : undefined,
    segmentId: raw.segmentId != null ? String(raw.segmentId) : undefined,
  };
}

/**
 * 校验并规范化 LLM 返回的结构化意图。
 * 任何 KPI 字段、非法 kind、非法 patch 都会导致返回 null。
 */
export function validateLlmIntent(raw: unknown): AssistantIntent | null {
  if (!isPlainObject(raw)) return null;
  if (hasForbiddenKpi(raw)) return null;

  const kind = String(raw.kind || raw.intent || "") as AssistantIntentKind;
  if (!KINDS.includes(kind)) return null;

  const patchesRaw = Array.isArray(raw.patches) ? raw.patches : [];
  const patches: ParamPatch[] = [];
  for (const item of patchesRaw) {
    const p = parsePatch(item);
    if (!p) return null;
    patches.push(p);
  }

  const requiresConfirmation = raw.requiresConfirmation !== false;
  if ((kind === "modify" || kind === "create_scenario") && patches.length && !requiresConfirmation) {
    // 强制确认：即便 LLM 声称不需要确认，下游仍会走确认卡
  }

  const queryTarget = raw.queryTarget != null ? (String(raw.queryTarget) as QueryTarget) : undefined;
  const scenarioName = raw.scenarioName != null ? String(raw.scenarioName) : undefined;

  return {
    kind,
    title: String(raw.title || kind),
    queryTarget,
    patches,
    scenarioName,
    compareHint: raw.compareHint === "last_two" || raw.compareHint === "baseline_peer" || raw.compareHint === "named"
      ? raw.compareHint
      : undefined,
    parser: "llm",
  };
}

export function extractJsonObject(text: string): unknown | null {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

export const LLM_INTENT_SYSTEM_PROMPT = [
  "你是新能源重卡项目测算业务意图解析器。",
  "只输出一个 JSON 对象，不要 Markdown，不要解释。",
  "允许字段：kind, title, patches, scenarioName, queryTarget, compareHint, requiresConfirmation, scope。",
  "kind 枚举：query|diagnose|modify|create_scenario|compare|sensitivity|advice|report|confirm|cancel|scope_choice|unmatched。",
  "patches[].field 仅允许：electricityPrice|fleetSize|freightPrice|tripsPerVehicleMonth|distanceKm|loadTon|loadedEnergyConsumption|driverCostPerTrip|monthlyRentPerVehicle。",
  "patches[].operation 仅允许：set|add|multiply。",
  "scope 仅允许：project|vehicle|all_routes|route|segment。",
  "严禁输出或修改 monthlyProfit、monthlyRevenue、monthlyTotalCost、profitMargin、IRR、cashFlow 等 KPI。",
  "修改类意图必须 requiresConfirmation=true。",
].join("");
