import { calculateScheme } from "@/lib/engine/calculate";
import { validateSchemeInput } from "@/lib/engine/validate";
import type { SchemeCalculationInput } from "@/lib/engine/types";
import { runScenario } from "../copilot/scenario";
import { explainFromEngine } from "../copilot/explain";
import { buildEngineAnalysisReport, type AIAnalysisReport } from "../analysis";
import { buildAnswerPlan, type AnswerPlan, type ScenarioDeltaView } from "../analysis/answer-plan";
import { buildScenarioDelta } from "../analysis/delta";
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

function safeAnalysis(input: SchemeCalculationInput, question?: string): AIAnalysisReport | null {
  try {
    return buildEngineAnalysisReport(input, { question });
  } catch {
    return null;
  }
}

export async function runCopilotTurn(input: {
  question: string;
  baselineInput: SchemeCalculationInput;
  lastPatchedInput?: SchemeCalculationInput | null;
  lastScenarioTitle?: string | null;
  dueDiligence?: DueDiligenceItem[];
  risks?: RiskItem[];
  base?: "baseline" | "last_scenario";
  llmComplete?: () => Promise<unknown>;
}) {
  const intent = await resolveIntent(input.question, input.llmComplete);
  const continueFromLast = Boolean(intent.continueFromLast && input.lastPatchedInput);
  const sourceInput =
    (input.base === "last_scenario" || continueFromLast) && input.lastPatchedInput ? input.lastPatchedInput : input.baselineInput;
  const frozenBaseline = cloneInput(input.baselineInput);
  const planInput = {
    question: input.question,
    scenarioTitle: intent.title,
    forceScenario: intent.kind === "scenario" && !intent.clarify,
    continueFromLast,
    contextBasis: continueFromLast ? input.lastScenarioTitle || "上一临时情景" : null,
    clarify: intent.clarify,
  };

  if (intent.clarify) {
    return {
      intent,
      steps: ["识别到参数不足", "等待确认变动幅度"],
      explanation: intent.clarify.prompt,
      analysis: safeAnalysis(input.baselineInput, input.question),
      answerPlan: buildAnswerPlan(planInput),
      delta: null as ScenarioDeltaView | null,
      scenario: null as ReturnType<typeof runScenario> | null,
      engineErrors: [] as string[],
      baselineUnchanged: true,
    };
  }

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
      steps: intent.kind === "due_diligence" ? ["读取缺失项与敏感度", "生成尽调建议"] : ["识别问题类型", "读取当前测算结果"],
      explanation: text.text,
      analysis: safeAnalysis(sourceInput, input.question),
      answerPlan: buildAnswerPlan(planInput),
      delta: null as ScenarioDeltaView | null,
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
      explanation: `场景参数未通过测算引擎校验：${errors.map((e) => e.message).join("；")}。未覆盖基准方案。`,
      analysis: safeAnalysis(sourceInput, input.question),
      answerPlan: buildAnswerPlan({ ...planInput, forceScenario: false }),
      delta: null as ScenarioDeltaView | null,
      scenario: null,
      engineErrors: errors.map((e) => e.message),
      baselineUnchanged: JSON.stringify(frozenBaseline) === JSON.stringify(input.baselineInput),
    };
  }
  assertEngineSourced(preview.scenario);
  assertEngineSourced(preview.baseline);
  const delta = buildScenarioDelta({
    before: sourceInput,
    after: preview.patchedInput,
    beforeOutput: preview.beforeOutput,
    afterOutput: preview.afterOutput,
    actions: intent.actions,
    title: intent.title,
    contextBasis: continueFromLast ? input.lastScenarioTitle || "上一临时情景" : null,
  });
  const answerPlan: AnswerPlan = buildAnswerPlan(planInput);
  return {
    intent,
    steps: [
      intent.parser === "llm" ? "规则未命中，已用大模型生成 ScenarioPatch" : "识别场景意图",
      "创建临时情景",
      "测算引擎重算",
      "对比变动前方案",
    ],
    explanation: delta.lead,
    analysis: safeAnalysis(preview.patchedInput, input.question),
    answerPlan,
    delta,
    scenario: preview,
    engineErrors: [],
    baselineUnchanged: JSON.stringify(frozenBaseline) === JSON.stringify(input.baselineInput),
  };
}
