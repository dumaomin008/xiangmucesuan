import { calculateScheme } from "@/lib/engine/calculate";
import { runSensitivity } from "@/lib/engine/sensitivity";
import type { SchemeCalculationInput, SchemeCalculationOutput } from "@/lib/engine/types";
import { AI_RISK_RULE_VERSION } from "../schema/versions";
import type { ParameterRecord } from "../schema/types";

export type RiskItem = {
  risk_code: string;
  risk_name: string;
  level: "高" | "中" | "低";
  evidence: string;
  affected_metrics: string[];
  trigger_rule: string;
  recommendation: string;
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function num(value: string | number | null | undefined) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function levelFromDrop(drop: number, high = 0.04, mid = 0.015): "高" | "中" | "低" {
  if (drop >= high) return "高";
  if (drop >= mid) return "中";
  return "低";
}

export function evaluateRisks(input: {
  calcInput: SchemeCalculationInput;
  output: SchemeCalculationOutput;
  parameters?: ParameterRecord[];
}): { status: "ready"; rule_version: string; items: RiskItem[] } {
  const items: RiskItem[] = [];
  const baselineMargin = input.output.profitMargin ? Number(input.output.profitMargin.toString()) : 0;

  const freight = runSensitivity({
    input: input.calcInput,
    variable: "freight_price",
    changeMode: "PERCENT",
    minChange: "-10",
    maxChange: "0",
    step: "10",
  });
  const freightDown = freight.find((row) => row.parameterChange === "-10");
  if (freightDown) {
    const nextMargin = num(freightDown.profitMargin);
    const drop = baselineMargin - nextMargin;
    items.push({
      risk_code: "RISK-01",
      risk_name: "运价风险",
      level: levelFromDrop(drop, 0.05, 0.02),
      evidence: `运价下降10%后利润率从 ${(baselineMargin * 100).toFixed(2)}% 变为 ${(nextMargin * 100).toFixed(2)}%，利润变化 ${freightDown.profitDelta} 元。`,
      affected_metrics: ["收入", "利润", "利润率"],
      trigger_rule: "demo_risk_v1: freight -10% via Sensitivity Engine",
      recommendation: "核实合同运价锁定期和调价条款，避免把讨论价当作执行价。",
    });
  }

  const power = runSensitivity({
    input: input.calcInput,
    variable: "electricity_price",
    changeMode: "PERCENT",
    minChange: "0",
    maxChange: "20",
    step: "20",
  });
  const powerUp = power.find((row) => row.parameterChange === "20");
  if (powerUp) {
    const drop = baselineMargin - num(powerUp.profitMargin);
    items.push({
      risk_code: "RISK-02",
      risk_name: "电价风险",
      level: levelFromDrop(drop, 0.03, 0.01),
      evidence: `电价上涨20%后利润变化 ${powerUp.profitDelta} 元，利润率 ${(num(powerUp.profitMargin) * 100).toFixed(2)}%。`,
      affected_metrics: ["能源成本", "利润"],
      trigger_rule: "demo_risk_v1: electricity +20% via Sensitivity Engine",
      recommendation: "确认充电价格是否锁定，以及场站电价波动区间。",
    });
  }

  const trips = runSensitivity({
    input: input.calcInput,
    variable: "trips_per_vehicle_month",
    changeMode: "PERCENT",
    minChange: "-20",
    maxChange: "0",
    step: "20",
  });
  const tripsDown = trips.find((row) => row.parameterChange === "-20");
  if (tripsDown) {
    const drop = baselineMargin - num(tripsDown.profitMargin);
    items.push({
      risk_code: "RISK-03",
      risk_name: "趟次风险",
      level: levelFromDrop(drop, 0.04, 0.015),
      evidence: `单车月趟数下降20%后利润变化 ${tripsDown.profitDelta} 元。`,
      affected_metrics: ["收入", "车辆利用率", "单位固定成本"],
      trigger_rule: "demo_risk_v1: trips -20% via Sensitivity Engine",
      recommendation: "调取近3个月台账，核对有效趟次与装卸等待。",
    });
  }

  const patched = clone(input.calcInput);
  patched.fleetSize = Math.max(1, Math.round(patched.fleetSize * 0.85));
  patched.vehicle.fleetSize = patched.fleetSize;
  const fewerTrucks = calculateScheme(patched);
  const volumePerTruckBase = Number(input.output.monthlyVolume.div(input.calcInput.fleetSize || 1).toString());
  const volumePerTruckNew = Number(fewerTrucks.monthlyVolume.div(patched.fleetSize).toString());
  const fewerImprovesProfit = fewerTrucks.monthlyProfit.gt(input.output.monthlyProfit);
  items.push({
    risk_code: "RISK-04",
    risk_name: "运量风险",
    level: fewerImprovesProfit ? "中" : "低",
    evidence: `当前 ${input.calcInput.fleetSize} 台车对应月运量 ${input.output.monthlyVolume.toFixed(2)}；若减至 ${patched.fleetSize} 台，单车运量由 ${volumePerTruckBase.toFixed(2)} 变为 ${volumePerTruckNew.toFixed(2)}，利润变化 ${fewerTrucks.monthlyProfit.minus(input.output.monthlyProfit).toFixed(2)} 元。`,
    affected_metrics: ["运量", "车辆规模", "固定成本"],
    trigger_rule: "demo_risk_v1: fleet vs monthly volume",
    recommendation: "用真实日运量和保底量校验当前车队是否偏大。",
  });

  const emptyRatio = Number(input.calcInput.ruleSet.energyMileage.emptyRatio || "0");
  items.push({
    risk_code: "RISK-05",
    risk_name: "空驶风险",
    level: emptyRatio >= 0.4 ? "高" : emptyRatio >= 0.25 ? "中" : "低",
    evidence: `规则集空驶里程系数 ${emptyRatio}。`,
    affected_metrics: ["能耗成本", "里程"],
    trigger_rule: "demo_risk_v1: ruleSet.energyMileage.emptyRatio",
    recommendation: "现场核对空驶路段和回程载货机会。",
  });

  const params = input.parameters || [];
  const weak = params.filter((p) => ["missing", "conflict", "reference", "default"].includes(p.status));
  const weakRate = params.length ? weak.length / params.length : 0;
  items.push({
    risk_code: "RISK-06",
    risk_name: "数据质量风险",
    level: weakRate >= 0.4 ? "高" : weakRate >= 0.2 ? "中" : "低",
    evidence: `参数中缺失/冲突/参考/默认占比 ${(weakRate * 100).toFixed(0)}%（${weak.length}/${params.length || 0}）。`,
    affected_metrics: ["结果可信度"],
    trigger_rule: "demo_risk_v1: weak parameter share",
    recommendation: "优先确认 P0 商务字段，参考值不得当作合同事实。",
  });

  const irr = input.output.irr ? Number(input.output.irr.toString()) : null;
  const payback = input.output.firstPositiveMonth;
  items.push({
    risk_code: "RISK-07",
    risk_name: "投资回收风险",
    level: payback == null || irr == null ? "高" : payback > 24 || irr < 0.08 ? "中" : "低",
    evidence: `首次现金流转正：${payback == null ? "测算期内未转正" : `第${payback}月`}；IRR：${irr == null ? input.output.irrReason || "无法计算" : `${(irr * 100).toFixed(2)}%`}。`,
    affected_metrics: ["现金流", "IRR", "回收期"],
    trigger_rule: "demo_risk_v1: firstPositiveMonth / irr",
    recommendation: "复核首付、租金和回款周期，避免把乐观回款当作既定事实。",
  });

  return { status: "ready", rule_version: AI_RISK_RULE_VERSION || "demo_risk_v1", items };
}
