import { describe, expect, it } from "vitest";
import { calculateProject } from "@/calculation";
import { createMemoryDemoRepositories } from "@/demo";
import {
  confirmPendingAction,
  createAssistantSession,
  runAssistantTurn,
} from "@/demo/ai/assistant";
import { parseAssistantIntent } from "@/demo/ai/intent";
import { getParamValue } from "@/demo/ai/params";

describe("AI 业务助手 V1", () => {
  it("意图：查询 / 诊断 / 改参 / 创建方案 / 对比 / 汇报", () => {
    expect(parseAssistantIntent("这个项目月利润多少？").kind).toBe("query");
    expect(parseAssistantIntent("为什么这个项目利润比较低？").kind).toBe("diagnose");
    expect(parseAssistantIntent("把电价改成0.65元").kind).toBe("modify");
    expect(parseAssistantIntent("把电价改成0.65元").patches[0]).toMatchObject({
      field: "electricityPrice",
      operation: "set",
      value: 0.65,
    });
    expect(parseAssistantIntent("如果电价从0.8元降到0.65元呢？").patches[0].value).toBe(0.65);
    expect(parseAssistantIntent("如果电价下降0.1元会怎么样？").patches[0]).toMatchObject({
      field: "electricityPrice",
      operation: "add",
      value: -0.1,
    });
    expect(parseAssistantIntent("那如果车辆增加10台呢？").patches[0]).toMatchObject({
      field: "fleetSize",
      operation: "add",
      value: 10,
    });
    expect(parseAssistantIntent("帮我做一个低电价方案，电价按照0.65元。").kind).toBe("create_scenario");
    expect(parseAssistantIntent("帮我比较刚才两个方案。").kind).toBe("compare");
    expect(parseAssistantIntent("帮我生成一段给领导汇报的结论。").kind).toBe("report");
    expect(parseAssistantIntent("确认并测算").kind).toBe("confirm");
  });

  it("领导演示主链路：诊断 → 改电价确认测算 → 加车 → 对比 → 汇报", () => {
    const repos = createMemoryDemoRepositories();
    let session = createAssistantSession();
    const projectId = "PRJ-DEMO-008";
    const base = repos.scenarios.listScenarios(projectId).find((s) => s.status === "baseline")!;
    expect(base.results).toBeTruthy();

    const d1 = runAssistantTurn({
      repos,
      projectId,
      scenarioId: base.id,
      message: "帮我分析一下这个项目为什么利润比较低？",
      session,
    });
    expect(d1.intent.kind).toBe("diagnose");
    expect(d1.reply).toMatch(/月利润|利润率|引擎/);
    session = d1.session;

    const ask = runAssistantTurn({
      repos,
      projectId,
      scenarioId: base.id,
      message: "如果电价从0.8元降到0.65元呢？",
      session,
    });
    expect(ask.confirmRequired).toBe(true);
    expect(ask.pending?.changes[0]).toMatchObject({ label: "电价", to: "0.65" });
    session = ask.session;

    const beforeProfit = Number(base.results!.metrics.monthlyProfit);
    const done = confirmPendingAction({ repos, session });
    expect(done.confirmRequired).toBe(false);
    expect(done.scenarioId).toBe(base.id);
    const after = repos.scenarios.getScenario(base.id)!;
    expect(getParamValue(after.inputs, "electricityPrice")).toBe(0.65);
    const live = calculateProject(after.inputs);
    expect(after.results!.metrics.monthlyProfit).toBe(live.monthlyProfit.toString());
    expect(Number(after.results!.metrics.monthlyProfit)).not.toBe(beforeProfit);
    expect(done.reply).toMatch(/Calculation Engine|引擎/);
    session = done.session;

    // 创建低电价对照方案（基于当前已改电价的方案再复制命名）
    const createAsk = runAssistantTurn({
      repos,
      projectId,
      scenarioId: base.id,
      message: "帮我做一个低电价方案，电价按照0.65元。",
      session,
    });
    expect(createAsk.confirmRequired).toBe(true);
    session = createAsk.session;
    const created = confirmPendingAction({ repos, session });
    expect(created.scenarioId).toBeTruthy();
    expect(created.reply).toMatch(/已创建方案/);
    session = created.session;

    const addAsk = runAssistantTurn({
      repos,
      projectId,
      scenarioId: created.scenarioId!,
      message: "那如果车辆增加10台呢？",
      session,
    });
    expect(addAsk.confirmRequired).toBe(true);
    session = addAsk.session;
    const added = confirmPendingAction({ repos, session });
    const fleetScenario = repos.scenarios.getScenario(added.scenarioId!)!;
    expect(getParamValue(fleetScenario.inputs, "fleetSize")).toBe(
      (getParamValue(after.inputs, "fleetSize") || 0) + 10,
    );
    session = added.session;

    const cmp = runAssistantTurn({
      repos,
      projectId,
      scenarioId: fleetScenario.id,
      message: "帮我比较刚才两个方案。",
      session,
    });
    expect(cmp.intent.kind).toBe("compare");
    expect(cmp.compareRows?.length).toBeGreaterThan(0);
    expect(cmp.reply).toMatch(/月利润/);

    const report = runAssistantTurn({
      repos,
      projectId,
      scenarioId: fleetScenario.id,
      message: "帮我生成一段给领导汇报的结论。",
      session: cmp.session,
    });
    expect(report.intent.kind).toBe("report");
    expect(report.reply).toMatch(/汇报结论|Calculation Engine/);
  });

  it("未确认前不改写方案；取消后保持原值", () => {
    const repos = createMemoryDemoRepositories();
    const base = repos.scenarios.getScenario("SCN-001-BASE")!;
    const origin = getParamValue(base.inputs, "electricityPrice");
    const ask = runAssistantTurn({
      repos,
      projectId: "PRJ-DEMO-001",
      scenarioId: base.id,
      message: "把电价改成0.65元",
      session: createAssistantSession(),
    });
    expect(getParamValue(repos.scenarios.getScenario(base.id)!.inputs, "electricityPrice")).toBe(origin);
    const cancel = runAssistantTurn({
      repos,
      projectId: "PRJ-DEMO-001",
      scenarioId: base.id,
      message: "取消",
      session: ask.session,
    });
    expect(cancel.pending).toBeNull();
    expect(getParamValue(repos.scenarios.getScenario(base.id)!.inputs, "electricityPrice")).toBe(origin);
  });

  it("查询类直接读真实结果，不编造", () => {
    const repos = createMemoryDemoRepositories();
    const base = repos.scenarios.getScenario("SCN-001-BASE")!;
    const res = runAssistantTurn({
      repos,
      projectId: "PRJ-DEMO-001",
      scenarioId: base.id,
      message: "当前IRR是多少？",
      session: createAssistantSession(),
    });
    if (base.results!.metrics.irr) {
      expect(res.reply).toContain((Number(base.results!.metrics.irr) * 100).toFixed(2));
    } else {
      expect(res.reply).toMatch(/暂不可用|无解/);
    }
  });
});
