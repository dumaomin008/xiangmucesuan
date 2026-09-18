import { describe, expect, it } from "vitest";
import { calculateProject } from "@/calculation";
import { createMemoryDemoRepositories } from "@/demo";
import {
  applyImportParamPatchesTool,
  applyServerParseResultTool,
  confirmExtractedParameterTool,
  confirmInferredParameterTool,
  createImportSessionTool,
  createScenarioFromImportTool,
  previewImportParamPatches,
  addImportFilesTool,
} from "@/demo/import/tools";
import { canStartCalculation } from "@/demo/import/map-to-input";
import { DemoDocumentParserAdapter } from "@/demo/import/parser-adapter";
import { createImportFileMeta } from "@/demo/import/parser-adapter";
import type { AiDocumentExtractor } from "@/demo/import/real/extractor";
import { parseRealDocuments } from "@/demo/import/real/parse";
import { buildProjectDocx, buildQuotePng, buildTransportXlsx, buildVehicleQuotePdf } from "@/demo/import/real/sample-docs";
import { normalizeByField } from "@/demo/import/real/unit-normalizer";
import { validateIncomingFile } from "@/demo/import/real/upload-policy";

const file = (fileId: string, fileName: string, bytes: Uint8Array) => ({ fileId, fileName, bytes });

