import { calculateScheme } from "@/lib/engine/calculate";
import { applyPercentChanges, runSensitivity } from "@/lib/engine/sensitivity";
import type { MonthlyCashFlow, SchemeCalculationInput, SchemeCalculationOutput } from "@/lib/engine/types";
import { AI_ANALYSIS_REPORT_SCHEMA_VERSION } from "../schema/versions";
import { writeSummary, yuanText } from "./narrative";
import {
  ANALYSIS_SENSITIVITY_VARIABLES,
  COST_GROUPS,
  DEMO_SCENARIO_RULES,
  scenarioNote,
  type DemoScenarioChange,
} from "./rules";
import {
  DEMO_ANALYSIS_NOTICE,
  TREND_UNAVAILABLE_MESSAGE,
  type AIAnalysisReport,
  type AnalysisAssumptionInput,
  type AnalysisRecommendation,
  type AnalysisRisk,
  type AssumptionItem,
  type CostStructureItem,
  type ImpactLevel,
  type KeyMetric,
  type MetricStatus,
  type RiskLevel,
  type ScenarioComparison,
  type SensitivityPoint,
  type TrendPoint,
} from "./schema";

export type BuildAnalysisOptions = {
  question?: string;
  assumptions?: unknown;
};

function money(value: { toFixed: (digits: number) => string } | null | undefined): number | null {
  if (!value) return null;
  const next = Number(value.toFixed(2));
  return Number.isFinite(next) ? next : null;
}

function ratio(value: { toFixed: (digits: number) => string } | null | undefined): number | null {
  if (!value) return null;
  const next = Number(value.toFixed(4));
  return Number.isFinite(next) ? next : null;
}

function profitStatus(profit: number, margin: number | null): { status: MetricStatus; statusLabel: string } {
  if (profit < 0) return { status: "below_breakeven", statusLabel: "低于盈亏平衡" };
  if (margin === null) return { status: "pending", statusLabel: "待确认" };
  if (margin < 0.08) return { status: "near_breakeven", statusLabel: "接近盈亏平衡点" };
  return { status: "normal", statusLabel: "盈利" };
}

function pendingMetric(key: string, name: string, unit: KeyMetric["unit"]): KeyMetric {
  return { key, name, value: null, unit, source: "calculation_engine", status: "pending", statusLabel: "待确认" };
}

function buildMetrics(input: SchemeCalculationInput, output: SchemeCalculationOutput): KeyMetric[] {
  const profit = money(output.monthlyProfit) ?? 0;
  const revenue = money(output.monthlyRevenue) ?? 0;
  const cost = money(output.monthlyTotalCost) ?? 0;
  const margin = ratio(output.profitMargin);
  const tone = profitStatus(profit, margin);
  const fleet = input.fleetSize > 0 ? input.fleetSize : 0;
  const vehicleProfit = money(output.vehicleMonthlyProfit) ?? (fleet > 0 ? Number((profit / fleet).toFixed(2)) : null);
  const payback = output.firstPositiveMonth;
  const metrics: KeyMetric[] = [
    { key: "monthlyProfit", name: "月利润", value: profit, unit: "元", source: "calculation_engine", ...tone },
    { key: "monthlyRevenue", name: "月营业收入", value: revenue, unit: "元", source: "calculation_engine", status: "normal", statusLabel: "引擎结果" },
    { key: "monthlyCost", name: "月运营成本", value: cost, unit: "元", source: "calculation_engine", status: "normal", statusLabel: "引擎结果" },
    margin === null
      ? pendingMetric("profitMargin", "利润率", "ratio")
      : { key: "profitMargin", name: "利润率", value: margin, unit: "ratio", source: "calculation_engine", ...tone },
    output.irr
      ? { key: "irr", name: "内部收益率", value: ratio(output.irr), unit: "ratio", source: "calculation_engine", status: "normal", statusLabel: "引擎结果" }
      : pendingMetric("irr", "内部收益率", "ratio"),
    payback === null
      ? pendingMetric("paybackPeriod", "投资回收期", "月")
      : {
          key: "paybackPeriod",
          name: "投资回收期",
          value: payback,
          unit: "月",
          source: "calculation_engine",
          status: "normal",
          statusLabel: payback === 0 ? "无需回收初始投资" : "引擎结果",
        },
  ];
  if (vehicleProfit !== null) {
    metrics.push({
      key: "vehicleProfit",
      name: "单车月利润",
      value: vehicleProfit,
      unit: "元",
      source: "calculation_engine",
      status: vehicleProfit < 0 ? "below_breakeven" : "normal",
      statusLabel: vehicleProfit < 0 ? "低于盈亏平衡" : "引擎结果",
    });
  }
  metrics.push({
    key: "cumulativeCashFlow",
    name: "累计现金流",
    value: money(output.cumulativeCashFlow) ?? 0,
    unit: "元",
    source: "calculation_engine",
    status: "normal",
    statusLabel: "引擎结果",
  });
  return metrics.slice(0, 8);
}

