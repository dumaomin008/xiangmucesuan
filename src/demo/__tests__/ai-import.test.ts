import { describe, expect, it } from "vitest";
import { calculateProject } from "@/calculation";
import { createMemoryDemoRepositories } from "@/demo";
import {
  addImportFilesTool,
  applyImportParamPatchesTool,
  confirmInferredParameterTool,
  createImportSessionTool,
  createScenarioFromImportTool,
  loadDemoSampleFilesTool,
  parseImportFilesTool,
  resolveConflictTool,
} from "@/demo/import/tools";
import { mapToSchemeCalculationInput, canStartCalculation } from "@/demo/import/map-to-input";
import { mergeExtractedParameters, parseImportFileDemo, createImportFileMeta } from "@/demo/import/parser-adapter";
import { parseImportSupplementIntent } from "@/demo/import/supplement";
import { normalizeElectricity, parseValueWithUnit } from "@/demo/import/normalize";

describe("V2 AI 资料导入", () => {
  it("单位标准化保留原文", () => {
    const elec = normalizeElectricity(0.68, "元/度");
    expect(elec.unit).toBe("元/kWh");
    expect(elec.originalUnit).toBe("元/度");
    expect(elec.normalizedValue).toBe(0.68);
    const dist = parseValueWithUnit("85公里");
    expect(dist.normalizedValue).toBe(85);
    expect(dist.unit).toBe("km");
  });

  it("多文件解析：识别缺失/冲突/推断，单文件失败不拖垮全部", () => {
    const repos = createMemoryDemoRepositories();
    const { session } = createImportSessionTool(repos);
    loadDemoSampleFilesTool(repos, session.id);
    addImportFilesTool(repos, session.id, [{ name: "损坏文件-fail.pdf", size: 100 }]);
    const parsed = parseImportFilesTool(repos, session.id);
    expect(parsed.session?.status).toBe("review");
    const failed = parsed.session!.files.find((f) => /fail/.test(f.name));
    expect(failed?.status).toBe("FAILED");
    expect(parsed.session!.files.some((f) => f.status === "PARSED")).toBe(true);

    const summary = {
      missing: parsed.session!.parameters.filter((p) => p.status === "MISSING").length,
      conflict: parsed.session!.parameters.filter((p) => p.status === "CONFLICT").length,
      inferred: parsed.session!.parameters.filter((p) => p.status === "INFERRED").length,
    };
    expect(summary.conflict).toBeGreaterThanOrEqual(1);
    expect(summary.missing).toBeGreaterThanOrEqual(2);
    expect(summary.inferred).toBeGreaterThanOrEqual(1);

    const fleet = parsed.session!.parameters.find((p) => p.field === "fleetSize")!;
    expect(fleet.status).toBe("CONFLICT");
    expect(fleet.sources.length).toBeGreaterThanOrEqual(2);
  });

  it("冲突未解决 / 必填缺失禁止测算；确认后真实调用引擎", () => {
    const repos = createMemoryDemoRepositories();
    const { session } = createImportSessionTool(repos);
    loadDemoSampleFilesTool(repos, session.id);
    parseImportFilesTool(repos, session.id);

    const blocked = createScenarioFromImportTool(repos, session.id, { createTempProject: true });
    expect(blocked.scenario).toBeNull();
    expect(blocked.errors.length).toBeGreaterThan(0);

    resolveConflictTool(repos, session.id, "fleetSize", { alternativeIndex: 0 });
    const s1 = repos.imports.getSession(session.id)!;
    const inferred = s1.parameters.find((p) => p.status === "INFERRED");
    if (inferred) confirmInferredParameterTool(repos, session.id, inferred.field, true);

    applyImportParamPatchesTool(repos, session.id, [
      { field: "monthlyRentPerVehicle", value: 9800, label: "单车月租", unit: "元" },
      { field: "loadedEnergyConsumption", value: 1.45, label: "重载能耗", unit: "kWh/km" },
      { field: "driverCostPerTrip", value: 120, label: "司机单趟成本", unit: "元/趟" },
    ]);

    const gate = canStartCalculation(repos.imports.getSession(session.id)!.parameters);
    expect(gate.ok).toBe(true);

    const created = createScenarioFromImportTool(repos, session.id, {
      linkSuggested: true,
      createTempProject: true,
    });
    expect(created.errors).toEqual([]);
    expect(created.scenario?.results).toBeTruthy();
    const live = calculateProject(created.scenario!.inputs);
    expect(created.scenario!.results!.metrics.monthlyProfit).toBe(live.monthlyProfit.toString());
    expect(created.scenario!.projectId).toBeTruthy();
  });

  it("AI 补参意图解析 + 确认写入 ExtractedParameter，不写 KPI", () => {
    const patches = parseImportSupplementIntent("月租9800，重载能耗1.45，司机单趟120");
    expect(patches.map((p) => p.field).sort()).toEqual([
      "driverCostPerTrip",
      "loadedEnergyConsumption",
      "monthlyRentPerVehicle",
    ].sort());

    const repos = createMemoryDemoRepositories();
    const { session } = createImportSessionTool(repos);
    loadDemoSampleFilesTool(repos, session.id);
    parseImportFilesTool(repos, session.id);
    applyImportParamPatchesTool(repos, session.id, patches);
    const rent = repos.imports.getSession(session.id)!.parameters.find((p) => p.field === "monthlyRentPerVehicle")!;
    expect(rent.status).toBe("MANUAL");
    expect(rent.normalizedValue).toBe(9800);
  });

  it("参数映射白名单：非法字段丢弃；Prompt Injection 文本不当指令", () => {
    const file = createImportFileMeta({ name: "项目运输需求.xlsx" });
    const batch = parseImportFileDemo(file);
    const injected = mergeExtractedParameters([
      {
        ...batch,
        parameters: [
          ...batch.parameters,
          {
            field: "monthlyProfit",
            label: "月利润",
            value: 1000000,
            normalizedValue: 1000000,
            status: "EXTRACTED",
            sources: [],
            required: false,
            group: "finance",
          } as never,
        ],
      },
    ]);
    // whitelist 在 map 阶段丢弃
    const ready = injected.map((p) =>
      p.status === "CONFLICT" || p.status === "INFERRED" || p.status === "MISSING"
        ? { ...p, status: "CONFIRMED" as const, normalizedValue: p.normalizedValue ?? 1, value: p.value ?? 1 }
        : p,
    );
    // 填必填
    for (const p of ready) {
      if (p.required && (p.normalizedValue == null || p.status === "MISSING")) {
        p.normalizedValue = p.field === "fleetSize" ? 30 : 1;
        p.value = p.normalizedValue;
        p.status = "MANUAL";
      }
      if (p.status === "INFERRED") p.status = "CONFIRMED";
      if (p.status === "CONFLICT") {
        p.status = "CONFIRMED";
        p.normalizedValue = 30;
        p.value = 30;
      }
    }
    const mapped = mapToSchemeCalculationInput(ready);
    expect(mapped.warnings.some((e) => e.includes("非法字段"))).toBe(true);
    expect(mapped.ok).toBe(true);
    expect(mapped.inputs).toBeTruthy();
    // 引擎结果不等于注入的 1000000
    const live = calculateProject(mapped.inputs!);
    expect(Number(live.monthlyProfit.toString())).not.toBe(1000000);
  });

  it("项目隔离：导入创建的方案绑定指定 projectId", () => {
    const repos = createMemoryDemoRepositories();
    const { session } = createImportSessionTool(repos);
    loadDemoSampleFilesTool(repos, session.id);
    parseImportFilesTool(repos, session.id);
    resolveConflictTool(repos, session.id, "fleetSize", { alternativeIndex: 0 });
    const inferred = repos.imports.getSession(session.id)!.parameters.find((p) => p.status === "INFERRED");
    if (inferred) confirmInferredParameterTool(repos, session.id, inferred.field, true);
    applyImportParamPatchesTool(repos, session.id, [
      { field: "monthlyRentPerVehicle", value: 9800, label: "单车月租" },
      { field: "loadedEnergyConsumption", value: 1.45, label: "重载能耗" },
      { field: "driverCostPerTrip", value: 120, label: "司机成本" },
    ]);
    const created = createScenarioFromImportTool(repos, session.id, { projectId: "PRJ-DEMO-001" });
    expect(created.scenario?.projectId).toBe("PRJ-DEMO-001");
    expect(repos.scenarios.listScenarios("PRJ-DEMO-008").some((s) => s.id === created.scenario?.id)).toBe(false);
  });
});
