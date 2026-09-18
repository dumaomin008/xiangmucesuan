import { describe, expect, it } from "vitest";
import { calculateProject } from "@/calculation";
import {
  createMemoryDemoRepositories,
  DEMO_SCHEMA_VERSION,
  DEMO_STORAGE_KEYS,
  resetDemoData,
  type DemoRepositories,
} from "@/demo";
import { createMemoryStorage } from "@/demo/storage/kv";
import { VersionedStore } from "@/demo/storage/versioned";

function expectProfitSign(profit: string, sign: "positive" | "negative" | "near-zero-positive") {
  const n = Number(profit);
  if (sign === "positive") expect(n).toBeGreaterThan(0);
  if (sign === "negative") expect(n).toBeLessThan(0);
  if (sign === "near-zero-positive") {
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThan(40000);
  }
}

describe("Phase 2：Demo Repository / LocalStorage 数据层", () => {
  it("空库自动种子：3 项目 × 各 2 方案，结果为真实计算", () => {
    const demo = createMemoryDemoRepositories();
    const projects = demo.projects.listProjects();
    expect(projects.map((p) => p.projectId).sort()).toEqual(["PRJ-DEMO-001", "PRJ-DEMO-003", "PRJ-DEMO-008"]);

    for (const projectId of ["PRJ-DEMO-001", "PRJ-DEMO-008", "PRJ-DEMO-003"]) {
      const scenarios = demo.scenarios.listScenarios(projectId);
      expect(scenarios.length).toBe(2);
      expect(scenarios.some((s) => s.status === "baseline")).toBe(true);
      for (const s of scenarios) {
        expect(s.results).not.toBeNull();
        expect(s.calculationVersion).toBeTruthy();
        expect(s.inputs.schemeId).toBe(s.id);
        const live = calculateProject(s.inputs);
        expect(s.results!.metrics.monthlyProfit).toBe(live.monthlyProfit.toString());
        expect(s.results!.metrics.monthlyRevenue).toBe(live.monthlyRevenue.toString());
      }
    }

    expectProfitSign(demo.scenarios.getScenario("SCN-001-BASE")!.results!.metrics.monthlyProfit, "positive");
    expectProfitSign(demo.scenarios.getScenario("SCN-008-BASE")!.results!.metrics.monthlyProfit, "near-zero-positive");
    expectProfitSign(demo.scenarios.getScenario("SCN-003-BASE")!.results!.metrics.monthlyProfit, "negative");
  });

  it("getProject / ProjectContext 以 projectId 关联", () => {
    const demo = createMemoryDemoRepositories();
    const ctx = demo.projects.getProjectContext("PRJ-DEMO-001");
    expect(ctx).toMatchObject({
      projectId: "PRJ-DEMO-001",
      projectName: "临港港区短倒电动化项目",
      customer: "东澜绿色物流",
      tractorDemand: 20,
    });
    expect(demo.projects.getProject("NOPE")).toBeNull();
  });

  it("saveScenario：修改参数后结果真实联动", () => {
    const demo = createMemoryDemoRepositories();
    const base = demo.scenarios.getScenario("SCN-001-BASE")!;
    const before = base.results!.metrics.monthlyProfit;
    const inputs = structuredClone(base.inputs);
    for (const route of inputs.routes) {
      for (const seg of route.segments) {
        seg.freightPrice = String(Number(seg.freightPrice) * 1.2);
      }
    }
    const saved = demo.scenarios.saveScenario({
      id: base.id,
      projectId: base.projectId,
      name: base.name,
      inputs,
      status: "baseline",
    });
    expect(saved.results!.metrics.monthlyProfit).not.toBe(before);
    expect(Number(saved.results!.metrics.monthlyProfit)).toBeGreaterThan(Number(before));
    expect(saved.results!.metrics.monthlyProfit).toBe(calculateProject(inputs).monthlyProfit.toString());
  });

  it("duplicateScenario：新 ID，复制输入并重算", () => {
    const demo = createMemoryDemoRepositories();
    const origin = demo.scenarios.getScenario("SCN-001-BASE")!;
    const copy = demo.scenarios.duplicateScenario(origin.id, "基准方案副本");
    expect(copy.id).not.toBe(origin.id);
    expect(copy.projectId).toBe(origin.projectId);
    expect(copy.name).toBe("基准方案副本");
    expect(copy.inputs.fleetSize).toBe(origin.inputs.fleetSize);
    expect(copy.results!.metrics.monthlyProfit).toBe(origin.results!.metrics.monthlyProfit);
    expect(demo.scenarios.listScenarios("PRJ-DEMO-001").length).toBe(3);
  });

  it("deleteScenario / setBaseline", () => {
    const demo = createMemoryDemoRepositories();
    const copy = demo.scenarios.duplicateScenario("SCN-001-CMP");
    expect(demo.scenarios.deleteScenario(copy.id)).toBe(true);
    expect(demo.scenarios.getScenario(copy.id)).toBeNull();

    demo.scenarios.setBaseline("PRJ-DEMO-001", "SCN-001-CMP");
    expect(demo.scenarios.getScenario("SCN-001-CMP")!.status).toBe("baseline");
    expect(demo.scenarios.getScenario("SCN-001-BASE")!.status).toBe("calculated");
  });

  it("草稿与偏好写入版本化 envelope", () => {
    const demo = createMemoryDemoRepositories();
    const base = demo.scenarios.getScenario("SCN-001-BASE")!;
    const draft = demo.parameters.saveDraft({
      projectId: "PRJ-DEMO-001",
      scenarioId: base.id,
      name: "编辑中草稿",
      inputs: base.inputs,
    });
    expect(demo.parameters.getDraft(draft.id)?.name).toBe("编辑中草稿");

    const prefs = demo.parameters.savePreferences({ lastScenarioId: draft.id, compareScenarioIds: [base.id, "SCN-001-CMP"] });
    expect(prefs.lastScenarioId).toBe(draft.id);
    expect(prefs.compareScenarioIds).toEqual([base.id, "SCN-001-CMP"]);

    const raw = demo.storage.getItem(DEMO_STORAGE_KEYS.drafts)!;
    const envelope = JSON.parse(raw) as { schemaVersion: number; data: unknown[] };
    expect(envelope.schemaVersion).toBe(DEMO_SCHEMA_VERSION);
    expect(Array.isArray(envelope.data)).toBe(true);
  });

  it("schemaVersion 迁移：旧数据可被读取并升版本", () => {
    const storage = createMemoryStorage({
      [DEMO_STORAGE_KEYS.projects]: JSON.stringify({
        schemaVersion: 0,
        data: [
          {
            projectId: "PRJ-LEGACY",
            projectName: "旧项目",
            customer: "X",
            region: "华东大区",
            owner: "林晨",
            members: [],
            projectType: "干线物流",
            place: "上海",
            tractorDemand: 1,
            trailerDemand: 0,
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        ],
      }),
    });
    const store = new VersionedStore(storage, DEMO_STORAGE_KEYS.projects, () => []);
    const env = store.read();
    expect(env.schemaVersion).toBe(DEMO_SCHEMA_VERSION);
    expect(env.data[0].projectId).toBe("PRJ-LEGACY");
  });

  it("resetDemoData 可恢复种子", () => {
    const demo = createMemoryDemoRepositories();
    demo.scenarios.deleteScenario("SCN-001-BASE");
    expect(demo.scenarios.getScenario("SCN-001-BASE")).toBeNull();
    resetDemoData(demo);
    expect(demo.scenarios.getScenario("SCN-001-BASE")).not.toBeNull();
    expect(demo.projects.listProjects().length).toBe(3);
  });

  it("新建方案可保存为待确认草稿且不立即测算", () => {
    const demo = createMemoryDemoRepositories();
    const base = demo.scenarios.getScenario("SCN-001-BASE")!;
    const draft = demo.scenarios.saveScenario(
      {
        projectId: "PRJ-DEMO-001",
        name: "待确认方案",
        status: "draft",
        inputs: base.inputs,
        results: null,
        inputsSource: "demo_baseline",
        notes: "演示基准参数",
      },
      { recalculate: false },
    );
    expect(draft.status).toBe("draft");
    expect(draft.results).toBeNull();
    expect(draft.inputsSource).toBe("demo_baseline");
    const only003 = demo.scenarios.listScenarios("PRJ-DEMO-003");
    expect(only003.every((s) => s.projectId === "PRJ-DEMO-003")).toBe(true);
    expect(only003.some((s) => s.id === draft.id)).toBe(false);
    expect(demo.scenarios.listScenarios("PRJ-DEMO-001").some((s) => s.id === draft.id)).toBe(true);
  });

  it("关键参数修改后引擎结果全量联动，并写入指纹", () => {
    const demo = createMemoryDemoRepositories();
    const base = demo.scenarios.getScenario("SCN-001-BASE")!;
    const before = { ...base.results!.metrics };
    const inputs = structuredClone(base.inputs);
    const seg = inputs.routes[0].segments[0];
    seg.freightPrice = String(Number(seg.freightPrice) * 1.1);
    seg.electricityPrice = String(Number(seg.electricityPrice) * 1.2);
    seg.loadedEnergyConsumption = String(Number(seg.loadedEnergyConsumption) * 1.05);
    seg.distanceKm = String(Number(seg.distanceKm) + 5);
    seg.tripsPerVehicleMonth = String(Number(seg.tripsPerVehicleMonth) + 1);
    seg.loadTon = String(Number(seg.loadTon) + 1);
    seg.driverCostPerTrip = "50";
    inputs.fleetSize = inputs.fleetSize + 1;
    inputs.vehicle.fleetSize = inputs.fleetSize;
    inputs.vehicle.monthlyRentPerVehicle = String(Number(inputs.vehicle.monthlyRentPerVehicle) + 100);

    const saved = demo.scenarios.saveScenario({
      id: base.id,
      projectId: base.projectId,
      name: base.name,
      status: "baseline",
      inputs,
    });
    const live = calculateProject(inputs);
    expect(saved.results!.metrics.monthlyRevenue).toBe(live.monthlyRevenue.toString());
    expect(saved.results!.metrics.monthlyTotalCost).toBe(live.monthlyTotalCost.toString());
    expect(saved.results!.metrics.monthlyProfit).toBe(live.monthlyProfit.toString());
    expect(saved.results!.metrics.monthlyFixedCost).toBe(live.monthlyFixedCost.toString());
    expect(saved.results!.metrics.monthlyVariableCost).toBe(live.monthlyVariableCost.toString());
    expect(saved.results!.metrics.cumulativeCashFlow).toBe(live.cumulativeCashFlow.toString());
    expect(saved.results!.metrics.fleetSize).toBe(inputs.fleetSize);
    expect(saved.results!.inputFingerprint).toBeTruthy();
    expect(saved.results!.metrics.monthlyRevenue).not.toBe(before.monthlyRevenue);
  });

  it("页面不应直接依赖 storage key 字符串以外的副作用：仓库接口完备", () => {
    const demo: DemoRepositories = createMemoryDemoRepositories();
    expect(typeof demo.projects.getProject).toBe("function");
    expect(typeof demo.scenarios.listScenarios).toBe("function");
    expect(typeof demo.scenarios.getScenario).toBe("function");
    expect(typeof demo.scenarios.saveScenario).toBe("function");
    expect(typeof demo.scenarios.duplicateScenario).toBe("function");
    expect(typeof demo.scenarios.deleteScenario).toBe("function");
    expect(typeof demo.parameters.saveDraft).toBe("function");
  });
});
