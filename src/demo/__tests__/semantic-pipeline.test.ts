import { describe, expect, it } from "vitest";
import { calculateProject } from "@/calculation";
import { createMemoryDemoRepositories } from "@/demo";
import {
  applyServerParseResultTool,
  confirmExtractedParameterTool,
  confirmInferredParameterTool,
  createImportSessionTool,
  createScenarioFromImportTool,
  addImportFilesTool,
  resolveConflictTool,
} from "@/demo/import/tools";
import { canStartCalculation } from "@/demo/import/map-to-input";
import { TestDocumentExtractor } from "@/demo/import/real/ai-provider";
import { parseRealDocuments } from "@/demo/import/real/parse";
import { buildProjectDocx, buildSemanticConfirmXlsx, buildTransportXlsx, buildVehicleQuotePdf } from "@/demo/import/real/sample-docs";

const file = (fileId: string, fileName: string, bytes: Uint8Array) => ({ fileId, fileName, bytes });

describe("复杂资料确认后进入 Calculation Engine", () => {
  it("真实 xlsx/pdf/docx 解析，多候选确认后才测算", async () => {
    const pdf = await parseRealDocuments([file("p", "quote.pdf", buildVehicleQuotePdf())]);
    const docx = await parseRealDocuments([file("d", "note.docx", buildProjectDocx())]);
    expect(pdf.files[0]?.status).toBe("PARSED");
    expect(docx.files[0]?.status).toBe("PARSED");
    expect(pdf.parameters.find((item) => item.field === "fleetSize")?.normalizedValue).toBe(18);
    expect(docx.parameters.find((item) => item.field === "loadTon")?.normalizedValue).toBe(16);

    const bytes = await buildSemanticConfirmXlsx();
    const hostile = new TestDocumentExtractor(async (input) => ({
      items: [
        {
          field: "monthlyProfit",
          fact: "EXPLICIT",
          rawValue: 1000000,
          chunkId: input.chunks[0]?.id,
          evidenceText: "月利润",
        },
        {
          field: "fleetSize",
          fact: "EXPLICIT",
          rawValue: 40,
          normalizedValue: 40,
          chunkId: input.chunks.find((chunk) => chunk.text.includes("35"))?.id,
          evidenceText: "后续根据货量增加至35辆",
          qualifier: "模型另算",
        },
      ],
    }));
    const parsed = await parseRealDocuments([file("x", "semantic.xlsx", bytes)], { extractor: hostile });
    expect(parsed.parameters.some((item) => item.field === "monthlyProfit")).toBe(false);
    const fleet = parsed.parameters.find((item) => item.field === "fleetSize");
    const distance = parsed.parameters.find((item) => item.field === "distanceKm");
    expect(fleet?.status === "CONFLICT" || fleet?.status === "NEED_CONFIRMATION").toBe(true);
    expect(fleet?.normalizedValue == null).toBe(true);
    expect(distance?.valueRange).toEqual({ min: 80, max: 85 });
    expect(distance?.normalizedValue == null).toBe(true);
    expect(canStartCalculation(parsed.parameters).ok).toBe(false);

    const repos = createMemoryDemoRepositories();
    const { session } = createImportSessionTool(repos);
    addImportFilesTool(repos, session.id, [{ id: "x", name: "semantic.xlsx", size: bytes.length, parserMode: "real" }]);
    applyServerParseResultTool(repos, session.id, parsed);
    const fleetIndex = fleet?.alternatives?.findIndex((item) => Number(item.value) === 30) ?? -1;
    expect(fleetIndex).toBeGreaterThanOrEqual(0);
    resolveConflictTool(repos, session.id, "fleetSize", { alternativeIndex: fleetIndex });
    const distanceIndex = distance?.alternatives?.findIndex((item) => Number(item.value) === 80) ?? -1;
    resolveConflictTool(repos, session.id, "distanceKm", { alternativeIndex: distanceIndex });
    const pendingDefault = repos.imports.getSession(session.id)!.parameters.find((item) => item.offerSystemDefault && item.status === "MISSING");
    if (pendingDefault) {
      confirmExtractedParameterTool(repos, session.id, pendingDefault.field, pendingDefault.systemDefault as string | number, "CONFIRMED", {
        valueOrigin: "SYSTEM_DEFAULT",
        confirmedByUser: true,
      });
    }
    const inferred = repos.imports.getSession(session.id)!.parameters.find((item) => item.status === "INFERRED");
    if (inferred) confirmInferredParameterTool(repos, session.id, inferred.field, true);
    expect(canStartCalculation(repos.imports.getSession(session.id)!.parameters).ok).toBe(true);
    const created = createScenarioFromImportTool(repos, session.id, { createTempProject: true, tempName: "语义确认样例" });
    expect(created.scenario?.inputs.fleetSize).toBe(30);
    expect(created.scenario?.inputs.routes[0].segments[0].distanceKm).toBe("80");
    const again = calculateProject(created.scenario!.inputs);
    expect(again.monthlyProfit.toString()).toBe(created.scenario!.results!.metrics.monthlyProfit);
    expect(created.scenario?.results?.metrics.monthlyProfit).toBeTruthy();

    const stable = await parseRealDocuments([file("s", "body.xlsx", await buildTransportXlsx(30))]);
    expect(stable.parameters.find((item) => item.field === "fleetSize")?.normalizedValue).toBe(30);
  });
});
