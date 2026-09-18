import { describe, expect, it } from "vitest";
import { calculateProject, type SchemeCalculationInput } from "@/calculation";
import { createMemoryDemoRepositories } from "@/demo";
import {
  confirmPendingAction,
  createAssistantSession,
  runAssistantTurn,
} from "@/demo/ai/assistant";
import { parseAssistantIntent } from "@/demo/ai/intent";
import { validateLlmIntent } from "@/demo/ai/llm-intent";
import {
  applyParamPatches,
  getParamValue,
  listSegmentParamLocations,
} from "@/demo/ai/params";
import { multiRouteInput } from "@/calculation/__tests__/cases";
import { cloneJson } from "@/demo/utils";

function multiSegUnequalElec(): SchemeCalculationInput {
  const input = multiRouteInput();
  const segs = input.routes.flatMap((r) => r.segments);
  expect(segs.length).toBeGreaterThan(1);
  segs[0].electricityPrice = "0.72";
  segs[1].electricityPrice = "0.68";
  if (segs[2]) segs[2].electricityPrice = "0.81";
  return input;
}

function multiSegEqualElec(price = "0.80"): SchemeCalculationInput {
  const input = multiRouteInput();
  for (const route of input.routes) {
    for (const seg of route.segments) seg.electricityPrice = price;
  }
  return input;
}

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

  it("9类核心经营参数自然语言识别", () => {
    const cases: { q: string; field: string; op?: string; value?: number }[] = [
      { q: "把电价改成0.65元", field: "electricityPrice", op: "set", value: 0.65 },
      { q: "车辆增加10台", field: "fleetSize", op: "add", value: 10 },
      { q: "运价调整为120元", field: "freightPrice", op: "set", value: 120 },
      { q: "单车月趟次调整到28趟", field: "tripsPerVehicleMonth", op: "set", value: 28 },
      { q: "运输里程改成82公里", field: "distanceKm", op: "set", value: 82 },
      { q: "载重按32吨重新测算", field: "loadTon", op: "set", value: 32 },
      { q: "重载能耗调整到1.45", field: "loadedEnergyConsumption", op: "set", value: 1.45 },
      { q: "司机单趟成本改成120元", field: "driverCostPerTrip", op: "set", value: 120 },
      { q: "单车月租改成9800元", field: "monthlyRentPerVehicle", op: "set", value: 9800 },
      { q: "运价下降10%", field: "freightPrice", op: "multiply", value: 0.9 },
      { q: "趟次减少3趟", field: "tripsPerVehicleMonth", op: "add", value: -3 },
      { q: "电价上涨20%", field: "electricityPrice", op: "multiply", value: 1.2 },
    ];
    for (const c of cases) {
      const intent = parseAssistantIntent(c.q);
      expect(intent.kind, c.q).toMatch(/modify|create_scenario/);
      const hit = intent.patches.find((p) => p.field === c.field);
      expect(hit, c.q).toBeTruthy();
      if (c.op) expect(hit!.operation, c.q).toBe(c.op);
      if (c.value != null) expect(hit!.value, c.q).toBeCloseTo(c.value, 8);
    }
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
    expect(ask.pending?.scopeLabel).toBeTruthy();
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
    expect(cmp.compareRows?.[0].changeRate).toBeTruthy();
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

describe("P0 多线路 Param Scope", () => {
  it("多路段原值一致：确认卡标明影响全部N路段，确认后全部修改", () => {
    const repos = createMemoryDemoRepositories();
    const base = repos.scenarios.getScenario("SCN-001-BASE")!;
    const inputs = multiSegEqualElec("0.80");
    const saved = repos.scenarios.saveScenario({
      id: base.id,
      projectId: base.projectId,
      name: base.name,
      status: base.status,
      inputs,
      notes: base.notes,
    });
    const locsBefore = listSegmentParamLocations(saved.inputs, "electricityPrice");
    expect(locsBefore.every((l) => l.value === 0.8)).toBe(true);
    expect(locsBefore.length).toBeGreaterThan(1);

    const ask = runAssistantTurn({
      repos,
      projectId: base.projectId,
      scenarioId: saved.id,
      message: "把电价改成0.65",
      session: createAssistantSession(),
    });
    expect(ask.confirmRequired).toBe(true);
    expect(ask.pending?.type).toBe("modify");
    expect(ask.pending?.scopeLabel).toMatch(/全部\d+个路段/);
    expect(ask.reply).toMatch(/全部\d+个路段/);

    const fingerprintBefore = JSON.stringify(repos.scenarios.getScenario(saved.id)!.inputs);
    expect(fingerprintBefore).toContain('"0.80"');

    const done = confirmPendingAction({ repos, session: ask.session });
    expect(done.confirmRequired).toBe(false);
    const after = repos.scenarios.getScenario(saved.id)!;
    const locsAfter = listSegmentParamLocations(after.inputs, "electricityPrice");
    expect(locsAfter.every((l) => l.value === 0.65)).toBe(true);
    const live = calculateProject(after.inputs);
    expect(after.results!.metrics.monthlyProfit).toBe(live.monthlyProfit.toString());
  });

  it("多路段原值不一致：模糊指令必须要求 Scope，未明确前不得修改", () => {
    const repos = createMemoryDemoRepositories();
    const base = repos.scenarios.getScenario("SCN-001-BASE")!;
    const inputs = multiSegUnequalElec();
    const saved = repos.scenarios.saveScenario({
      id: base.id,
      projectId: base.projectId,
      name: base.name,
      status: base.status,
      inputs,
      notes: base.notes,
    });
    const before = cloneJson(saved.inputs);

    const ask = runAssistantTurn({
      repos,
      projectId: base.projectId,
      scenarioId: saved.id,
      message: "把电价改成0.65",
      session: createAssistantSession(),
    });
    expect(ask.pending?.type).toBe("await_scope");
    expect(ask.reply).toMatch(/不一致|作用范围|全部路段|指定线路|指定路段/);
    expect(JSON.stringify(repos.scenarios.getScenario(saved.id)!.inputs)).toBe(JSON.stringify(before));

    // 未选 scope 就点确认 → 仍不改
    const premature = confirmPendingAction({ repos, session: ask.session });
    expect(premature.confirmRequired).toBe(true);
    expect(JSON.stringify(repos.scenarios.getScenario(saved.id)!.inputs)).toBe(JSON.stringify(before));

    const choose = runAssistantTurn({
      repos,
      projectId: base.projectId,
      scenarioId: saved.id,
      message: "全部路段",
      session: ask.session,
    });
    expect(choose.pending?.type).toBe("modify");
    expect(choose.pending?.scopeLabel).toMatch(/全部/);
    expect(JSON.stringify(repos.scenarios.getScenario(saved.id)!.inputs)).toBe(JSON.stringify(before));

    const done = confirmPendingAction({ repos, session: choose.session });
    expect(done.confirmRequired).toBe(false);
    const locs = listSegmentParamLocations(repos.scenarios.getScenario(saved.id)!.inputs, "electricityPrice");
    expect(locs.every((l) => l.value === 0.65)).toBe(true);
  });

  it("指定路段修改只影响目标路段", () => {
    const inputs = multiSegUnequalElec();
    const target = listSegmentParamLocations(inputs, "electricityPrice")[1];
    const patched = applyParamPatches(inputs, [
      {
        field: "electricityPrice",
        label: "电价",
        operation: "set",
        value: 0.65,
        unit: "元/kWh",
        scope: "segment",
        routeId: target.routeId,
        segmentId: target.segmentId,
      },
    ]);
    const locs = listSegmentParamLocations(patched.inputs, "electricityPrice");
    for (const loc of locs) {
      if (loc.segmentId === target.segmentId) expect(loc.value).toBe(0.65);
      else expect(loc.value).not.toBe(0.65);
    }
  });
});

describe("P1 校验 / 隔离 / LLM Schema", () => {
  it("非法值不进入引擎、不写 Scenario", () => {
    const repos = createMemoryDemoRepositories();
    const base = repos.scenarios.getScenario("SCN-001-BASE")!;
    const origin = getParamValue(base.inputs, "electricityPrice");
    const ask = runAssistantTurn({
      repos,
      projectId: "PRJ-DEMO-001",
      scenarioId: base.id,
      message: "把电价改成-1",
      session: createAssistantSession(),
    });
    expect(ask.confirmRequired).toBe(false);
    expect(ask.pending).toBeNull();
    expect(ask.reply).toMatch(/非法|拦截|不能为负/);
    expect(getParamValue(repos.scenarios.getScenario(base.id)!.inputs, "electricityPrice")).toBe(origin);
  });

  it("明显异常值要求二次确认，确认前不改写", () => {
    const repos = createMemoryDemoRepositories();
    const base = repos.scenarios.getScenario("SCN-001-BASE")!;
    const origin = getParamValue(base.inputs, "fleetSize");
    const ask = runAssistantTurn({
      repos,
      projectId: "PRJ-DEMO-001",
      scenarioId: base.id,
      message: "车辆数改成10000台",
      session: createAssistantSession(),
    });
    expect(ask.pending?.type).toBe("await_abnormal_confirm");
    expect(getParamValue(repos.scenarios.getScenario(base.id)!.inputs, "fleetSize")).toBe(origin);
  });

  it("Project A/B AI 写操作隔离", () => {
    const repos = createMemoryDemoRepositories();
    const a = repos.scenarios.listScenarios("PRJ-DEMO-001").find((s) => s.status === "baseline")!;
    const ask = runAssistantTurn({
      repos,
      projectId: "PRJ-DEMO-008",
      scenarioId: a.id,
      message: "把电价改成0.65元",
      session: createAssistantSession(),
    });
    expect(ask.reply).toMatch(/不属于|拒绝|串改/);
    expect(ask.pending).toBeNull();
    expect(getParamValue(repos.scenarios.getScenario(a.id)!.inputs, "electricityPrice")).not.toBe(0.65);
  });

  it("LLM 返回含 KPI 字段时 Schema 校验失败", () => {
    expect(
      validateLlmIntent({
        kind: "modify",
        patches: [{ field: "electricityPrice", operation: "set", value: 0.65 }],
        monthlyProfit: 12345,
      }),
    ).toBeNull();
    expect(
      validateLlmIntent({
        kind: "modify",
        requiresConfirmation: true,
        patches: [{ field: "electricityPrice", operation: "set", value: 0.65 }],
      }),
    ).toMatchObject({ kind: "modify", parser: "llm" });
  });

  it("LLM 合法意图可走确认→引擎，且不覆盖引擎 KPI", () => {
    const repos = createMemoryDemoRepositories();
    const base = repos.scenarios.getScenario("SCN-001-BASE")!;
    const llm = validateLlmIntent({
      kind: "modify",
      requiresConfirmation: true,
      patches: [{ field: "electricityPrice", operation: "set", value: 0.65 }],
    })!;
    const ask = runAssistantTurn({
      repos,
      projectId: "PRJ-DEMO-001",
      scenarioId: base.id,
      message: "请帮我调低电价",
      session: createAssistantSession(),
      parsedIntent: llm,
    });
    expect(ask.source).toBe("llm_intent");
    expect(ask.confirmRequired).toBe(true);
    const done = confirmPendingAction({ repos, session: ask.session });
    const after = repos.scenarios.getScenario(base.id)!;
    const live = calculateProject(after.inputs);
    expect(after.results!.metrics.monthlyProfit).toBe(live.monthlyProfit.toString());
    expect(done.reply).not.toMatch(/12345/);
  });
});
