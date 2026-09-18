import type { SchemeCalculationInput, SchemeCalculationOutput } from "@/lib/engine/types";
import type { ScenarioAction } from "../copilot/intent";
import { yuanText } from "./narrative";
import type { MetricDeltaRow, ParameterChangeView, ScenarioDeltaView } from "./answer-plan";

const FIELD_LABEL: Record<string, { name: string; unit: string; read: (input: SchemeCalculationInput) => string | null }> = {
  "revenue.freight_price": { name: "运价", unit: "元", read: (input) => firstSegment(input)?.freightPrice ?? null },
  "energy.electricity_price": { name: "电价", unit: "元/kWh", read: (input) => firstSegment(input)?.electricityPrice ?? null },
  "ops.trips_per_vehicle_month": { name: "单车月趟次", unit: "趟", read: (input) => firstSegment(input)?.tripsPerVehicleMonth ?? null },
  "energy.loaded_consumption": { name: "百公里电耗", unit: "kWh", read: (input) => firstSegment(input)?.loadedEnergyConsumption ?? null },
  "vehicle.monthly_rent": { name: "车辆月租", unit: "元", read: (input) => input.vehicle.monthlyRentPerVehicle },
  "vehicle.fleet_size": { name: "车辆数", unit: "台", read: (input) => String(input.fleetSize) },
};

function firstSegment(input: SchemeCalculationInput) {
  for (const route of input.routes) {
    for (const segment of route.segments) return segment;
  }
  return null;
}

function num(value: { toFixed: (digits: number) => string } | null | undefined, digits: number) {
  if (!value) return null;
  const next = Number(value.toFixed(digits));
  return Number.isFinite(next) ? next : null;
}

function rate(delta: number | null, baseline: number | null) {
  if (delta === null || baseline === null || baseline === 0) return null;
  return delta / Math.abs(baseline);
}

function changeLabel(action: ScenarioAction) {
  if (action.operation === "multiply") {
    const pct = Math.round((action.value - 1) * 1000) / 10;
    return `${pct > 0 ? "+" : ""}${pct}%`;
  }
  if (action.operation === "add") return `${action.value > 0 ? "+" : ""}${action.value}`;
  return "调整为设定值";
}

function trimNumber(value: string) {
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  return String(Math.round(n * 10000) / 10000);
}

export function buildScenarioDelta(input: {
  before: SchemeCalculationInput;
  after: SchemeCalculationInput;
  beforeOutput: SchemeCalculationOutput;
  afterOutput: SchemeCalculationOutput;
  actions: ScenarioAction[];
  title: string;
  contextBasis?: string | null;
}): ScenarioDeltaView {
  const rows: MetricDeltaRow[] = [
    row("monthlyRevenue", "月收入", num(input.beforeOutput.monthlyRevenue, 2), num(input.afterOutput.monthlyRevenue, 2), "元"),
    row("monthlyCost", "月成本", num(input.beforeOutput.monthlyTotalCost, 2), num(input.afterOutput.monthlyTotalCost, 2), "元"),
    row("monthlyProfit", "月利润", num(input.beforeOutput.monthlyProfit, 2), num(input.afterOutput.monthlyProfit, 2), "元"),
    row("profitMargin", "利润率", num(input.beforeOutput.profitMargin, 4), num(input.afterOutput.profitMargin, 4), "ratio"),
    row("paybackPeriod", "回收期", input.beforeOutput.firstPositiveMonth, input.afterOutput.firstPositiveMonth, "月"),
  ];
  const parameters: ParameterChangeView[] = [];
  for (const action of input.actions) {
    const field = FIELD_LABEL[action.field_code];
    if (!field) continue;
    const before = field.read(input.before);
    const after = field.read(input.after);
    if (!before || !after) continue;
    parameters.push({
      name: field.name,
      before: trimNumber(before),
      after: trimNumber(after),
      changeLabel: changeLabel(action),
      unit: field.unit,
    });
  }
  return {
    contextLabel: input.contextBasis ? `当前分析基于：${input.contextBasis}` : null,
    lead: lead(input.title, rows),
    rows,
    parameters,
    temporaryScenario: true,
    source: "calculation_engine",
  };
}

function row(
  key: string,
  name: string,
  baseline: number | null,
  next: number | null,
  unit: MetricDeltaRow["unit"],
): MetricDeltaRow {
  const delta = baseline === null || next === null ? null : Number((next - baseline).toFixed(unit === "ratio" ? 4 : 2));
  return {
    key,
    name,
    baseline,
    next,
    delta,
    deltaRate: unit === "元" ? rate(delta, baseline) : null,
    unit,
  };
}

function lead(title: string, rows: MetricDeltaRow[]) {
  const profit = rows.find((item) => item.key === "monthlyProfit");
  if (!profit || profit.baseline === null || profit.next === null || profit.delta === null) {
    return `${title}已由测算引擎重算。`;
  }
  const tone = profit.next >= 0 ? "新情景仍然盈利" : "新情景低于盈亏平衡";
  const rateText = profit.deltaRate === null ? "" : ` / ${(profit.deltaRate * 100).toFixed(1)}%`;
  return `${title}：月利润由 ${yuanText(profit.baseline)} 变为 ${yuanText(profit.next)}，变化 ${yuanText(profit.delta)}${rateText}。${tone}。以上数字来自测算引擎，不是模型估算。`;
}