function buildCost(output: SchemeCalculationOutput): CostStructureItem[] {
  const amounts = new Map<string, number>();
  for (const item of output.costBreakdown) {
    amounts.set(item.code, money(item.amount) ?? 0);
  }
  const used = new Set<string>();
  const groups = COST_GROUPS.map((group) => {
    let value = 0;
    for (const code of group.codes) {
      if (!amounts.has(code)) continue;
      value += amounts.get(code) || 0;
      used.add(code);
    }
    return { code: group.code, name: group.name, value: Number(value.toFixed(2)), percentage: 0 };
  });
  let other = groups.find((item) => item.code === "other");
  if (!other) {
    other = { code: "other", name: "其他成本", value: 0, percentage: 0 };
    groups.push(other);
  }
  for (const [code, value] of amounts) {
    if (used.has(code)) continue;
    other.value = Number((other.value + value).toFixed(2));
  }
  const total = groups.reduce((sum, item) => sum + item.value, 0);
  return groups
    .map((item) => ({
      ...item,
      percentage: total > 0 ? Number(((item.value / total) * 100).toFixed(1)) : 0,
    }))
    .filter((item) => item.value !== 0 || item.code === "energy");
}

function scenarioFromOutput(
  name: string,
  output: SchemeCalculationOutput,
  source: ScenarioComparison["scenarioSource"],
  adjustments: DemoScenarioChange[],
): ScenarioComparison {
  return {
    name,
    revenue: money(output.monthlyRevenue) ?? 0,
    cost: money(output.monthlyTotalCost) ?? 0,
    profit: money(output.monthlyProfit) ?? 0,
    roi: ratio(output.profitMargin),
    paybackPeriod: output.firstPositiveMonth,
    scenarioSource: source,
    adjustments: adjustments.map((item) => ({ parameter: item.parameter, percent: item.percent })),
  };
}

function buildScenarios(input: SchemeCalculationInput, baseline: SchemeCalculationOutput): ScenarioComparison[] {
  const rows: ScenarioComparison[] = [
    scenarioFromOutput("基准方案", baseline, "calculation_engine", []),
  ];
  for (const [name, changes] of [
    ["保守方案", DEMO_SCENARIO_RULES.conservative],
    ["乐观方案", DEMO_SCENARIO_RULES.optimistic],
  ] as const) {
    try {
      const patched = applyPercentChanges(input, changes);
      rows.push(scenarioFromOutput(name, calculateScheme(patched), "demo_rule", [...changes]));
    } catch {
      continue;
    }
  }
  return rows;
}

function levelFromDrop(drop: number, profitTurnsNegative: boolean): RiskLevel {
  if (profitTurnsNegative || drop >= 0.2) return "high";
  if (drop >= 0.08) return "medium";
  return "low";
}

function impactRank(index: number): ImpactLevel {
  if (index === 0) return "high";
  if (index <= 2) return "medium";
  return "low";
}

