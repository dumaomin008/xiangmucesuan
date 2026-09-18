import { describe, expect, it } from "vitest";
import { calculateScheme } from "@/lib/engine/calculate";
import { applyPercentChanges } from "@/lib/engine/sensitivity";
import { sampleInput } from "@/lib/engine/__tests__/fixture";
import { buildEngineAnalysisReport } from "../analysis/build-report";
import { mergeNarrative } from "../analysis/guard";
import { DEMO_SCENARIO_RULES } from "../analysis/rules";
import { enrichAnalysisReport, resolveAnalysisMode } from "../analysis/run";
import { DEMO_ANALYSIS_NOTICE, FALLBACK_ANALYSIS_NOTICE } from "../analysis/schema";

describe("AI analysis report", () => {
  it("指标、情景和敏感性数字都来自测算引擎", () => {
    const input = sampleInput();
    const output = calculateScheme(input);
    const report = buildEngineAnalysisReport(input);
    const profit = report.keyMetrics.find((item) => item.key === "monthlyProfit");
    expect(profit?.value).toBe(Number(output.monthlyProfit.toFixed(2)));
    expect(profit?.source).toBe("calculation_engine");

    const conservative = applyPercentChanges(input, DEMO_SCENARIO_RULES.conservative);
    const conservativeOut = calculateScheme(conservative);
    const row = report.scenarios.find((item) => item.name === "保守方案");
    expect(row?.scenarioSource).toBe("demo_rule");
    expect(row?.profit).toBe(Number(conservativeOut.monthlyProfit.toFixed(2)));
    expect(report.scenarios.find((item) => item.name === "基准方案")?.scenarioSource).toBe("calculation_engine");

    const freight = report.sensitivity.filter((item) => item.parameterKey === "freight_price").map((item) => item.change);
    expect(freight).toEqual([-20, -10, 0, 10, 20]);
    const share = report.costStructure.reduce((sum, item) => sum + item.percentage, 0);
    expect(share).toBeGreaterThan(99);
    expect(share).toBeLessThan(101);
  });

  it("缺失数据保持待确认，不补估算值", () => {
    const report = buildEngineAnalysisReport(sampleInput(), {
      assumptions: [{ field_name: "充电单价", value: "", status: "missing", label: "未获得" }],
    });
    const missing = report.assumptions.missing.find((item) => item.label.includes("充电单价"));
    expect(missing?.label).toContain("待确认");
    expect(missing?.label).not.toMatch(/\d/);
  });

  it("模型不能改写引擎数字，编造数字会被丢弃", async () => {
    const draft = buildEngineAnalysisReport(sampleInput());
    const forged = await enrichAnalysisReport(draft, {
      mode: "online",
      complete: async () => ({
        summary: { conclusion: "年利润 99999999 元" },
        keyMetrics: [{ key: "monthlyProfit", value: 1 }],
      }),
    });
    expect(forged.summary.conclusion).toBe(draft.summary.conclusion);
    expect(forged.keyMetrics).toEqual(draft.keyMetrics);
    expect(forged.mode).toBe("fallback");
    expect(forged.notice).toBe(FALLBACK_ANALYSIS_NOTICE);
  });

  it("JSON 异常和超时回退到本地分析，测算数字不变", async () => {
    const draft = buildEngineAnalysisReport(sampleInput());
    const broken = await enrichAnalysisReport(draft, {
      mode: "online",
      complete: async () => "不是 JSON",
    });
    expect(broken.mode).toBe("fallback");
    expect(broken.keyMetrics).toEqual(draft.keyMetrics);

    const timedOut = await enrichAnalysisReport(draft, {
      mode: "online",
      complete: async () => {
        throw new Error("timeout");
      },
    });
    expect(timedOut.notice).toBe(FALLBACK_ANALYSIS_NOTICE);
    expect(timedOut.scenarios).toEqual(draft.scenarios);
  });

  it("demo 模式不调用模型", async () => {
    const draft = buildEngineAnalysisReport(sampleInput());
    let called = false;
    const report = await enrichAnalysisReport(draft, {
      mode: "demo",
      complete: async () => {
        called = true;
        return {};
      },
    });
    expect(called).toBe(false);
    expect(report.mode).toBe("demo");
    expect(report.notice).toBe(DEMO_ANALYSIS_NOTICE);
    expect(resolveAnalysisMode({ AI_MODE: "demo", AI_LLM_API_KEY: "sk-test" })).toBe("demo");
    expect(resolveAnalysisMode({ AI_MODE: "online" })).toBe("online");
  });

  it("只接受有依据的结论文字", () => {
    const draft = buildEngineAnalysisReport(sampleInput());
    const merged = mergeNarrative(draft, {
      summary: { conclusion: "建议进一步核实日均趟次和实际能源价格。" },
    });
    expect(merged.mode).toBe("online");
    expect(merged.summary.conclusion).toContain("日均趟次");
    expect(merged.keyMetrics).toEqual(draft.keyMetrics);
  });
});
