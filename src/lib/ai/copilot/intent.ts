export type ScenarioAction = {
  field_code: string;
  scope: "all_routes" | "project";
  operation: "multiply" | "set" | "add";
  value: number;
};

export type ScenarioIntent = {
  kind: "explain" | "scenario" | "due_diligence" | "unmatched";
  title: string;
  actions: ScenarioAction[];
  parser: "rule" | "llm" | "fallback" | "none";
};

function pct(question: string, keyword: string) {
  const m = question.match(new RegExp(`${keyword}[^\\d]{0,8}(\\d+(?:\\.\\d+)?)\\s*%`));
  return m ? Number(m[1]) : null;
}

export function parseIntentRuleBased(question: string): ScenarioIntent {
  const q = question.replace(/\s+/g, "");
  if (/尽调|还需要|下一步/.test(q)) {
    return { kind: "due_diligence", title: "下一步尽调", actions: [], parser: "rule" };
  }
  if (/利润率不高|为什么|最大成本|最敏感/.test(q)) {
    return { kind: "explain", title: "解释测算结果", actions: [], parser: "rule" };
  }
  if (/保守方案/.test(q)) {
    return {
      kind: "scenario",
      title: "保守方案",
      parser: "rule",
      actions: [
        { field_code: "revenue.freight_price", scope: "all_routes", operation: "multiply", value: 0.95 },
        { field_code: "energy.electricity_price", scope: "all_routes", operation: "multiply", value: 1.1 },
        { field_code: "ops.trips_per_vehicle_month", scope: "all_routes", operation: "multiply", value: 0.9 },
      ],
    };
  }
  const freightPct = pct(question, "运价") ?? (/运价下降5%|运价下调5%/.test(q) ? 5 : null);
  if (freightPct != null && /降|下/.test(q)) {
    return {
      kind: "scenario",
      title: `运价-${freightPct}%`,
      parser: "rule",
      actions: [{ field_code: "revenue.freight_price", scope: "all_routes", operation: "multiply", value: 1 - freightPct / 100 }],
    };
  }
  const power = question.match(/电价[^0-9]{0,6}(\d+(?:\.\d+)?)/);
  if (power && /电价/.test(q)) {
    return {
      kind: "scenario",
      title: `电价${power[1]}元`,
      parser: "rule",
      actions: [{ field_code: "energy.electricity_price", scope: "all_routes", operation: "set", value: Number(power[1]) }],
    };
  }
  const trucks = question.match(/车辆[^0-9]{0,6}(\d+)/);
  if (trucks && /减少|少/.test(q)) {
    return {
      kind: "scenario",
      title: `车辆-${trucks[1]}台`,
      parser: "rule",
      actions: [{ field_code: "vehicle.fleet_size", scope: "project", operation: "add", value: -Number(trucks[1]) }],
    };
  }
  if (/车辆减少10台/.test(q)) {
    return {
      kind: "scenario",
      title: "车辆-10台",
      parser: "rule",
      actions: [{ field_code: "vehicle.fleet_size", scope: "project", operation: "add", value: -10 }],
    };
  }
  const trips = question.match(/少\s*(\d+(?:\.\d+)?)\s*趟|趟次.*?(\d+(?:\.\d+)?)/);
  if (trips) {
    const n = Number(trips[1] || trips[2] || 0.3);
    return {
      kind: "scenario",
      title: `趟次变化`,
      parser: "rule",
      actions: [{ field_code: "ops.trips_per_vehicle_month", scope: "all_routes", operation: "add", value: -n }],
    };
  }
  return { kind: "unmatched", title: "未识别场景", actions: [], parser: "none" };
}
