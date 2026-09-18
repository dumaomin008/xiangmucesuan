import { calculateScheme } from "@/lib/engine/calculate";
import { validateSchemeInput } from "@/lib/engine/validate";
import type { SchemeCalculationInput } from "@/lib/engine/types";
import { runScenario } from "../copilot/scenario";
import { explainFromEngine } from "../copilot/explain";
import { resolveIntent } from "../copilot/parse-intent";
import { toCalculationResultV1 } from "../map/from-engine";
import { assertEngineSourced } from "../map/guard";
import type { DueDiligenceItem } from "../schema/types";
import type { RiskItem } from "./risk-engine";

function cloneInput(input: SchemeCalculationInput) {
  return JSON.parse(JSON.stringify(input)) as SchemeCalculationInput;
}

function resultFrom(input: SchemeCalculationInput) {
  const output = calculateScheme(input);
  const result = toCalculationResultV1({
    ruleVersion: input.ruleSet.ruleVersionId,
    monthlyRevenue: output.monthlyRevenue.toFixed(2),
    monthlyTotalCost: output.monthlyTotalCost.toFixed(2),
    monthlyProfit: output.monthlyProfit.toFixed(2),
    profitMargin: output.profitMargin ? output.profitMargin.toFixed(4) : null,
    profitMarginReason: output.profitMarginReason,
    irr: output.irr ? output.irr.toFixed(4) : null,
    irrReason: output.irrReason,
    monthlyVolume: output.monthlyVolume.toFixed(2),
    monthlyMileage: output.monthlyMileage.toFixed(2),
    firstPositiveMonth: output.firstPositiveMonth,
    cumulativeCashFlow: output.cumulativeCashFlow.toFixed(2),
    costBreakdown: output.costBreakdown,
    routes: output.routes,
  });
  assertEngineSourced(result);
  return result;
}

export async function runCopilotTurn(input: {
  question: string;
  baselineInput: SchemeCalculationInput;
  lastPatchedInput?: SchemeCalculationInput | null;
  dueDiligence?: DueDiligenceItem[];
  risks?: RiskItem[];
  base?: "baseline" | "last_scenario";
  llmComplete?: () => Promise<unknown>;
}) {
  const intent = await resolveIntent(input.question, input.llmComplete);
  const sourceInput =
    input.base === "last_scenario" && input.lastPatchedInput ? input.lastPatchedInput : input.baselineInput;
  const frozenBaseline = cloneInput(input.baselineInput);

  if (intent.kind !== "scenario") {
    const result = resultFrom(sourceInput);
    const text = explainFromEngine({
      question: input.question,
      result,
      risks: input.risks,
      dueDiligence: input.dueDiligence,
    });
    return {
      intent,
      steps: intent.kind === "due_diligence" ? ["读取缺失项与敏感度", "生成尽调建议"] : ["读取当前测算结果", "生成解释"],
      explanation: text.text,
      scenario: null as ReturnType<typeof runScenario> | null,
      engineErrors: [] as string[],
      baselineUnchanged: JSON.stringify(frozenBaseline) === JSON.stringify(input.baselineInput),
    };
  }

  const preview = runScenario(sourceInput, intent.actions);
  const { errors } = validateSchemeInput(preview.patchedInput);
  if (errors.length) {
    return {
      intent,
      steps: [intent.parser === "llm" ? "大模型识别场景意图" : "识别场景意图", "参数校验失败"],
      explanation: `场景参数未通过测算引擎校验：${errors.map((e) => e.message).join("；")}`,
      scenario: null,
      engineErrors: errors.map((e) => e.message),
      baselineUnchanged: JSON.stringify(frozenBaseline) === JSON.stringify(input.baselineInput),
    };
  }
  assertEngineSourced(preview.scenario);
  assertEngineSourced(preview.baseline);
  const delta = preview.difference;
  return {
    intent,
    steps: [
      intent.parser === "llm" ? "规则未命中，已用大模型生成 ScenarioPatch" : "识别场景意图",
      "创建模拟方案",
      "测算引擎重算",
      "对比基准方案",
    ],
    explanation: `已按「${intent.title}」创建临时方案并由测算引擎重算。月利润变化 ${delta.monthly_profit} 元，月收入变化 ${delta.monthly_revenue} 元，月成本变化 ${delta.monthly_total_cost} 元。这些数字来自 Calculation Engine，不是模型估算。`,
    scenario: preview,
    engineErrors: [],
    baselineUnchanged: JSON.stringify(frozenBaseline) === JSON.stringify(input.baselineInput),
  };
}
