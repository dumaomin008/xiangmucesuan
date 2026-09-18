import { FIELD_DICTIONARY, getField } from "./schema/field-dictionary";
import { CALCULATION_REQUEST_SCHEMA_VERSION } from "./schema/versions";
import type { AiRouteDraft, CalculationRequest, ParameterRecord, QuestionRecord } from "./schema/types";

const FREIGHT_UNITS = new Set(["PER_TON", "PER_TRIP", "PER_TON_KM"]);

function hasValue(value: string | null | undefined) {
  return value != null && String(value).trim() !== "";
}

function routeFieldValue(route: AiRouteDraft, fieldCode: string) {
  const map: Record<string, string | null> = {
    "route.origin": route.origin_name,
    "route.destination": route.destination_name,
    "route.distance_km": route.distance_km,
    "cargo.daily_volume_ton": route.volume_value,
    "revenue.freight_price": route.freight_price,
    "revenue.freight_price_unit": route.freight_price_unit,
    "vehicle.fleet_size": route.vehicle_count,
  };
  return map[fieldCode] ?? null;
}

function paramValue(parameters: ParameterRecord[], fieldCode: string, routeId?: string | null) {
  return parameters.find(
    (item) =>
      item.field_code === fieldCode &&
      (item.route_id ?? null) === (routeId ?? null) &&
      item.status !== "conflict" &&
      item.status !== "missing" &&
      hasValue(item.value),
  )?.value ?? null;
}

export type P0BlockingItem = {
  field_code: string;
  name: string;
  reason: string;
  route_id?: string | null;
};

export type P0GateResult = CalculationRequest & {
  blocking: P0BlockingItem[];
};

export function evaluateP0Gate(input: {
  routes: AiRouteDraft[];
  questions?: QuestionRecord[];
  parameters?: ParameterRecord[];
  projectFleetSize?: string | null;
}): P0GateResult {
  const blocking: P0BlockingItem[] = [];
  const parameters = input.parameters || [];
  const enabledRoutes = input.routes.filter((route) => route.enabled);
  const routesConfirmed = enabledRoutes.length > 0 && enabledRoutes.every((route) => route.status === "confirmed");

  if (enabledRoutes.length === 0) {
    blocking.push({
      field_code: "route.origin",
      name: "关键线路",
      reason: "至少需要一条启用中的线路，才能进入正式测算。",
    });
  }

  if (enabledRoutes.length > 0 && !routesConfirmed) {
    blocking.push({
      field_code: "routes",
      name: "线路确认",
      reason: "线路未确认前，不能生成正式测算版本。",
    });
  }

  const fleet =
    paramValue(parameters, "vehicle.fleet_size", null) ||
    input.projectFleetSize ||
    enabledRoutes.find((route) => hasValue(route.vehicle_count))?.vehicle_count ||
    null;
  if (!hasValue(fleet)) {
    const def = getField("vehicle.fleet_size");
    blocking.push({
      field_code: "vehicle.fleet_size",
      name: def?.name || "车辆数",
      reason: def?.questionReason || "车辆数为测算关键输入。",
    });
  }

  for (const route of enabledRoutes) {
    for (const def of FIELD_DICTIONARY.filter((item) => item.scope === "route" && item.questionPriority === "P0")) {
      const current = routeFieldValue(route, def.fieldCode) || paramValue(parameters, def.fieldCode, route.id);
      if (!hasValue(current)) {
        blocking.push({
          field_code: def.fieldCode,
          name: `${def.name}（${route.route_name || "未命名线路"}）`,
          reason: def.questionReason,
          route_id: route.id ?? null,
        });
      } else if (def.fieldCode === "revenue.freight_price_unit" && !FREIGHT_UNITS.has(String(current).trim())) {
        blocking.push({
          field_code: def.fieldCode,
          name: `${def.name}（${route.route_name || "未命名线路"}）`,
          reason: "计价单位必须是元/吨、元/趟或元/吨公里。",
          route_id: route.id ?? null,
        });
      }
    }
  }

  for (const question of (input.questions || []).filter((item) => item.priority === "P0" && item.status === "open")) {
    const already = blocking.some((item) => item.field_code === question.field_code && (item.route_id ?? null) === (question.route_id ?? null));
    if (already) continue;
    const route = enabledRoutes.find((item) => item.id === question.route_id) ?? null;
    const current =
      (route ? routeFieldValue(route, question.field_code) : null) ||
      paramValue(parameters, question.field_code, question.route_id) ||
      (question.field_code === "vehicle.fleet_size" ? fleet : null);
    if (hasValue(current)) continue;
    const def = getField(question.field_code);
    blocking.push({
      field_code: question.field_code,
      name: def?.name || question.field_code,
      reason: question.reason,
      route_id: question.route_id ?? null,
    });
  }

  const blocking_p0 = Array.from(new Set(blocking.map((item) => item.field_code)));
  return {
    schema_version: CALCULATION_REQUEST_SCHEMA_VERSION,
    ready: blocking.length === 0 && routesConfirmed,
    blocking_p0,
    blocking,
    routes_confirmed: routesConfirmed,
    engine_mapped_fields_only: true,
  };
}

export function p0GateMessage(gate: P0GateResult) {
  const names = gate.blocking.map((item) => item.name);
  return `还缺 ${gate.blocking.length} 项关键参数：${names.join("、")}。补齐前不会调用测算引擎。`;
}
