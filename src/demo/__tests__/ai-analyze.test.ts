import { describe, expect, it } from "vitest";
import { createMemoryDemoRepositories } from "@/demo";
import { analyzeScenarioLocal, buildAiPayload } from "@/demo/ai/analyze";

describe("Phase 5：AI 解读与计算解耦", () => {
  it("本地解读基于引擎结果，不编造 KPI", () => {
    const demo = createMemoryDemoRepositories();
    const scenario = demo.scenarios.getScenario("SCN-001-BASE")!;
    const insight = analyzeScenarioLocal({
      scenario,
      project: demo.projects.getProjectContext("PRJ-DEMO-001"),
      question: "能不能做？",
    });
    expect(insight.status).toBe("ready");
    expect(insight.source).toBe("local_engine");
    expect(insight.summary).toContain("正利润");
    expect(insight.risks.length).toBeGreaterThan(0);
    expect(insight.disclaimer).toMatch(/不得修改|不得.*替代/);
    const profit = scenario.results!.metrics.monthlyProfit;
    expect(insight.highlights.some((h) => h.includes(Number(profit).toLocaleString("zh-CN", { minimumFractionDigits: 2 })))).toBe(true);
  });

  it("无结果时降级且不抛错", () => {
    const demo = createMemoryDemoRepositories();
    const scenario = demo.scenarios.getScenario("SCN-001-BASE")!;
    scenario.results = null;
    const insight = analyzeScenarioLocal({ scenario });
    expect(insight.status).toBe("degraded");
    expect(insight.risks).toEqual([]);
  });

  it("远端 payload 必须携带 engineMetrics，禁止模型自行计算", () => {
    const demo = createMemoryDemoRepositories();
    const scenario = demo.scenarios.getScenario("SCN-003-BASE")!;
    const local = analyzeScenarioLocal({ scenario, question: "有哪些风险" });
    const payload = buildAiPayload({ scenario, localInsight: local, question: "有哪些风险" });
    expect(payload.engineMetrics?.monthlyProfit).toBe(scenario.results!.metrics.monthlyProfit);
    expect(payload.rules.some((r) => r.includes("禁止重新计算"))).toBe(true);
    expect(Number(payload.engineMetrics!.monthlyProfit)).toBeLessThan(0);
  });
});
