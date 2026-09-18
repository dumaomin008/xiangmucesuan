import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { calculateProject, runSensitivity } from "@/calculation";
import { createMemoryDemoRepositories } from "@/demo";
import {
  buildCenterResponse,
  buildImportPreview,
  detectIntent,
  formatEngineMoney,
  formatEnginePercent,
  groupConversations,
  suggestedQuestions,
} from "@/demo/ai-center";
import { profitableInput } from "@/demo/seed/inputs";
import type { CenterProject } from "@/demo/ai-center";

const root = path.resolve(__dirname, "../../..");

function project(partial: Partial<CenterProject> & Pick<CenterProject, "projectId" | "projectName">): CenterProject {
  return {
    customer: "演示客户",
    scenarios: [],
    ...partial,
  };
}

describe("AI 对话测算中心", () => {
  it("保留传统列表，并挂上对话工作台", () => {
    const calc = fs.readFileSync(path.join(root, "demo-frontend-package/calculation-app.js"), "utf8");
    const html = fs.readFileSync(path.join(root, "demo-frontend-package/index.html"), "utf8");
    expect(calc).toContain("传统列表视图");
    expect(calc).toContain("新建测算");
    expect(calc).toContain("测算项目");
    expect(calc).toContain("待完善测算");
    expect(calc).toContain("calcCenterListPage");
    expect(html).toContain("ai-center-ui.js");
    expect(html).toContain("ai-center.bundle.js");
    expect(fs.existsSync(path.join(root, "demo-frontend-package/ai-center-ui.js"))).toBe(true);
  });

  it("识别经营分析、对比、风险、新建、敏感性和报告", () => {
    expect(detectIntent("分析最近的测算项目经营情况")).toBe("PROJECT_ANALYSIS");
    expect(detectIntent("对比杭州和临港项目的盈利能力")).toBe("PROJECT_COMPARE");
    expect(detectIntent("哪些项目存在较大风险，原因是什么？")).toBe("RISK_ANALYSIS");
    expect(detectIntent("帮我测算一个新的运输项目")).toBe("CREATE_CALCULATION");
    expect(detectIntent("如果临港项目电价上涨 10%，利润会怎么样？")).toBe("SENSITIVITY_ANALYSIS");
    expect(detectIntent("如果电价涨了呢？")).toBe("SENSITIVITY_ANALYSIS");
    expect(detectIntent("生成本月项目经营分析报告")).toBe("GENERATE_REPORT");
    expect(suggestedQuestions({ projectId: "PRJ-DEMO-001" })[0]).toContain("成本");
  });

  it("经营分析 KPI 与表格金额来自传入的引擎结果", () => {
    const output = calculateProject(profitableInput());
    const revenue = output.monthlyRevenue.toString();
    const response = buildCenterResponse({
      question: "分析最近的测算项目经营情况",
      projects: [
        project({
          projectId: "P1",
          projectName: "临港港区短倒电动化项目",
          scenarios: [
            {
              id: "S1",
              name: "基准方案",
              status: "baseline",
              projectId: "P1",
              calculatedAt: "2026-09-12T09:00:00.000Z",
              metrics: {
                monthlyRevenue: revenue,
                monthlyTotalCost: output.monthlyTotalCost.toString(),
                monthlyProfit: output.monthlyProfit.toString(),
                profitMargin: output.profitMargin ? output.profitMargin.toString() : null,
                fleetSize: 20,
              },
            },
          ],
        }),
      ],
    });
    const blob = JSON.stringify(response);
    expect(response.intent).toBe("PROJECT_ANALYSIS");
    expect(blob).toContain(formatEngineMoney(revenue));
    expect(blob).not.toContain("456.8");
    expect(response.blocks.some((block) => block.type === "kpi")).toBe(true);
    expect(response.blocks.some((block) => block.type === "table")).toBe(true);
    expect(response.blocks.some((block) => block.type === "conclusion")).toBe(true);
  });

  it("电价敏感性使用引擎重算，不支持的变量不编造利润", () => {
    const input = profitableInput();
    const output = calculateProject(input);
    const hit = runSensitivity({
      input,
      variable: "electricity_price",
      changeMode: "PERCENT",
      minChange: "-20",
      maxChange: "20",
      step: "5",
    }).find((row) => Number(row.parameterChange) === 10);
    const projects = [
      project({
        projectId: "PRJ-DEMO-001",
        projectName: "临港港区短倒电动化项目",
        scenarios: [
          {
            id: "S1",
            name: "基准方案",
            status: "baseline",
            projectId: "PRJ-DEMO-001",
            calculatedAt: "2026-09-12T09:00:00.000Z",
            inputs: input,
            metrics: {
              monthlyRevenue: output.monthlyRevenue.toString(),
              monthlyTotalCost: output.monthlyTotalCost.toString(),
              monthlyProfit: output.monthlyProfit.toString(),
              profitMargin: output.profitMargin ? output.profitMargin.toString() : null,
              fleetSize: input.fleetSize,
            },
          },
        ],
      }),
    ];
    const response = buildCenterResponse({
      question: "如果临港项目电价上涨 10%，利润会怎么样？",
      projects,
      runSensitivity,
    });
    const calc = response.blocks.find((block) => block.type === "calculation");
    expect(response.intent).toBe("SENSITIVITY_ANALYSIS");
    expect(calc && calc.type === "calculation" ? calc.items[0].afterRaw : null).toBeCloseTo(Number(hit?.monthlyProfit), 2);

    const unsupported = buildCenterResponse({
      question: "如果临港项目空驶率上涨 10%，利润会怎么样？",
      projects,
      runSensitivity,
    });
    expect(unsupported.blocks.some((block) => block.type === "calculation")).toBe(false);
    expect(unsupported.message).toContain("不会编造");
  });

  it("导入预览只展示解析参数，对话按时间分组", () => {
    const preview = buildImportPreview("运输需求.xlsx", [
      { label: "运输距离", value: 126, unit: "km", status: "EXTRACTED", group: "基础信息" },
      { label: "空驶率", value: null, status: "MISSING", group: "车辆" },
    ]);
    expect(preview.message).toContain("运输需求.xlsx");
    expect(preview.actions.map((action) => action.label)).toEqual(["确认并开始测算", "修改参数"]);
    expect(JSON.stringify(preview)).toContain("空驶率");

    const grouped = groupConversations(
      [
        { updatedAt: new Date().toISOString() },
        { updatedAt: "2020-01-01T00:00:00.000Z" },
      ],
      new Date(),
    );
    expect(grouped.today).toHaveLength(1);
    expect(grouped.earlier).toHaveLength(1);
  });

  it("经营核心数字只能追溯到 CalculationResult 或 runSensitivity", () => {
    const repos = createMemoryDemoRepositories();
    const grouped = new Map<string, CenterProject>();
    for (const scenario of repos.scenarios.listScenarios()) {
      const ctx = repos.projects.getProjectContext(scenario.projectId);
      if (!grouped.has(scenario.projectId)) {
        grouped.set(
          scenario.projectId,
          project({
            projectId: scenario.projectId,
            projectName: ctx?.projectName || scenario.projectId,
            customer: ctx?.customer || "",
            scenarios: [],
          }),
        );
      }
      grouped.get(scenario.projectId)!.scenarios.push({
        id: scenario.id,
        name: scenario.name,
        status: scenario.status,
        projectId: scenario.projectId,
        calculatedAt: scenario.results?.calculatedAt || null,
        inputs: scenario.inputs,
        metrics: scenario.results?.metrics
          ? {
              monthlyRevenue: scenario.results.metrics.monthlyRevenue,
              monthlyTotalCost: scenario.results.metrics.monthlyTotalCost,
              monthlyProfit: scenario.results.metrics.monthlyProfit,
              profitMargin: scenario.results.metrics.profitMargin,
              fleetSize: scenario.results.metrics.fleetSize,
              monthlyFixedCost: scenario.results.metrics.monthlyFixedCost,
              monthlyVariableCost: scenario.results.metrics.monthlyVariableCost,
              monthlyFinanceCost: scenario.results.metrics.monthlyFinanceCost,
              monthlyTaxCost: scenario.results.metrics.monthlyTaxCost,
              profitPerVehicle: scenario.results.metrics.profitPerVehicle,
            }
          : null,
      });
    }
    const projects = [...grouped.values()];
    const allowed = new Set<string>();
    const remember = (value: string | number | null | undefined) => {
      const money = formatEngineMoney(value);
      const pct = formatEnginePercent(value);
      if (money !== "—") {
        allowed.add(money);
        allowed.add(`+${money}`);
        allowed.add(`-${money.replace(/^-/, "")}`);
      }
      if (pct !== "—") {
        allowed.add(pct);
        allowed.add(pct.replace("%", ""));
      }
    };
    let revenue = 0;
    let cost = 0;
    let profit = 0;
    const margins: number[] = [];
    const latestProfits: number[] = [];
    for (const item of projects) {
      for (const scenario of item.scenarios) {
        const metrics = scenario.metrics;
        if (!metrics) continue;
        for (const value of Object.values(metrics)) remember(value as string | number | null);
      }
      const calculated = item.scenarios.filter((scenario) => scenario.metrics && scenario.calculatedAt);
      const latest = calculated.length
        ? [...calculated].sort((a, b) => String(b.calculatedAt).localeCompare(String(a.calculatedAt)))[0]
        : item.scenarios.find((scenario) => scenario.metrics);
      const metrics = latest?.metrics;
      if (!metrics) continue;
      revenue += Number(metrics.monthlyRevenue) || 0;
      cost += Number(metrics.monthlyTotalCost) || 0;
      profit += Number(metrics.monthlyProfit) || 0;
      latestProfits.push(Number(metrics.monthlyProfit) || 0);
      if (metrics.profitMargin != null && Number.isFinite(Number(metrics.profitMargin))) margins.push(Number(metrics.profitMargin));
    }
    remember(revenue);
    remember(cost);
    remember(profit);
    remember(margins.length ? margins.reduce((sum, value) => sum + value, 0) / margins.length : null);
    if (latestProfits.length >= 2) {
      const sorted = [...latestProfits].sort((a, b) => b - a);
      remember(sorted[0] - sorted[sorted.length - 1]);
      remember(Math.abs(sorted[0] - sorted[1]));
    }

    const analysis = buildCenterResponse({
      question: "分析一下最近的测算项目经营情况，并给我关键结论",
      projects,
    });
    const compared = buildCenterResponse({
      question: "对比杭州和临港项目的盈利能力",
      projects,
    });
    const sensitivity = buildCenterResponse({
      question: "如果临港项目电价上涨10%，利润会怎么样？",
      projects,
      runSensitivity,
    });
    const calc = sensitivity.blocks.find((block) => block.type === "calculation");
    if (calc && calc.type === "calculation") {
      for (const item of calc.items) {
        remember(item.afterRaw);
        remember(item.deltaRaw);
        if (item.label === "利润率" && item.deltaRaw != null) {
          const pt = Math.abs(item.deltaRaw * 100).toFixed(2);
          allowed.add(pt);
          allowed.add(`+${pt}`);
          allowed.add(`-${pt}`);
        }
      }
    }

    const shown = [analysis, compared, sensitivity].flatMap((response) => collectMoneyTokens(response));
    expect(shown.length).toBeGreaterThan(0);
    const unexpected = shown.filter((token) => !tokenAllowed(token, allowed));
    expect(unexpected).toEqual([]);
    expect(JSON.stringify([analysis, compared, sensitivity])).not.toMatch(/NaN|Infinity/);

    const ui = fs.readFileSync(path.join(root, "demo-frontend-package/ai-center-ui.js"), "utf8");
    const pkg = fs.readFileSync(path.join(root, "demo-frontend-package/package.json"), "utf8");
    expect(ui).toContain("AI 在线解读暂时不可用，已使用本地分析结果，项目测算不受影响。");
    expect(ui).toContain("resetLeadershipDemo");
    expect(pkg).toContain("node --check ai-center-ui.js");
    expect(pkg).toContain("node --check import-app.js");
  });

  it("没有幅度时追问，不默认按 10% 重算", () => {
    const response = buildCenterResponse({
      question: "如果电价涨了呢？",
      projects: [],
      runSensitivity,
    });
    expect(response.intent).toBe("SENSITIVITY_ANALYSIS");
    expect(response.message).toMatch(/幅度/);
    expect(response.blocks.some((block) => block.type === "calculation")).toBe(false);
    expect(response.actions.map((action) => action.label)).toEqual(["+5%", "+10%", "+20%"]);
  });
});

function collectMoneyTokens(value: unknown, found: string[] = []): string[] {
  if (typeof value === "string") {
    found.push(...(value.match(/[+-]?\d{1,3}(?:,\d{3})+(?:\.\d+)?|[+-]?\d+\.\d{2}%?/g) || []));
    return found;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectMoneyTokens(item, found);
    return found;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (key === "values" || key === "highlightIndex" || key === "monthIndex") continue;
      collectMoneyTokens(child, found);
    }
  }
  return found;
}

function tokenAllowed(token: string, allowed: Set<string>) {
  if (allowed.has(token)) return true;
  const bare = token.replace(/^\+/, "");
  if (allowed.has(bare)) return true;
  if (token.endsWith("%") && allowed.has(token.slice(0, -1))) return true;
  return false;
}
