import { calculateProject, runSensitivity, type SchemeCalculationInput } from "@/calculation";
import { buildEngineAnalysisReport, type AIAnalysisReport } from "@/lib/ai/analysis";
import type { DemoCalcScenario, DemoProjectContext } from "../types";

export type DemoAiRiskLevel = "高" | "中" | "低";

export type DemoAiRiskItem = {
  code: string;
  name: string;
  level: DemoAiRiskLevel;
  evidence: string;
  recommendation: string;
};

export type DemoAiInsight = {
  source: "local_engine" | "remote_llm";
  status: "ready" | "degraded";
  title: string;
  summary: string;
  highlights: string[];
  risks: DemoAiRiskItem[];
  suggestions: string[];
  disclaimer: string;
  generatedAt: string;
  visual?: AIAnalysisReport;
};

function money(n: number) {
  return n.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function pct(n: number | null) {
  if (n === null || !Number.isFinite(n)) return "无法计算";
  return `${(n * 100).toFixed(2)}%`;
}

function levelFromDrop(drop: number, high: number, mid: number): DemoAiRiskLevel {
  if (drop >= high) return "高";
  if (drop >= mid) return "中";
  return "低";
}

/**
 * 基于真实引擎结果 + 敏感性重算生成解读。
 * AI 只解释，不重新发明利润/成本公式。
 */
export function analyzeScenarioLocal(params: {
  scenario: DemoCalcScenario;
  project?: DemoProjectContext | null;
  question?: string;
}): DemoAiInsight {
  const { scenario, project } = params;
  const metrics = scenario.results?.metrics;
  if (!metrics) {
    return {
      source: "local_engine",
      status: "degraded",
      title: "暂无测算结果可解读",
      summary: "请先完成测算。AI 区域仅解释引擎输出，不会替代计算。",
      highlights: [],
      risks: [],
      suggestions: ["点击「重新测算并保存」生成结果后再解读。"],
      disclaimer: "核心数字必须来自浏览器计算引擎。",
      generatedAt: new Date().toISOString(),
    };
  }

  const revenue = Number(metrics.monthlyRevenue);
  const cost = Number(metrics.monthlyTotalCost);
  const profit = Number(metrics.monthlyProfit);
  const margin = metrics.profitMargin == null ? null : Number(metrics.profitMargin);
  const breakdown = (scenario.results?.full?.costBreakdown as { name?: string; code?: string; amount?: string }[]) || [];
  const costs = breakdown
    .map((row) => ({ name: row.name || row.code || "成本项", amount: Number(row.amount || 0) }))
    .sort((a, b) => b.amount - a.amount);
  const top = costs[0];

  const risks = buildRisksFromEngine(scenario.inputs, margin);
  const highRisks = risks.filter((r) => r.level === "高");

  const highlights = [
    `月营收 ${money(revenue)} 元，月成本 ${money(cost)} 元，月利润 ${money(profit)} 元（利润率 ${pct(margin)}）。`,
    top ? `成本结构最大项：${top.name}，约 ${money(top.amount)} 元/月。` : "成本结构明细暂缺。",
    metrics.irr
      ? `IRR ${pct(Number(metrics.irr))}；累计现金流 ${money(Number(metrics.cumulativeCashFlow))} 元。`
      : `IRR 暂不可用（${metrics.irrReason || "未求解"}）；累计现金流 ${money(Number(metrics.cumulativeCashFlow))} 元。`,
    project
      ? `关联项目 ${project.projectName}（${project.projectId}）· ${project.customer || "未填客户"}。`
      : `方案 ${scenario.name}（${scenario.id}）。`,
  ];

  const suggestions: string[] = [];
  if (profit < 0) {
    suggestions.push("当前月利润为负，优先复核运价、趟次和单车月租是否被高估/低估。");
  } else if (margin !== null && margin < 0.08) {
    suggestions.push("利润率偏薄，建议做电价 +20% 与运价 -10% 的压力测试后再决策。");
  } else {
    suggestions.push("利润为正，仍建议保留基准方案并另存电价上涨对比方案。");
  }
  if (top) suggestions.push(`关注「${top.name}」可控性，必要时拆到路段级核对。`);
  if (highRisks.length) {
    suggestions.push(`优先处理高风险：${highRisks.map((r) => r.name).join("、")}。`);
  } else {
    suggestions.push("暂无高等级敏感性风险，可继续完善现场运量与合同原件抽查。");
  }

  const question = params.question?.trim() || "";
  let summary = `引擎结果显示方案「${scenario.name}」月利润 ${money(profit)} 元、利润率 ${pct(margin)}。${
    top ? `最大成本项为${top.name}。` : ""
  }${highRisks.length ? `高风险关注：${highRisks.map((r) => r.name).join("、")}。` : "暂无高等级风险。"}以上数字均来自计算引擎，本模块只做解释。`;

  if (/最大成本|成本结构|分析成本/.test(question)) {
    const costLines = costs
      .slice(0, 4)
      .map((c, i) => `${i + 1}. ${c.name} ${money(c.amount)} 元`)
      .join("；");
    summary = top
      ? `测算引擎成本结构中最大项是「${top.name}」，金额 ${money(top.amount)} 元/月。主要构成：${costLines || "暂缺"}。该数字来自 Calculation Engine，不是模型估算。`
      : "还没有成本结构结果。";
  } else if (/为什么.*利润|利润.*低|利润.*不高|项目情况/.test(question)) {
    const drivers = [
      `收入侧：月营收 ${money(revenue)} 元`,
      top ? `成本侧最大项「${top.name}」约 ${money(top.amount)} 元/月` : `成本侧：月总成本 ${money(cost)} 元`,
      `结果：月利润 ${money(profit)} 元，利润率 ${pct(margin)}`,
    ];
    summary = `业务诊断（基于引擎结果）：${drivers.join("；")}。${
      profit < 0
        ? "利润为负，优先复核运价、电价与趟次假设。"
        : margin !== null && margin < 0.08
          ? "利润偏薄，能源/车辆/司机成本任一上行都可能侵蚀空间。"
          : "利润尚可，仍建议关注电价与运价敏感性。"
    }`;
  } else if (/敏感|风险|异常|检查.*参数/.test(question)) {
    summary = `敏感性由引擎重算：运价/电价/趟次波动对利润影响见下方风险清单。核心 KPI：月利润 ${money(profit)} 元，利润率 ${pct(margin)}。${
      highRisks.length ? `当前高风险：${highRisks.map((r) => r.name).join("、")}。` : "暂无高等级风险。"
    }`;
  } else if (/亏损|盈利|能不能做/.test(question)) {
    summary =
      profit >= 0
        ? `按当前参数，引擎给出正利润 ${money(profit)} 元/月。是否立项还需结合合同锁价、场站电价与实际趟次。`
        : `按当前参数，引擎给出亏损 ${money(profit)} 元/月。不建议在未修正关键假设前推进签约。`;
  }

  return {
    source: "local_engine",
    status: "ready",
    title: "测算结果解读",
    summary,
    highlights,
    risks,
    suggestions,
    disclaimer: "AI/规则解读不得修改或替代核心测算数字；失败时仅本区域降级。",
    generatedAt: new Date().toISOString(),
    visual: buildVisual(scenario.inputs, params.question),
  };
}

function buildVisual(input: SchemeCalculationInput, question?: string): AIAnalysisReport | undefined {
  try {
    return buildEngineAnalysisReport(input, { question });
  } catch {
    return undefined;
  }
}

function buildRisksFromEngine(input: SchemeCalculationInput, baselineMargin: number | null): DemoAiRiskItem[] {
  const risks: DemoAiRiskItem[] = [];
  const baseMargin = baselineMargin ?? 0;

  try {
    const freight = runSensitivity({
      input,
      variable: "freight_price",
      changeMode: "PERCENT",
      minChange: "-10",
      maxChange: "0",
      step: "10",
    });
    const freightDown = freight.find((row) => row.parameterChange === "-10");
    if (freightDown) {
      const nextMargin = Number(freightDown.profitMargin || 0);
      const drop = baseMargin - nextMargin;
      risks.push({
        code: "RISK-01",
        name: "运价风险",
        level: levelFromDrop(drop, 0.05, 0.02),
        evidence: `运价下降 10% 后利润变化 ${freightDown.profitDelta} 元，利润率 ${(nextMargin * 100).toFixed(2)}%。`,
        recommendation: "核实合同运价锁定期和调价条款。",
      });
    }

    const power = runSensitivity({
      input,
      variable: "electricity_price",
      changeMode: "PERCENT",
      minChange: "0",
      maxChange: "20",
      step: "20",
    });
    const powerUp = power.find((row) => row.parameterChange === "20");
    if (powerUp) {
      const drop = baseMargin - Number(powerUp.profitMargin || 0);
      risks.push({
        code: "RISK-02",
        name: "电价风险",
        level: levelFromDrop(drop, 0.03, 0.01),
        evidence: `电价上涨 20% 后利润变化 ${powerUp.profitDelta} 元。`,
        recommendation: "确认充电价格是否锁定及波动区间。",
      });
    }

    const trips = runSensitivity({
      input,
      variable: "trips_per_vehicle_month",
      changeMode: "PERCENT",
      minChange: "-20",
      maxChange: "0",
      step: "20",
    });
    const tripsDown = trips.find((row) => row.parameterChange === "-20");
    if (tripsDown) {
      const drop = baseMargin - Number(tripsDown.profitMargin || 0);
      risks.push({
        code: "RISK-03",
        name: "趟次风险",
        level: levelFromDrop(drop, 0.04, 0.015),
        evidence: `单车月趟数下降 20% 后利润变化 ${tripsDown.profitDelta} 元。`,
        recommendation: "核对近 3 个月有效趟次与装卸等待。",
      });
    }
  } catch {
    risks.push({
      code: "RISK-SENS",
      name: "敏感性分析受限",
      level: "中",
      evidence: "敏感性重算暂时失败，已降级为仅解读静态结果。",
      recommendation: "刷新页面后重试；测算结果本身不受影响。",
    });
  }

  const live = calculateProject(input);
  risks.push({
    code: "RISK-PROFIT",
    name: "盈利风险",
    level: live.monthlyProfit.lt(0) ? "高" : live.profitMargin && live.profitMargin.lt(0.05) ? "中" : "低",
    evidence: `引擎月利润 ${live.monthlyProfit.toFixed(2)} 元，利润率 ${live.profitMargin ? live.profitMargin.mul(100).toFixed(2) + "%" : "无法计算"}。`,
    recommendation: live.monthlyProfit.lt(0) ? "先修正亏损驱动项，再进入商务评审。" : "维持基准方案并保留对比情景。",
  });

  return risks;
}

/** 供远端 LLM 使用的结构化上下文（不含 Secret） */
export function buildAiPayload(params: {
  scenario: DemoCalcScenario;
  project?: DemoProjectContext | null;
  question?: string;
  localInsight: DemoAiInsight;
}) {
  const m = params.scenario.results?.metrics;
  return {
    schemaVersion: 1,
    question: params.question || "请解释当前测算结果、主要风险与下一步建议",
    project: params.project
      ? {
          projectId: params.project.projectId,
          projectName: params.project.projectName,
          customer: params.project.customer,
          region: params.project.region,
        }
      : null,
    scenario: {
      id: params.scenario.id,
      name: params.scenario.name,
      status: params.scenario.status,
      calculationVersion: params.scenario.calculationVersion,
    },
    engineMetrics: m,
    localInsight: {
      summary: params.localInsight.summary,
      highlights: params.localInsight.highlights,
      risks: params.localInsight.risks,
      suggestions: params.localInsight.suggestions,
    },
    rules: [
      "你只能解释给定的引擎数字，禁止重新计算或编造 KPI。",
      "若信息不足，明确说明不确定，不要假装已测算。",
      "输出简体中文，分：结论、风险、建议。",
    ],
  };
}