describe("V2.1 真实资料解析", () => {
  it("真实读取 xlsx 正文，改文件名后参数不变，且不走 Demo 文件名映射", async () => {
    const bytes = await buildTransportXlsx(7);
    const named = await parseRealDocuments([file("f1", "项目运输需求.xlsx", bytes)]);
    const renamed = await parseRealDocuments([file("f2", "8f3c1a9e-random.xlsx", bytes)]);
    const fleetA = named.parameters.find((p) => p.field === "fleetSize");
    const fleetB = renamed.parameters.find((p) => p.field === "fleetSize");
    expect(fleetA?.normalizedValue).toBe(7);
    expect(fleetB?.normalizedValue).toBe(7);
    expect(fleetA?.sources[0]?.sheetName).toBe("车辆配置");
    expect(fleetA?.sources[0]?.cellRange).toContain("A");
    expect(named.parameters.find((p) => p.field === "projectName")?.normalizedValue).toBe("正文解析样例项目Alpha");
    expect(named.parameters.some((p) => p.field === "monthlyProfit")).toBe(false);

    const demo = DemoDocumentParserAdapter.parse(createImportFileMeta({ name: "项目运输需求.xlsx" }));
    expect(demo.parameters.find((p) => p.field === "fleetSize")?.normalizedValue).toBe(30);
    expect(fleetA?.normalizedValue).not.toBe(demo.parameters.find((p) => p.field === "fleetSize")?.normalizedValue);
  });

  it("PDF 保留页码，docx 保留段落和表格", async () => {
    const pdf = await parseRealDocuments([file("p1", "vehicle-quote.pdf", buildVehicleQuotePdf())]);
    const fleet = pdf.parameters.find((p) => p.field === "fleetSize");
    expect(fleet?.normalizedValue).toBe(18);
    expect(fleet?.sources[0]?.page).toBe(1);
    expect(pdf.parameters.find((p) => p.field === "distanceKm")?.normalizedValue).toBe(40);

    const docx = await parseRealDocuments([file("d1", "project-description.docx", buildProjectDocx())]);
    const load = docx.parameters.find((p) => p.field === "loadTon");
    expect(load?.normalizedValue).toBe(16);
    expect(load?.sources[0]?.paragraph).toBe(2);
    const driver = docx.parameters.find((p) => p.field === "driverCostPerTrip");
    expect(driver?.normalizedValue).toBe(80);
    expect(driver?.sources[0]?.table).toBe(1);
  });

  it("多文件一致合并、冲突不自动选择、单文件失败不影响其他文件", async () => {
    const a = await buildTransportXlsx(30);
    const b = await buildTransportXlsx(30);
    const merged = await parseRealDocuments([
      file("a", "one.xlsx", a),
      file("b", "two.xlsx", b),
    ]);
    const elec = merged.parameters.find((p) => p.field === "electricityPrice")!;
    expect(elec.status).not.toBe("CONFLICT");
    expect(elec.sources.length).toBeGreaterThanOrEqual(2);

    const conflicted = await parseRealDocuments([
      file("a", "one.xlsx", a),
      file("c", "other.xlsx", await buildTransportXlsx(40)),
    ]);
    const fleet = conflicted.parameters.find((p) => p.field === "fleetSize")!;
    expect(fleet.status).toBe("CONFLICT");
    expect(fleet.normalizedValue).toBeNull();
    expect(fleet.alternatives?.length).toBeGreaterThanOrEqual(2);

    const mixed = await parseRealDocuments([
      file("bad", "broken.pdf", new Uint8Array([1, 2, 3, 4])),
      file("ok", "body.xlsx", a),
    ]);
    expect(mixed.files.find((f) => f.fileId === "bad")?.status).toBe("FAILED");
    expect(mixed.files.find((f) => f.fileId === "ok")?.status).toBe("PARSED");
    expect(mixed.parameters.find((p) => p.field === "fleetSize")?.normalizedValue).toBe(30);
  });

  it("单位归一化、必填缺失、推断必须确认、补参必须确认", async () => {
    expect(normalizeByField("distanceKm", 85, "公里").unit).toBe("km");
    expect(normalizeByField("loadTon", 1.2, "t").unit).toBe("吨");
    expect(normalizeByField("electricityPrice", 0.68, "元/度").unit).toBe("元/kWh");
    expect(normalizeByField("monthlyRentPerVehicle", 8600, "元/车/月").ok).toBe(true);
    expect(normalizeByField("tripsPerVehicleMonth", 2, "趟/天").ok).toBe(false);
    expect(normalizeByField("fleetSize", 50, "%").normalizedValue).toBe(0.5);

    const onlyDoc = await parseRealDocuments([file("d", "note.docx", buildProjectDocx())]);
    expect(canStartCalculation(onlyDoc.parameters).ok).toBe(false);
    expect(onlyDoc.parameters.find((p) => p.field === "fleetSize")?.status).toBe("MISSING");

    const full = await parseRealDocuments([file("x", "body.xlsx", await buildTransportXlsx(30))]);
    const inferred = full.parameters.find((p) => p.field === "operatingMonthsYear")!;
    expect(inferred.status).toBe("INFERRED");
    expect(canStartCalculation(full.parameters).ok).toBe(false);

    const repos = createMemoryDemoRepositories();
    const { session } = createImportSessionTool(repos);
    addImportFilesTool(repos, session.id, [{ id: "x", name: "body.xlsx", size: 10, parserMode: "real" }]);
    applyServerParseResultTool(repos, session.id, full);
    const before = repos.imports.getSession(session.id)!.parameters.find((p) => p.field === "fleetSize")!.normalizedValue;
    const preview = previewImportParamPatches(repos.imports.getSession(session.id)!, [
      { field: "fleetSize", value: 99, label: "车辆数", unit: "台" },
    ]);
    expect(preview.changes[0].to).toContain("99");
    expect(repos.imports.getSession(session.id)!.parameters.find((p) => p.field === "fleetSize")!.normalizedValue).toBe(before);
    applyImportParamPatchesTool(repos, session.id, [{ field: "fleetSize", value: 30, label: "车辆数", unit: "台" }]);
  });

  it("拒绝 KPI / projectId / Prompt Injection，AI 故障仍保留正文结果", async () => {
    const bytes = await buildTransportXlsx(30);
    const evil: AiDocumentExtractor = {
      async extract(input) {
        return {
          items: [
            { field: "monthlyProfit", fact: "EXPLICIT", rawValue: 999999, chunkId: input.chunks[0]?.id },
            { field: "projectId", fact: "EXPLICIT", rawValue: "P-HACK", chunkId: input.chunks[0]?.id },
            { field: "irr", fact: "EXPLICIT", rawValue: 0.99, chunkId: input.chunks[0]?.id },
          ],
        };
      },
    };
    const attacked = await parseRealDocuments([file("x", "inject.xlsx", bytes)], {
      extractor: evil,
      projects: [{ projectId: "PRJ-DEMO-001", projectName: "临港港区短倒电动化项目", customer: "东澜绿色物流", region: "华东大区" }],
    });
    expect(attacked.injectionSeen).toBe(true);
    expect(attacked.parameters.some((p) => p.field === "monthlyProfit" || p.field === "projectId" || p.field === "irr")).toBe(false);
    expect(attacked.rejectedFields).toEqual(expect.arrayContaining(["monthlyProfit", "projectId"]));
    expect(attacked.projectCandidates).toEqual([]);
    expect(attacked.parameters.find((p) => p.field === "fleetSize")?.normalizedValue).toBe(30);

    const down: AiDocumentExtractor = {
      async extract() {
        throw new Error("model down");
      },
    };
    const fallback = await parseRealDocuments([file("x", "body.xlsx", bytes)], { extractor: down });
    expect(fallback.ai).toBe("llm_failed_deterministic");
    expect(fallback.parameters.find((p) => p.field === "fleetSize")?.normalizedValue).toBe(30);
    expect(validateIncomingFile({ name: "../evil.exe", size: 10 }).ok).toBe(false);
  });

  it("图片不按文件名造参数；确认后创建 Scenario 并调用真实引擎", async () => {
    const image = await parseRealDocuments([file("img", "车辆数30.png", buildQuotePng())]);
    expect(image.files[0]?.warnings.join("")).toContain("VISION_REQUIRED");
    expect(image.parameters.find((p) => p.field === "fleetSize")?.status).toBe("MISSING");

    const repos = createMemoryDemoRepositories();
    const { session } = createImportSessionTool(repos);
    const bytes = await buildTransportXlsx(30);
    addImportFilesTool(repos, session.id, [{ id: "x", name: "body.xlsx", size: bytes.length, parserMode: "real" }]);
    const parsed = await parseRealDocuments([file("x", "body.xlsx", bytes)]);
    applyServerParseResultTool(repos, session.id, parsed);
    expect(createScenarioFromImportTool(repos, session.id, { createTempProject: true }).scenario).toBeNull();

    confirmInferredParameterTool(repos, session.id, "operatingMonthsYear", true);
    const pendingDefault = repos.imports.getSession(session.id)!.parameters.find((p) => p.offerSystemDefault);
    expect(pendingDefault?.field).toBe("emptyEnergyConsumption");
    confirmExtractedParameterTool(repos, session.id, "emptyEnergyConsumption", pendingDefault!.systemDefault as string, "CONFIRMED", {
      valueOrigin: "SYSTEM_DEFAULT",
      confirmedByUser: true,
    });
    expect(canStartCalculation(repos.imports.getSession(session.id)!.parameters).reasons).toEqual([]);
    const created = createScenarioFromImportTool(repos, session.id, { createTempProject: true, tempName: "正文解析样例项目Alpha" });
    expect(created.scenario?.results?.metrics.monthlyProfit).toBeTruthy();
    const again = calculateProject(created.scenario!.inputs);
    expect(again.monthlyProfit.toString()).toBe(created.scenario!.results!.metrics.monthlyProfit);
    expect(created.scenario!.inputs.fleetSize).toBe(30);
  });
});
