import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = path.resolve(__dirname, "../../..");
const demoRoot = path.join(root, "demo-frontend-package");

describe("Phase 3：Demo 融合冒烟", () => {
  it("静态资源与脚本语法存在", () => {
    expect(fs.existsSync(path.join(demoRoot, "lib/pm-calc.bundle.js"))).toBe(true);
    expect(fs.existsSync(path.join(demoRoot, "calculation-app.js"))).toBe(true);
    const html = fs.readFileSync(path.join(demoRoot, "index.html"), "utf8");
    expect(html).toContain("pm-calc.bundle.js");
    expect(html).toContain("calculation-app.js");
    expect(html).toContain("import-app.js");
    const app = fs.readFileSync(path.join(demoRoot, "app.js"), "utf8");
    const calcApp = fs.readFileSync(path.join(demoRoot, "calculation-app.js"), "utf8");
    expect(app).toContain("/projects/${id}/calculation");
    expect(app).toContain("项目测算中心");
    expect(app).toContain("CalculationApp");
    expect(calcApp).toContain("新建测算");
    expect(calcApp).toContain("测算项目");
    expect(calcApp).toContain("待完善测算");
    expect(calcApp).not.toContain('metric-label">计算引擎');
  });

  it("PmCalc bundle 可在假浏览器环境计算并读写仓库", () => {
    const code = fs.readFileSync(path.join(demoRoot, "lib/pm-calc.bundle.js"), "utf8");
    const store = new Map<string, string>();
    const localStorage = {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
    };
    const sandbox: Record<string, unknown> = {
      window: {},
      localStorage,
      console,
      setTimeout,
      clearTimeout,
    };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(code, sandbox, { filename: "pm-calc.bundle.js" });
    const PmCalc = (sandbox as { PmCalc?: typeof import("../../src/demo/browser-bridge").PmCalc }).PmCalc
      || (sandbox as { window: { PmCalc?: unknown } }).window.PmCalc;
    expect(PmCalc).toBeTruthy();
    const api = PmCalc as {
      ensureRepos: () => unknown;
      listScenarios: (id?: string) => { id: string; results: { metrics: { monthlyProfit: string } } | null }[];
      calculateProject: (input: unknown) => { monthlyProfit: { toString: () => string } };
      createDefaultInput: () => unknown;
      syncProjectFromShell: (p: Record<string, unknown>) => unknown;
      engineVersion: string;
    };
    api.ensureRepos();
    const scenarios = api.listScenarios("PRJ-DEMO-001");
    expect(scenarios.length).toBeGreaterThanOrEqual(2);
    expect(Number(scenarios[0].results!.metrics.monthlyProfit)).not.toBeNaN();
    api.syncProjectFromShell({
      id: "PRJ-DEMO-001",
      name: "临港港区短倒电动化项目",
      customer: "东澜绿色物流",
      region: "华东大区",
      owner: "林晨",
      type: "港口短倒",
      place: "上海",
      tractor: 20,
      trailer: 20,
    });
    const live = api.calculateProject(api.createDefaultInput());
    expect(live.monthlyProfit.toString()).toMatch(/^-?\d/);
    expect(api.engineVersion).toBeTruthy();
  });

  it("Phase 4 UI：面包屑 / 扁平指标 / 方案对比 / 无嵌套边框指标", () => {
    const calcApp = fs.readFileSync(path.join(demoRoot, "calculation-app.js"), "utf8");
    const css = fs.readFileSync(path.join(demoRoot, "styles.css"), "utf8");
    expect(calcApp).toContain("calc-breadcrumb");
    expect(calcApp).toContain("object-header project-object-header");
    expect(calcApp).toContain("calc-compare-panel");
    expect(calcApp).toContain("vehicle-metrics calc-result-metrics");
    expect(calcApp).toContain("演示基准参数");
    expect(calcApp).toContain("参数已变更，请重新测算");
    expect(calcApp).toContain("项目自动带入");
    expect(calcApp).toContain("开始测算");
    expect(calcApp).toContain("一键恢复演示数据");
    expect(calcApp).toContain("变化率");
    expect(css).toContain("Phase 4：项目测算模块");
    expect(css).toContain(".calc-breadcrumb");
    expect(css).toContain(".calc-stale-banner");
    expect(css).not.toContain(".calc-metric { border:1px solid");
  });

  it("Phase 5/6：AI 业务助手面板与代理路由存在，且前端无 API Key", () => {
    const calcApp = fs.readFileSync(path.join(demoRoot, "calculation-app.js"), "utf8");
    const server = fs.readFileSync(path.join(demoRoot, "server.mjs"), "utf8");
    const html = fs.readFileSync(path.join(demoRoot, "index.html"), "utf8");
    expect(calcApp).toContain("calc-ai-panel");
    expect(calcApp).toContain("AI 项目测算助手");
    expect(calcApp).toContain("确认并测算");
    expect(calcApp).toContain("runAssistant");
    expect(calcApp).toContain("/api/demo-ai/explain");
    expect(calcApp).toContain("/api/demo-ai/intent");
    expect(calcApp).toContain("AI 暂不可用");
    expect(server).toContain("DEMO_AI_API_KEY");
    expect(server).toContain("/api/demo-ai/explain");
    expect(server).toContain("/api/demo-ai/intent");
    expect(html).not.toMatch(/sk-[a-zA-Z0-9]/);
    expect(calcApp).not.toMatch(/DEMO_AI_API_KEY\s*=\s*['\"][^'\"]+/);
  });

  it("Phase 6：bundle 暴露 runAssistant，改参确认后走真实引擎", () => {
    const code = fs.readFileSync(path.join(demoRoot, "lib/pm-calc.bundle.js"), "utf8");
    const store = new Map<string, string>();
    const localStorage = {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
    };
    const sandbox: Record<string, unknown> = {
      window: {},
      localStorage,
      console,
      setTimeout,
      clearTimeout,
    };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(code, sandbox, { filename: "pm-calc.bundle.js" });
    const PmCalc = (sandbox as { PmCalc?: Record<string, unknown> }).PmCalc
      || (sandbox as { window: { PmCalc?: Record<string, unknown> } }).window.PmCalc;
    expect(PmCalc).toBeTruthy();
    const api = PmCalc as {
      ensureRepos: () => void;
      createAssistantSession: () => unknown;
      runAssistant: (p: {
        projectId: string;
        scenarioId: string;
        message: string;
        session?: unknown;
      }) => {
        confirmRequired: boolean;
        reply: string;
        session: unknown;
        scenarioId?: string;
      };
      confirmAssistantAction: (session: unknown) => { reply: string; scenarioId?: string };
      getScenario: (id: string) => { inputs: { routes: { segments: { electricityPrice: string }[] }[] }; results: { metrics: { monthlyProfit: string } } };
      calculateProject: (input: unknown) => { monthlyProfit: { toString: () => string } };
    };
    api.ensureRepos();
    const session = api.createAssistantSession();
    const ask = api.runAssistant({
      projectId: "PRJ-DEMO-001",
      scenarioId: "SCN-001-BASE",
      message: "把电价改成0.65元",
      session,
    });
    expect(ask.confirmRequired).toBe(true);
    expect(ask.reply).toMatch(/确认|重新测算|0\.65/);
    const done = api.confirmAssistantAction(ask.session);
    expect(done.reply).toMatch(/引擎|Calculation Engine/);
    const scenario = api.getScenario("SCN-001-BASE");
    expect(scenario.inputs.routes[0].segments[0].electricityPrice).toBe("0.65");
    expect(scenario.results.metrics.monthlyProfit).toBe(api.calculateProject(scenario.inputs).monthlyProfit.toString());
  });

  it("Phase 5：bundle 暴露 analyzeScenario / buildAiPayload，无 Key 时本地解读可用", () => {
    const code = fs.readFileSync(path.join(demoRoot, "lib/pm-calc.bundle.js"), "utf8");
    const store = new Map<string, string>();
    const localStorage = {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
    };
    const sandbox: Record<string, unknown> = {
      window: {},
      localStorage,
      console,
      setTimeout,
      clearTimeout,
    };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(code, sandbox, { filename: "pm-calc.bundle.js" });
    const PmCalc = (sandbox as { PmCalc?: Record<string, unknown> }).PmCalc
      || (sandbox as { window: { PmCalc?: Record<string, unknown> } }).window.PmCalc;
    expect(PmCalc).toBeTruthy();
    const api = PmCalc as {
      ensureRepos: () => void;
      analyzeScenario: (p: { scenarioId: string }) => { status: string; source: string; risks: unknown[] };
      buildAiPayload: (p: { scenarioId?: string; scenario?: unknown; localInsight: unknown }) => {
        engineMetrics: { monthlyProfit: string } | null;
        rules: string[];
      };
      listScenarios: (id?: string) => { id: string; results: { metrics: { monthlyProfit: string } } | null }[];
    };
    api.ensureRepos();
    const insight = api.analyzeScenario({ scenarioId: "SCN-001-BASE" });
    expect(insight.source).toBe("local_engine");
    expect(insight.status).toBe("ready");
    expect(insight.risks.length).toBeGreaterThan(0);
    const scenarios = api.listScenarios("PRJ-DEMO-001");
    const payload = api.buildAiPayload({
      scenario: scenarios[0],
      localInsight: insight,
    });
    expect(payload.engineMetrics?.monthlyProfit).toBeTruthy();
    expect(payload.rules.some((r) => r.includes("禁止重新计算"))).toBe(true);
  });
});
