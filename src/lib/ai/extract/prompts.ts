export const EXTRACT_PROMPT_VERSION = "extract_v1";
export const COPILOT_PROMPT_VERSION = "copilot_explain_v1";
export const INTENT_PROMPT_VERSION = "scenario_intent_v1";

export const EXTRACT_SYSTEM_PROMPT = `你是项目测算资料结构化助手。只从用户提供的尽调资料中提取事实，输出 JSON。

硬性规则：
1. 必须输出符合给定 schema 的 JSON，不要 Markdown。
2. 不得编造运价、合同运量、客户承诺、未知起终点。
3. 资料中的“预计/大约/可能/讨论”只能标 status=extracted，不得标 confirmed。
4. 同一字段多值必须进入 conflicts，不得自动采用。
5. 无法判断的字段标 missing，宁可缺失也不要猜。
6. 不得计算收入、成本、利润、IRR、现金流。
7. field_code 只能使用给定字典。
8. 单位换算不确定时保持 raw_value 并标 missing。`;

export function buildExtractUserPrompt(input: {
  projectName: string;
  customerName: string;
  documents: Array<{ sourceRef: string; sourceType: string; text: string }>;
  fieldCodes: string[];
}) {
  const docs = input.documents
    .map((doc) => `### ${doc.sourceRef}\n来源类型: ${doc.sourceType}\n${doc.text.slice(0, 12000)}`)
    .join("\n\n");
  return `项目主数据：${input.projectName} / 客户 ${input.customerName}

允许的 field_code：
${input.fieldCodes.join(", ")}

请抽取：
{
  "project": { "name": string|null, "customer": string|null, "region": string|null },
  "routes": [{ "sort_no": number, "route_name": string, "origin_name": string, "destination_name": string, "distance_km": string|null, "volume_value": string|null, "volume_unit": string|null, "trips_per_day": string|null, "trips_per_vehicle_month": string|null, "vehicle_count": string|null, "cargo_name": string|null, "freight_price": string|null, "freight_price_unit": "PER_TON"|"PER_TRIP"|"PER_TON_KM"|null, "load_ton": string|null, "toll_per_trip": string|null, "loading_unloading_fee": string|null, "information_fee": string|null, "driver_cost_per_trip": string|null, "status": "pending", "enabled": true }],
  "parameters": [{ "field_code": string, "value": string|null, "unit": string|null, "raw_value": string|null, "source_type": "due_diligence"|"meeting"|"chat"|"free_text", "source_ref": string, "confidence": number, "status": "extracted"|"missing"|"conflict", "editable": true, "reference_meta": null, "updated_by": "AI", "route_id": string|null }],
  "conflicts": [{ "field_code": string, "route_id": string|null, "candidates": [{"value": string, "unit": string|null, "source_type": string, "source_ref": string, "raw_value": string|null}], "resolved_value": null, "status": "open" }]
}

资料：
${docs}`;
}

export const INTENT_SYSTEM_PROMPT = `你是测算场景意图解析器。只输出 JSON ScenarioPatch，不要解释，不要计算利润。
field_code 只能是：revenue.freight_price, energy.electricity_price, ops.trips_per_vehicle_month, vehicle.fleet_size, energy.loaded_consumption, vehicle.monthly_rent。
operation 只能是 multiply | set | add。
scope 只能是 all_routes | project。`;

export function buildIntentUserPrompt(question: string) {
  return `用户问题：${question}

输出：
{
  "kind": "explain" | "scenario" | "due_diligence",
  "title": string,
  "actions": [{ "field_code": string, "scope": "all_routes"|"project", "operation": "multiply"|"set"|"add", "value": number }]
}

示例：运价下降5% → multiply revenue.freight_price 0.95
电价涨到1元 → set energy.electricity_price 1
车辆减少10台 → add vehicle.fleet_size -10`;
}

export const EXPLAIN_SYSTEM_PROMPT = `你是测算结果解释助手。只能使用系统提供的 Calculation Engine JSON 中已经出现的数字。禁止编造或改写 KPI。用中文简洁解释原因、风险和下一步。`;
