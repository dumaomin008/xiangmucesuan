import type { CalculationResultV1 } from "../schema/types";
import type { RiskItem } from "../services/risk-engine";
import type { DueDiligenceItem } from "../schema/types";

export function explainFromEngine(input: {
  question: string;
  result: CalculationResultV1;
  risks?: RiskItem[];
  dueDiligence?: DueDiligenceItem[];
}) {
  const costs = [...(input.result.cost_breakdown || [])]
    .map((item) => ({ name: item.name, amount: Number(item.amount || 0) }))
    .sort((a, b) => b.amount - a.amount);
  const top = costs[0];
  const kpis = input.result.kpis;
  const highRisks = (input.risks || []).filter((item) => item.level === "高");
  const dd = (input.dueDiligence || []).slice(0, 3);

  if (/尽调|下一步/.test(input.question)) {
    return {
      source: "calculation_engine",
      text: dd.length
        ? `结合缺失项、敏感度和当前可信度，下一步优先：\n${dd
            .map((item) => `${item.priority}｜${item.item}\n当前：${item.current_assumption}\n影响：${item.impact_metrics.join("、")}\n建议：${item.suggested_method}`)
            .join("\n\n")}`
        : "当前关键字段较完整。仍建议抽查运价、趟次和电价的合同/台账原件。",
    };
  }
  if (/最大成本/.test(input.question)) {
    return {
      source: "calculation_engine",
      text: top
        ? `测算引擎成本结构中最大项是「${top.name}」，金额 ${top.amount.toFixed(2)} 元/月。该数字来自 Calculation Engine，不是模型估算。`
        : "还没有成本结构结果。",
    };
  }
  if (/敏感/.test(input.question)) {
    return {
      source: "calculation_engine",
      text: `对利润通常最敏感的是运价、单车月趟数和电价。风险引擎已用敏感性重算给出等级，请看 RISK-01/02/03。核心 KPI：月利润 ${kpis.monthly_profit} 元，利润率 ${kpis.profit_margin ?? "无法计算"}。`,
    };
  }
  return {
    source: "calculation_engine",
    text: `当前方案由测算引擎给出：月收入 ${kpis.monthly_revenue} 元，月成本 ${kpis.monthly_total_cost} 元，月利润 ${kpis.monthly_profit} 元，利润率 ${kpis.profit_margin ?? "无法计算"}。${
      top ? `成本最高项是${top.name}。` : ""
    }${highRisks.length ? `高风险：${highRisks.map((r) => r.risk_name).join("、")}。` : "暂无高等级风险。"}这些数字均来自引擎结果，模型只做解释。`,
  };
}