function buildSensitivity(input: SchemeCalculationInput): SensitivityPoint[] {
  const points: SensitivityPoint[] = [];
  for (const variable of ANALYSIS_SENSITIVITY_VARIABLES) {
    try {
      const rows = runSensitivity({
        input,
        variable: variable.code,
        changeMode: "PERCENT",
        minChange: "-20",
        maxChange: "20",
        step: "10",
      });
      for (const row of rows) {
        points.push({
          parameter: variable.name,
          parameterKey: variable.code,
          change: Number(row.parameterChange),
          profit: Number(row.monthlyProfit),
          profitChange: Number(row.profitDelta),
          impactLevel: "low",
        });
      }
    } catch {
      continue;
    }
  }
  const names = [...new Set(points.map((item) => item.parameter))];
  const ranked = names
    .map((parameter) => {
      const related = points.filter((item) => item.parameter === parameter && item.change !== 0);
      const swing = related.reduce((max, item) => Math.max(max, Math.abs(item.profitChange)), 0);
      return { parameter, swing };
    })
    .sort((a, b) => b.swing - a.swing);
  const rank = new Map(ranked.map((item, index) => [item.parameter, impactRank(index)]));
  return points.map((item) => ({ ...item, impactLevel: rank.get(item.parameter) || "low" }));
}

function pointAt(points: SensitivityPoint[], parameter: string, change: number) {
  return points.find((item) => item.parameter === parameter && item.change === change);
}

function buildRisks(points: SensitivityPoint[], baselineProfit: number): AnalysisRisk[] {
  const names = [...new Set(points.map((item) => item.parameter))];
  const risks: AnalysisRisk[] = [];
  for (const parameter of names) {
    const down = pointAt(points, parameter, -10) || pointAt(points, parameter, -20);
    const up = pointAt(points, parameter, 10) || pointAt(points, parameter, 20);
    const adverse = [down, up]
      .filter((item): item is SensitivityPoint => Boolean(item))
      .sort((a, b) => a.profitChange - b.profitChange)[0];
    if (!adverse || adverse.profitChange >= 0) continue;
    const drop = baselineProfit === 0 ? 1 : -adverse.profitChange / Math.abs(baselineProfit);
    const level = levelFromDrop(drop, baselineProfit > 0 && adverse.profit < 0);
    if (level === "low" && adverse.impactLevel === "low") continue;
    const direction = adverse.change < 0 ? "下降" : "上升";
    risks.push({
      name: `${parameter}风险`,
      level,
      description: `当前方案对${parameter}较敏感，该判断来自测算引擎的参数重算。`,
      affectedMetrics: ["月利润", "利润率"],
      evidence: `${parameter}${direction} ${Math.abs(adverse.change)}% 后，月利润变化 ${adverse.profitChange.toFixed(2)} 元。`,
      suggestion: `核实${parameter}的合同或现场取值，不要用估算值覆盖引擎结果。`,
    });
  }
  if (baselineProfit < 0) {
    risks.unshift({
      name: "盈利风险",
      level: "high",
      description: "按当前参数，测算引擎给出的月利润为负。",
      affectedMetrics: ["月利润", "利润率"],
      evidence: `引擎月利润 ${baselineProfit.toFixed(2)} 元，低于盈亏平衡。`,
      suggestion: "先核对运价、趟次和主要成本，再决定是否推进。",
    });
  }
  const weight = { high: 0, medium: 1, low: 2 };
  return risks.sort((a, b) => weight[a.level] - weight[b.level]).slice(0, 4);
}

