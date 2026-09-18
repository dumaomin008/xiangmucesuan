/**
 * AI 业务助手工具层：真正读写项目/方案/引擎，AI 只决定调用什么。
 * 禁止在本层用 LLM 估算利润等 KPI。
 */
import { calculateProject, runSensitivity, type SchemeCalculationInput } from "@/calculation";
import type { DemoRepositories } from "../bootstrap";
import type { DemoCalcScenario, DemoProjectContext, DemoScenarioResults } from "../types";
import { cloneJson } from "../utils";
import { analyzeScenarioLocal, type DemoAiInsight } from "./analyze";
import {
  applyParamPatches,
  listSegmentParamLocations,
  snapshotParams,
  type AssistantParamKey,
  type ParamPatch,
  type SegmentParamLocation,
} from "./params";

export type ToolTrace = {
  tool: string;
  ok: boolean;
  detail?: string;
};

function money(n: number | string | null | undefined) {
  if (n === null || n === undefined || n === "") return "—";
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  return v.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function pct(n: number | string | null | undefined) {
  if (n === null || n === undefined || n === "") return "—";
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  return `${(v * 100).toFixed(2)}%`;
}

export function getProjectContextTool(
  repos: DemoRepositories,
  projectId: string,
): { project: DemoProjectContext | null; trace: ToolTrace } {
  const project = repos.projects.getProjectContext(projectId);
  return {
    project,
    trace: { tool: "getProjectContext", ok: Boolean(project), detail: projectId },
  };
}

export function getScenarioTool(
  repos: DemoRepositories,
  scenarioId: string,
): { scenario: DemoCalcScenario | null; trace: ToolTrace } {
  const scenario = repos.scenarios.getScenario(scenarioId);
  return {
    scenario,
    trace: { tool: "getScenario", ok: Boolean(scenario), detail: scenarioId },
  };
}

export function getCalculationResultTool(scenario: DemoCalcScenario | null): {
  results: DemoScenarioResults | null;
  trace: ToolTrace;
} {
  return {
    results: scenario?.results ?? null,
    trace: {
      tool: "getCalculationResult",
      ok: Boolean(scenario?.results),
      detail: scenario?.id,
    },
  };
}

export function updateScenarioInputTool(
  inputs: SchemeCalculationInput,
  patches: ParamPatch[],
): {
  inputs: SchemeCalculationInput;
  changes: ReturnType<typeof applyParamPatches>["changes"];
  trace: ToolTrace;
} {
  const applied = applyParamPatches(inputs, patches);
  return {
    inputs: applied.inputs,
    changes: applied.changes,
    trace: { tool: "updateScenarioInput", ok: true, detail: applied.changes.map((c) => c.label).join(",") },
  };
}

/** 调用真实 Calculation Engine，并落盘方案结果 */
export function calculateAndSaveTool(
  repos: DemoRepositories,
  params: {
    scenarioId?: string;
    projectId: string;
    name: string;
    inputs: SchemeCalculationInput;
    status?: DemoCalcScenario["status"];
    notes?: string;
    createNew?: boolean;
  },
): { scenario: DemoCalcScenario; liveProfit: string; trace: ToolTrace } {
  if (!params.createNew && params.scenarioId) {
    const existing = repos.scenarios.getScenario(params.scenarioId);
    if (existing && existing.projectId !== params.projectId) {
      throw new Error("跨项目写操作已拒绝：scenario.projectId 与当前 projectId 不一致");
    }
  }
  // 先裸调用引擎，确保数字来自 calculateProject
  const live = calculateProject(params.inputs);
  const saved = repos.scenarios.saveScenario({
    id: params.createNew ? undefined : params.scenarioId,
    projectId: params.projectId,
    name: params.name,
    status: params.status ?? "calculated",
    inputs: params.inputs,
    notes: params.notes,
    inputsSource: "user",
  });
  return {
    scenario: saved,
    liveProfit: live.monthlyProfit.toString(),
    trace: {
      tool: "calculateProject",
      ok: true,
      detail: `${saved.id} profit=${live.monthlyProfit.toFixed(2)}`,
    },
  };
}

export type ScenarioCompareRow = {
  key: string;
  label: string;
  a: string;
  b: string;
  delta: string;
  changeRate: string;
};

export function compareScenariosTool(
  a: DemoCalcScenario,
  b: DemoCalcScenario,
): { rows: ScenarioCompareRow[]; summary: string; trace: ToolTrace } {
  const ma = a.results?.metrics;
  const mb = b.results?.metrics;
  if (!ma || !mb) {
    return {
      rows: [],
      summary: "对比方案缺少测算结果，请先完成测算。",
      trace: { tool: "compareScenarios", ok: false, detail: "missing results" },
    };
  }

  const defs: { key: keyof typeof ma; label: string; kind: "money" | "pct" | "raw" }[] = [
    { key: "monthlyRevenue", label: "月收入", kind: "money" },
    { key: "monthlyTotalCost", label: "月总成本", kind: "money" },
    { key: "monthlyProfit", label: "月利润", kind: "money" },
    { key: "profitMargin", label: "利润率", kind: "pct" },
    { key: "irr", label: "IRR", kind: "pct" },
    { key: "cumulativeCashFlow", label: "累计现金流", kind: "money" },
  ];

  const rows: ScenarioCompareRow[] = defs.map((d) => {
    const va = ma[d.key] as string | number | null;
    const vb = mb[d.key] as string | number | null;
    const na = va == null ? null : Number(va);
    const nb = vb == null ? null : Number(vb);
    let delta = "—";
    let changeRate = "—";
    if (na != null && nb != null && Number.isFinite(na) && Number.isFinite(nb)) {
      const diff = nb - na;
      delta = d.kind === "pct" ? `${(diff * 100).toFixed(2)} ppt` : money(diff);
      if (d.kind === "pct") {
        changeRate = `${(diff * 100).toFixed(2)} ppt`;
      } else if (na === 0) {
        changeRate = nb === 0 ? "0%" : "—";
      } else {
        changeRate = `${((diff / Math.abs(na)) * 100).toFixed(2)}%`;
      }
    }
    const fmt = (v: string | number | null) => {
      if (v == null) return "—";
      return d.kind === "pct" ? pct(v) : d.kind === "money" ? money(v) : String(v);
    };
    return { key: String(d.key), label: d.label, a: fmt(va), b: fmt(vb), delta, changeRate };
  });

  const profitA = Number(ma.monthlyProfit);
  const profitB = Number(mb.monthlyProfit);
  const diff = profitB - profitA;
  const summary = `「${a.name}」月利润 ${money(profitA)} 元，「${b.name}」月利润 ${money(profitB)} 元，差值 ${money(diff)} 元。以上数字均来自已保存的引擎结果，AI 未重新计算。`;

  return {
    rows,
    summary,
    trace: { tool: "compareScenarios", ok: true, detail: `${a.id} vs ${b.id}` },
  };
}

export function getRoutesTool(inputs: SchemeCalculationInput): {
  routes: { id: string; routeName: string; segmentCount: number }[];
  trace: ToolTrace;
} {
  const routes = (inputs.routes || []).map((r) => ({
    id: r.id,
    routeName: r.routeName || r.routeCode || r.id,
    segmentCount: r.segments?.length || 0,
  }));
  return { routes, trace: { tool: "getRoutes", ok: true, detail: String(routes.length) } };
}

export function getSegmentsTool(inputs: SchemeCalculationInput): {
  segments: { routeId: string; routeName: string; segmentId: string; segmentName: string }[];
  trace: ToolTrace;
} {
  const segments: { routeId: string; routeName: string; segmentId: string; segmentName: string }[] = [];
  for (const route of inputs.routes || []) {
    for (const seg of route.segments || []) {
      segments.push({
        routeId: route.id,
        routeName: route.routeName || route.id,
        segmentId: seg.id,
        segmentName: seg.segmentName || seg.id,
      });
    }
  }
  return { segments, trace: { tool: "getSegments", ok: true, detail: String(segments.length) } };
}

export function getParameterScopeTool(
  inputs: SchemeCalculationInput,
  field: AssistantParamKey,
): { locations: SegmentParamLocation[]; trace: ToolTrace } {
  const locations = listSegmentParamLocations(inputs, field);
  return {
    locations,
    trace: { tool: "getParameterScope", ok: true, detail: `${field}:${locations.length}` },
  };
}

export function getSensitivityAnalysisTool(inputs: SchemeCalculationInput): {
  items: { name: string; evidence: string; impact: number }[];
  summary: string;
  trace: ToolTrace;
} {
  try {
    const base = calculateProject(inputs);
    const baseProfit = Number(base.monthlyProfit.toString());
    const specs: { name: string; variable: "freight_price" | "electricity_price" | "trips_per_vehicle_month"; change: string }[] = [
      { name: "运价 -10%", variable: "freight_price", change: "-10" },
      { name: "电价 +20%", variable: "electricity_price", change: "20" },
      { name: "趟次 -20%", variable: "trips_per_vehicle_month", change: "-20" },
    ];
    const items = specs.map((spec) => {
      const rows = runSensitivity({
        input: inputs,
        variable: spec.variable,
        changeMode: "PERCENT",
        minChange: spec.change,
        maxChange: spec.change,
        step: "1",
      });
      const row = rows[0];
      const nextProfit = row ? Number(row.monthlyProfit) : baseProfit;
      const impact = Math.abs(nextProfit - baseProfit);
      return {
        name: spec.name,
        evidence: row
          ? `${spec.name} 后月利润 ${money(row.monthlyProfit)} 元（相对基准变化 ${money(row.profitDelta)} 元）`
          : "敏感性行缺失",
        impact,
      };
    });
    items.sort((a, b) => b.impact - a.impact);
    const summary = items.length
      ? `基于引擎敏感性重算，对利润冲击最大的是「${items[0].name}」。数字均来自 Calculation Engine。`
      : "暂无敏感性结果。";
    return {
      items,
      summary,
      trace: { tool: "getSensitivityAnalysis", ok: true },
    };
  } catch (err) {
    return {
      items: [],
      summary: `敏感性分析暂时失败：${err instanceof Error ? err.message : "未知错误"}。测算结果本身不受影响。`,
      trace: { tool: "getSensitivityAnalysis", ok: false },
    };
  }
}

export function generateReportTool(params: {
  project: DemoProjectContext | null;
  scenario: DemoCalcScenario;
}): { text: string; trace: ToolTrace } {
  const m = params.scenario.results?.metrics;
  if (!m) {
    return {
      text: "当前方案尚无测算结果，无法生成汇报结论。请先完成测算。",
      trace: { tool: "generateReport", ok: false },
    };
  }
  const profit = Number(m.monthlyProfit);
  const margin = m.profitMargin == null ? null : Number(m.profitMargin);
  const projectName = params.project?.projectName || params.scenario.name;
  const verdict =
    profit < 0 ? "当前测算为亏损，不建议在未修正关键假设前推进签约。" : margin != null && margin < 0.08 ? "利润为正但偏薄，建议保留压力测试方案后再决策。" : "当前测算利润为正，可作为商务评审基准，并建议保留对比情景。";

  const text = [
    `【项目测算汇报结论】`,
    `项目：${projectName}${params.project ? `（${params.project.projectId}）` : ""}`,
    `方案：${params.scenario.name}（${params.scenario.id}）`,
    `核心指标（Calculation Engine）：月收入 ${money(m.monthlyRevenue)} 元；月总成本 ${money(m.monthlyTotalCost)} 元；月利润 ${money(m.monthlyProfit)} 元；利润率 ${pct(m.profitMargin)}；IRR ${pct(m.irr)}；累计现金流 ${money(m.cumulativeCashFlow)} 元。`,
    `结论：${verdict}`,
    `说明：以上数字均来自已保存的引擎结果，AI 仅负责归纳与表达，不替代计算。`,
  ].join("\n");

  return { text, trace: { tool: "generateReport", ok: true } };
}

export function localDiagnoseTool(params: {
  scenario: DemoCalcScenario;
  project?: DemoProjectContext | null;
  question?: string;
}): { insight: DemoAiInsight; trace: ToolTrace } {
  const insight = analyzeScenarioLocal(params);
  return { insight, trace: { tool: "localInsightEngine", ok: insight.status === "ready" } };
}

export function listScenarioParamsTool(scenario: DemoCalcScenario) {
  return snapshotParams(scenario.inputs);
}

export function topCostFromScenario(scenario: DemoCalcScenario): { name: string; amount: number } | null {
  const breakdown = (scenario.results?.full?.costBreakdown as { name?: string; code?: string; amount?: string }[]) || [];
  const costs = breakdown
    .map((row) => ({ name: row.name || row.code || "成本项", amount: Number(row.amount || 0) }))
    .sort((a, b) => b.amount - a.amount);
  return costs[0] || null;
}

export function formatMetricAnswer(
  scenario: DemoCalcScenario,
  target: string,
  scenarioCount?: number,
): string {
  const m = scenario.results?.metrics;
  if (!m && target !== "scenarioCount" && target !== "params" && target !== "fleetSize") {
    return "当前方案尚无测算结果，请先完成测算。AI 不会编造数字。";
  }
  switch (target) {
    case "monthlyProfit":
      return `当前方案「${scenario.name}」月利润为 ${money(m!.monthlyProfit)} 元（引擎结果）。`;
    case "monthlyRevenue":
      return `当前方案月收入为 ${money(m!.monthlyRevenue)} 元（引擎结果）。`;
    case "monthlyTotalCost":
      return `当前方案月总成本为 ${money(m!.monthlyTotalCost)} 元（引擎结果）。`;
    case "profitMargin":
      return `当前方案利润率为 ${pct(m!.profitMargin)}${m!.profitMarginReason ? `（${m!.profitMarginReason}）` : ""}。`;
    case "irr":
      return m!.irr == null
        ? `当前方案 IRR 暂不可用${m!.irrReason ? `（${m!.irrReason}）` : ""}。`
        : `当前方案 IRR 为 ${pct(m!.irr)}（引擎结果）。`;
    case "fleetSize": {
      const fleet = m?.fleetSize ?? scenario.inputs.fleetSize ?? scenario.inputs.vehicle?.fleetSize;
      return `当前车辆配置为 ${fleet ?? "—"} 台。`;
    }
    case "topCost": {
      const top = topCostFromScenario(scenario);
      return top
        ? `成本结构最大项是「${top.name}」，约 ${money(top.amount)} 元/月（来自引擎 costBreakdown）。`
        : "暂无成本结构明细。";
    }
    case "scenarioCount":
      return `当前项目共有 ${scenarioCount ?? 0} 个测算方案。`;
    case "params": {
      const snaps = snapshotParams(scenario.inputs).slice(0, 6);
      return `当前核心参数：${snaps.map((s) => `${s.label} ${s.display}`).join("；")}。`;
    }
    default:
      return m
        ? `方案「${scenario.name}」月利润 ${money(m.monthlyProfit)} 元，利润率 ${pct(m.profitMargin)}。`
        : "暂无测算结果。";
  }
}

export function cloneInputs(inputs: SchemeCalculationInput) {
  return cloneJson(inputs);
}
