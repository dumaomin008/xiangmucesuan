import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { calculateProject, runSensitivity } from "@/calculation";
import {
  buildCenterResponse,
  buildImportPreview,
  detectIntent,
  formatEngineMoney,
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
});