export function buildTrend(cashFlows: MonthlyCashFlow[], breakevenMonth: number | null): AIAnalysisReport["trend"] {
  const operating = cashFlows.filter((row) => row.monthIndex > 0);
  if (operating.length < 2) {
    return { available: false, message: TREND_UNAVAILABLE_MESSAGE, breakevenMonth, points: [] };
  }
  const points: TrendPoint[] = operating.slice(0, 36).map((row) => {
    const revenue = money(row.revenueCashIn) ?? 0;
    const cost = Number(
      (
        (money(row.operatingCashOut) ?? 0) +
        (money(row.vehicleCashOut) ?? 0) +
        (money(row.financingCashFlow) ?? 0) +
        (money(row.taxCashOut) ?? 0)
      ).toFixed(2),
    );
    return {
      monthIndex: row.monthIndex,
      revenue,
      cost,
      profit: money(row.currentNetCashFlow) ?? 0,
      cumulativeCashFlow: money(row.cumulativeCashFlow) ?? 0,
    };
  });
  const hasSignal = points.some((item) => item.revenue !== 0 || item.cost !== 0 || item.profit !== 0);
  if (!hasSignal) {
    return { available: false, message: TREND_UNAVAILABLE_MESSAGE, breakevenMonth, points: [] };
  }
  return { available: true, message: null, breakevenMonth, points };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function textOf(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeAssumptionSeeds(input: unknown): AnalysisAssumptionInput[] {
  if (!Array.isArray(input)) return [];
  return input.filter(isRecord).map((item) => ({
    field_code: textOf(item.field_code),
    field_name: textOf(item.field_name),
    value: textOf(item.value),
    unit: textOf(item.unit) || null,
    label: textOf(item.label),
    status: textOf(item.status),
    source_label: textOf(item.source_label),
  }));
}

function assumptionLabel(item: AnalysisAssumptionInput): string {
  const name = item.field_name || item.field_code || "未命名字段";
  return name;
}

function buildAssumptions(seeds: AnalysisAssumptionInput[], output: SchemeCalculationOutput): AIAnalysisReport["assumptions"] {
  const confirmed: AssumptionItem[] = [];
  const calculated: AssumptionItem[] = [];
  const missing: AssumptionItem[] = [];
  for (const item of seeds) {
    const name = assumptionLabel(item);
    const status = `${item.status || ""} ${item.source_label || ""}`;
    const empty = !item.value || item.value === "未写入引擎";
    if (empty || /missing|缺失|待确认|pending/i.test(status)) {
      missing.push({ tag: "missing", label: `${name}：待确认，未用估算值补齐` });
      continue;
    }
    const detail = `${name}：${item.value}${item.unit || ""}`;
    if (/confirmed|已确认/i.test(status)) {
      confirmed.push({ tag: "confirmed", label: detail });
    } else {
      calculated.push({ tag: "calculated", label: `${detail}（${item.source_label || item.status || "参与测算"}）` });
    }
  }
  calculated.push(
    { tag: "calculated", label: `月利润 ${yuanText(money(output.monthlyProfit) ?? 0)}，由测算引擎计算` },
    { tag: "calculated", label: `月营业收入 ${yuanText(money(output.monthlyRevenue) ?? 0)}，由测算引擎计算` },
  );
  if (!output.irr) missing.push({ tag: "missing", label: "内部收益率：测算引擎未能求解，未填入估算值" });
  if (!output.profitMargin) missing.push({ tag: "missing", label: "利润率：测算引擎无法计算，未填入估算值" });
  if (!confirmed.length) {
    confirmed.push({ tag: "confirmed", label: "当前方案已提交测算引擎的参数，作为基准方案输入" });
  }
  return {
    confirmed: confirmed.slice(0, 8),
    calculated: calculated.slice(0, 8),
    aiInferred: [{ tag: "ai_inferred", label: "综合结论、风险说明和建议由分析层归纳，不新增财务数字" }],
    missing: missing.slice(0, 8),
  };
}

function buildRecommendations(input: {
  topParameter: string | null;
  topCost: string | null;
  topCostShare: number;
  conservativeProfit: number | null;
  missing: AssumptionItem[];
}): AnalysisRecommendation[] {
  const rows: AnalysisRecommendation[] = [];
  if (input.topParameter) {
    rows.push({
      priority: rows.length + 1,
      action: `核实${input.topParameter}`,
      reason: `${input.topParameter}对月利润的影响最大，依据是测算引擎的 ±10%/±20% 重算。`,
      affectedMetric: "月利润",
    });
  }
  if (input.topCost) {
    rows.push({
      priority: rows.length + 1,
      action: `验证${input.topCost}`,
      reason: `${input.topCost}占成本 ${input.topCostShare.toFixed(1)}%，建议核对合同价或台账，而不是直接改结果。`,
      affectedMetric: "月运营成本",
    });
  }
  rows.push({
    priority: rows.length + 1,
    action: "对照保守方案做压力测试",
    reason:
      input.conservativeProfit === null
        ? "保守方案暂未生成，不影响当前基准结果。"
        : `演示规则下保守方案月利润为 ${yuanText(input.conservativeProfit)}，该数字由测算引擎重算。`,
    affectedMetric: "月利润",
  });
  if (input.missing.length) {
    rows.push({
      priority: rows.length + 1,
      action: "补充待确认数据",
      reason: input.missing[0]?.label || "存在未确认字段。",
      affectedMetric: "测算完整性",
    });
  }
  return rows.slice(0, 5).map((item, index) => ({ ...item, priority: index + 1 }));
}

export function buildEngineAnalysisReport(input: SchemeCalculationInput, options: BuildAnalysisOptions = {}): AIAnalysisReport {
  const output = calculateScheme(input);
  const profit = money(output.monthlyProfit) ?? 0;
  const margin = ratio(output.profitMargin);
  const costStructure = buildCost(output);
  const largest = [...costStructure].sort((a, b) => b.value - a.value)[0];
  const controllable = costStructure.filter((item) => ["能源成本", "司机成本", "路桥费", "维修保养"].includes(item.name));
  const optimize = [...controllable].sort((a, b) => b.value - a.value)[0] || largest;
  const scenarios = buildScenarios(input, output);
  const sensitivity = buildSensitivity(input);
  const ranked = [...new Set(sensitivity.map((item) => item.parameter))];
  const swings = ranked
    .map((parameter) => ({
      parameter,
      swing: sensitivity
        .filter((item) => item.parameter === parameter && item.change !== 0)
        .reduce((max, item) => Math.max(max, Math.abs(item.profitChange)), 0),
    }))
    .sort((a, b) => b.swing - a.swing);
  const topParameter = swings[0]?.swing ? swings[0].parameter : null;
  const topPoint = topParameter
    ? sensitivity
        .filter((item) => item.parameter === topParameter && item.change !== 0)
        .sort((a, b) => Math.abs(b.profitChange) - Math.abs(a.profitChange))[0]
    : undefined;
  const risks = buildRisks(sensitivity, profit);
  const assumptions = buildAssumptions(normalizeAssumptionSeeds(options.assumptions), output);
  const conservative = scenarios.find((item) => item.name === "保守方案");
  const summary = writeSummary({
    profit,
    revenue: money(output.monthlyRevenue) ?? 0,
    cost: money(output.monthlyTotalCost) ?? 0,
    margin,
    topCost: largest && largest.value > 0 ? largest.name : null,
    topParameter,
    highRisks: risks.filter((item) => item.level === "high").map((item) => item.name),
    question: options.question,
  });
  const report: AIAnalysisReport = {
    schemaVersion: AI_ANALYSIS_REPORT_SCHEMA_VERSION,
    mode: "demo",
    notice: DEMO_ANALYSIS_NOTICE,
    scenarioSource: "demo_rule",
    scenarioNote: scenarioNote(),
    summary: { title: "AI综合结论", ...summary },
    keyMetrics: buildMetrics(input, output),
    costStructure,
    costInsight: {
      largest: largest && largest.value > 0 ? largest.name : null,
      anomaly: largest && largest.percentage >= 40 ? `${largest.name}占比 ${largest.percentage.toFixed(1)}%，高于其余成本项。` : null,
      optimize: optimize && optimize.value > 0 ? optimize.name : null,
    },
    trend: buildTrend(output.cashFlows, output.firstPositiveMonth),
    scenarios,
    sensitivity,
    sensitivityHighlight: topParameter
      ? {
          parameter: topParameter,
          reason: topPoint
            ? `${topParameter}变动 ${topPoint.change}% 时，月利润变化 ${topPoint.profitChange.toFixed(2)} 元，为当前重算中影响最大的参数。`
            : `${topParameter}是当前重算中影响最大的参数。`,
        }
      : null,
    risks,
    assumptions,
    recommendations: buildRecommendations({
      topParameter,
      topCost: largest && largest.value > 0 ? largest.name : null,
      topCostShare: largest?.percentage ?? 0,
      conservativeProfit: conservative ? conservative.profit : null,
      missing: assumptions.missing,
    }),
    visualizations: [
      { type: "kpi", title: "核心指标", dataSource: "keyMetrics" },
      { type: "cost_structure", title: "成本结构", dataSource: "costStructure" },
      { type: "scenario_comparison", title: "方案对比", dataSource: "scenarios" },
      { type: "profit_trend", title: "收益趋势", dataSource: "trend" },
      { type: "cashflow", title: "累计现金流", dataSource: "trend" },
      { type: "sensitivity", title: "敏感性分析", dataSource: "sensitivity" },
      { type: "risk", title: "风险", dataSource: "risks" },
    ],
  };
  return report;
}
