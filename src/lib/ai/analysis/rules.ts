import type { SensitivityVariableCode } from "@/lib/engine/types";

export type DemoScenarioChange = {
  variable: SensitivityVariableCode;
  parameter: string;
  percent: number;
};

/**
 * 第一阶段没有独立业务情景条款时使用的演示规则。
 * 只改引擎已有参数，再交由测算引擎重算。DeepSeek 不得改这些百分比。
 */
export const DEMO_SCENARIO_RULES = {
  scenarioSource: "demo_rule" as const,
  conservative: [
    { variable: "freight_price", parameter: "运输单价", percent: -8 },
    { variable: "trips_per_vehicle_month", parameter: "日均趟次", percent: -10 },
    { variable: "electricity_price", parameter: "充电单价", percent: 10 },
  ] satisfies DemoScenarioChange[],
  optimistic: [
    { variable: "trips_per_vehicle_month", parameter: "日均趟次", percent: 8 },
    { variable: "electricity_price", parameter: "充电单价", percent: -8 },
  ] satisfies DemoScenarioChange[],
};

export const ANALYSIS_SENSITIVITY_VARIABLES: Array<{ code: SensitivityVariableCode; name: string }> = [
  { code: "freight_price", name: "运输单价" },
  { code: "trips_per_vehicle_month", name: "日均趟次" },
  { code: "electricity_price", name: "充电单价" },
  { code: "loaded_energy_consumption", name: "百公里电耗" },
  { code: "monthly_rent_per_vehicle", name: "车辆租赁成本" },
];

export const COST_GROUPS: Array<{ code: string; name: string; codes: string[] }> = [
  { code: "energy", name: "能源成本", codes: ["energy_cost"] },
  { code: "driver", name: "司机成本", codes: ["driver_cost"] },
  { code: "vehicle", name: "车辆折旧/租赁", codes: ["vehicle_cost", "finance_cost"] },
  {
    code: "maintenance",
    name: "维修保养",
    codes: ["maintenance_fee", "tire_cost", "consumable_fee", "heater_fee", "inspection_fee", "road_maintenance_fee"],
  },
  { code: "insurance", name: "保险", codes: ["insurance_fee"] },
  { code: "toll", name: "路桥费", codes: ["toll", "parking_fee"] },
  { code: "management", name: "管理成本", codes: ["management_fee"] },
  { code: "other", name: "其他成本", codes: ["loading_unloading", "information_fee", "tax_cost"] },
];

export function scenarioNote(): string {
  const conservative = DEMO_SCENARIO_RULES.conservative.map((item) => `${item.parameter}${item.percent}%`).join("、");
  const optimistic = DEMO_SCENARIO_RULES.optimistic.map((item) => `${item.parameter}${item.percent}%`).join("、");
  return `保守/乐观方案使用演示规则重算（scenarioSource=demo_rule），不是模型估算。保守：${conservative}。乐观：${optimistic}。基准方案为当前参数。`;
}
