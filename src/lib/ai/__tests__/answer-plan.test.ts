import { describe, expect, it } from "vitest";
import { calculateScheme } from "@/lib/engine/calculate";
import { sampleInput } from "@/lib/engine/__tests__/fixture";
import {
  buildAnswerPlan,
  classifyQuestion,
  filterVisualizations,
  sanitizeAnswerPlan,
} from "../analysis/answer-plan";
import { parseIntentRuleBased } from "../copilot/intent";
import { resolveIntent } from "../copilot/parse-intent";
import { runCopilotTurn } from "../services/copilot-run";
import { mergeNarrative } from "../analysis/guard";
import { buildEngineAnalysisReport } from "../analysis/build-report";
import { FALLBACK_ANALYSIS_NOTICE } from "../analysis/schema";

const SCENES = [
  ["帮我分析一下这个项目。", "summary"],
  ["如果电价上涨10%，还能赚钱吗？", "scenario"],
  ["如果运价下降10%呢？", "scenario"],
  ["哪个参数对利润影响最大？", "sensitivity"],
  ["项目最大的风险是什么？", "risk"],
  ["成本主要花在哪里？", "cost"],
  ["还有哪些数据需要确认？", "due_diligence"],
] as const;

describe("动态回答计划", () => {
  it("8 类演示问题映射到对应模块，且计划里没有业务金额", () => {
    for (const [question, intent] of SCENES) {
      const plan = buildAnswerPlan({ question, forceScenario: intent === "scenario" });
      expect(plan.intent).toBe(intent);
      expect(plan.expandedSections.length).toBeGreaterThan(0);
      expect(plan.collapsedSections.some((item) => !plan.expandedSections.includes(item))).toBe(true);
      expect(JSON.stringify(plan)).not.toMatch(/"profit"\s*:/);
      expect(plan.visualizations.every((item) => filterVisualizations([item, "not_a_chart"]).includes(item))).toBe(true);
    }
    expect(classifyQuestion("帮我分析一下这个项目。")).toBe("summary");
    expect(filterVisualizations(["kpi", "made_up_chart", "kpi"])).toEqual(["kpi"]);
  });

  it("电价上涨 10% 走百分比重算，不把电价设成 10 元", async () => {
    const intent = parseIntentRuleBased("如果电价上涨10%，还能赚钱吗？");
    expect(intent.kind).toBe("scenario");
    expect(intent.actions[0]).toMatchObject({ operation: "multiply", value: 1.1 });
    const baseline = sampleInput();
    const turn = await runCopilotTurn({ question: "如果电价上涨10%，还能赚钱吗？", baselineInput: baseline });
    expect(turn.delta?.source).toBe("calculation_engine");
    expect(turn.delta?.parameters[0]?.changeLabel).toBe("+10%");
    expect(Number(turn.scenario?.patchedInput.routes[0]?.segments[0]?.electricityPrice)).toBeCloseTo(0.82 * 1.1, 4);
    expect(turn.baselineUnchanged).toBe(true);
    expect(turn.answerPlan.intent).toBe("scenario");
    expect(turn.answerPlan.expandedSections).not.toContain("costStructure");
    const profit = turn.delta?.rows.find((item) => item.key === "monthlyProfit");
    const engineBase = calculateScheme(baseline).monthlyProfit.toFixed(2);
    const engineNext = calculateScheme(turn.scenario!.patchedInput).monthlyProfit.toFixed(2);
    expect(profit?.baseline).toBe(Number(engineBase));
    expect(profit?.next).toBe(Number(engineNext));
  });

  it("参数不足时追问，不默认补 10%", async () => {
    const intent = parseIntentRuleBased("如果电价涨了呢？");
    expect(intent.clarify?.options.map((item) => item.label)).toEqual(["+5%", "+10%", "+20%"]);
    const turn = await runCopilotTurn({ question: "如果电价涨了呢？", baselineInput: sampleInput() });
    expect(turn.scenario).toBeNull();
    expect(turn.answerPlan.needsClarification).toBe(true);
    expect(turn.answerPlan.requiresRecalculation).toBe(false);
    expect(parseIntentRuleBased("如果车辆增加呢？").clarify?.prompt).toMatch(/多少台/);
  });

  it("第二问默认叠在上一临时情景上", async () => {
    const baseline = sampleInput();
    const first = await runCopilotTurn({ question: "电价上涨10%呢？", baselineInput: baseline });
    const second = await runCopilotTurn({
      question: "运价再下降5%呢？",
      baselineInput: baseline,
      lastPatchedInput: first.scenario?.patchedInput,
      lastScenarioTitle: first.intent.title,
    });
    expect(second.intent.continueFromLast).toBe(true);
    expect(second.answerPlan.contextLabel).toContain("电价");
    expect(Number(second.scenario?.patchedInput.routes[0]?.segments[0]?.electricityPrice)).toBeCloseTo(0.82 * 1.1, 4);
    expect(Number(second.scenario?.patchedInput.routes[0]?.segments[0]?.freightPrice)).toBeCloseTo(220 * 0.95, 4);
    expect(JSON.stringify(baseline)).toBe(JSON.stringify(sampleInput()));
  });

  it("分析类问题不调用大模型补情景", async () => {
    let called = false;
    const intent = await resolveIntent("哪个参数对利润影响最大？", async () => {
      called = true;
      return { kind: "scenario", title: "不该出现", actions: [] };
    });
    expect(called).toBe(false);
    expect(intent.kind).toBe("explain");
    expect(buildAnswerPlan({ question: "哪个参数对利润影响最大？" }).intent).toBe("sensitivity");
    expect(buildAnswerPlan({ question: "项目最大的风险是什么？" }).visualizations).toContain("risk");
    expect(buildAnswerPlan({ question: "成本主要花在哪里？" }).visualizations).toContain("cost_structure");
    expect(buildAnswerPlan({ question: "还有哪些数据需要确认？" }).intent).toBe("due_diligence");
  });

  it("非法可视化和伪造数字不能进入回答计划，叙事失败仍保留引擎结果", () => {
    const fallback = buildAnswerPlan({ question: "帮我分析一下这个项目。" });
    const plan = sanitizeAnswerPlan(
      { intent: "cost", title: "成本", visualizations: ["cost_structure", "hacked_chart"], monthlyProfit: 1 },
      fallback,
    );
    expect(plan.visualizations).toEqual(["cost_structure"]);
    expect(JSON.stringify(plan)).not.toContain("hacked_chart");
    expect("monthlyProfit" in plan).toBe(false);

    const draft = buildEngineAnalysisReport(sampleInput());
    const broken = mergeNarrative(draft, "不是 JSON");
    expect(broken.notice).toBe(FALLBACK_ANALYSIS_NOTICE);
    expect(broken.keyMetrics).toEqual(draft.keyMetrics);
    expect(buildAnswerPlan({ question: "帮我分析一下这个项目。" }).primaryMetrics.length).toBeGreaterThan(0);
  });
});
