import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { extractFromText } from "../extract/heuristic";
import { validateAiExtractResult } from "../schema/validator";
import { orchestrateParse } from "../services/orchestrator";
import { parseUploadedFile } from "../services/document-parser";
import { mapWorkspaceToEngineInput, assertNoSilentZero } from "../map/to-engine";
import { parseIntentRuleBased } from "../copilot/intent";
import { applyScenarioPatch, runScenario } from "../copilot/scenario";
import { evaluateRisks } from "../services/risk-engine";
import { assertEngineSourced } from "../map/guard";
import { toCalculationResultV1 } from "../map/from-engine";
import { sampleInput } from "@/lib/engine/__tests__/fixture";
import { calculateScheme } from "@/lib/engine/calculate";
import { buildDemoDocx, buildDemoPdf, buildDemoXlsx, writeDemoBinaries } from "../demo-files";
import demoExpected from "../../../../demo/demo-expected.json";

const MEETING = readFileSync(path.join(process.cwd(), "demo/demo-meeting-notes.md"), "utf8");

describe("AI-01 schema from meeting notes", () => {
  it("固定会议纪要经过启发式/编排后 Schema 校验通过", async () => {
    const pipeline = await orchestrateParse({
      documents: [{ id: "m1", contentText: MEETING, sourceType: "meeting", fileName: "demo-meeting-notes.md" }],
      project: { projectName: "云南玉溪新能源运输项目", customerName: "XX钢铁" },
    });
    expect(validateAiExtractResult(pipeline.extract).ok).toBe(true);
    expect(pipeline.validation.ok).toBe(true);
  });
});

describe("AI-02 expected routes", () => {
  it("演示资料至少识别预期线路数量", () => {
    const result = extractFromText(MEETING, "纪要", "meeting");
    expect(result.routes.length).toBeGreaterThanOrEqual(demoExpected.routes_expected);
    expect(result.routes[0].origin_name).toBe(demoExpected.origin);
    expect(result.routes[0].destination_name).toBe(demoExpected.destination);
  });
});

describe("AI-03 llm fallback", () => {
  it("LLM 不可用时 heuristic fallback 可继续", async () => {
    const prev = process.env.AI_LLM_API_KEY;
    delete process.env.AI_LLM_API_KEY;
    const pipeline = await orchestrateParse({
      documents: [{ id: "m1", contentText: MEETING, sourceType: "meeting", fileName: "notes.md" }],
      project: { projectName: "云南玉溪", customerName: "XX钢铁" },
    });
    expect(pipeline.extractorKind).toBe("heuristic");
    expect(pipeline.fallbackNotice).toMatch(/基础解析/);
    expect(pipeline.extract.routes.length).toBeGreaterThanOrEqual(1);
    if (prev) process.env.AI_LLM_API_KEY = prev;
  });
});

describe("AI-04 parsers", () => {
  it("PDF/DOCX/XLSX 能得到非空文本", async () => {
    await writeDemoBinaries();
    const xlsx = await parseUploadedFile({ sourceType: "due_diligence", fileName: "demo.xlsx", buffer: await buildDemoXlsx() });
    const docx = await parseUploadedFile({ sourceType: "meeting", fileName: "demo.docx", buffer: buildDemoDocx() });
    const pdf = await parseUploadedFile({ sourceType: "due_diligence", fileName: "demo.pdf", buffer: buildDemoPdf() });
    expect(xlsx.contentText).toMatch(/昆钢/);
    expect(docx.contentText).toContain("3000");
    expect(pdf.contentText.length).toBeGreaterThan(0);
    expect(xlsx.parseStatus).toBe("extracted");
    expect(docx.parseStatus).toBe("extracted");
  });
});

describe("AI-05 P0 gate", () => {
  it("缺失运价时不允许正式测算", () => {
    const result = extractFromText("昆钢到北城，单程约65公里。", "x", "meeting");
    expect(result.routes[0].freight_price).toBeNull();
  });
});

describe("AI-06 reference status", () => {
  it("参考值状态必须是 reference 而不是 confirmed", () => {
    const mapped = mapWorkspaceToEngineInput({
      title: "t",
      parameters: [
        {
          field_code: "energy.electricity_price",
          value: "0.82",
          unit: "元/kWh",
          raw_value: "0.82",
          source_type: "reference",
          source_ref: "系统默认",
          confidence: 0.5,
          status: "reference",
          editable: true,
          reference_meta: {
            source_level: "system_default",
            sample_size: null,
            statistic_method: "platform_default",
            range_min: null,
            range_max: null,
            suggested_value: "0.82",
            applicable_condition: "系统默认",
            confidence_level: "default_only",
            updated_at: null,
          },
          updated_by: "系统",
        },
      ],
      routes: [
        {
          id: "r1",
          sort_no: 1,
          route_name: "昆钢-北城",
          origin_name: "昆钢",
          destination_name: "北城",
          distance_km: "65",
          volume_value: null,
          volume_unit: null,
          trips_per_day: null,
          trips_per_vehicle_month: "9",
          vehicle_count: "20",
          cargo_name: null,
          freight_price: "32",
          freight_price_unit: "PER_TON",
          load_ton: "33",
          toll_per_trip: null,
          loading_unloading_fee: null,
          information_fee: null,
          driver_cost_per_trip: null,
          status: "confirmed",
          enabled: true,
        },
      ],
    });
    expect(mapped.routes[0].segment.electricityPrice).toBe("0.82");
    expect(mapped.assumptions.some((item) => item.field_code === "energy.electricity_price" && item.status === "reference")).toBe(true);
  });
});

describe("AI-07 no silent zero", () => {
  it("关键成本未提取时只能作为可见假设 0，电价月租不得静默写成 0", () => {
    const mapped = mapWorkspaceToEngineInput({
      title: "t",
      projectFleetSize: "20",
      parameters: [],
      routes: [
        {
          id: "r1",
          sort_no: 1,
          route_name: "昆钢-北城",
          origin_name: "昆钢",
          destination_name: "北城",
          distance_km: "65",
          volume_value: "3000",
          volume_unit: "吨/日",
          trips_per_day: null,
          trips_per_vehicle_month: null,
          vehicle_count: "20",
          cargo_name: null,
          freight_price: "32",
          freight_price_unit: "PER_TON",
          load_ton: null,
          toll_per_trip: null,
          loading_unloading_fee: null,
          information_fee: null,
          driver_cost_per_trip: null,
          status: "confirmed",
          enabled: true,
        },
      ],
    });
    expect(mapped.routes[0].segment.tollPerTrip).toBe("0");
    expect(mapped.assumptions.some((item) => item.field_code === "cost.toll_per_trip")).toBe(true);
    expect(mapped.assumptions.find((item) => item.field_code === "cost.toll_per_trip")?.source_label).toBe("待确认按0测算");
    expect(mapped.assumptions.find((item) => item.field_code === "ops.operating_months_year")?.source_label).toBe("系统默认");
    expect(mapped.assumptions.find((item) => item.field_code === "vehicle.down_payment")?.value).toBe("80000");
    expect(mapped.routes[0].segment.electricityPrice).toBe("");
    expect(mapped.monthlyRentPerVehicle).toBeNull();
    expect(() => assertNoSilentZero(mapped)).not.toThrow();
  });
});

describe("AI-08/09/10 scenario", () => {
  it("运价下降5% patch 正确，结果来自引擎，且不污染 baseline", () => {
    const intent = parseIntentRuleBased("运价下降5%会怎么样？");
    expect(intent.kind).toBe("scenario");
    expect(intent.actions[0]).toMatchObject({ field_code: "revenue.freight_price", operation: "multiply", value: 0.95 });
    const baseline = sampleInput();
    const frozen = JSON.stringify(baseline);
    const patched = applyScenarioPatch(baseline, intent.actions);
    expect(Number(patched.routes[0].segments[0].freightPrice)).toBeCloseTo(Number(baseline.routes[0].segments[0].freightPrice) * 0.95, 6);
    expect(JSON.stringify(baseline)).toBe(frozen);
    const ran = runScenario(baseline, intent.actions);
    expect(ran.source).toBe("calculation_engine");
    expect(ran.scenario.source).toBe("calculation_engine");
    const engine = calculateScheme(patched);
    expect(ran.scenario.kpis.monthly_profit).toBe(engine.monthlyProfit.toFixed(2));
    expect(JSON.stringify(baseline)).toBe(frozen);
  });
});

describe("AI-11 risk engine", () => {
  it("风险等级来自 Risk Engine", () => {
    const input = sampleInput();
    const output = calculateScheme(input);
    const risk = evaluateRisks({ calcInput: input, output, parameters: [] });
    expect(risk.status).toBe("ready");
    expect(risk.items.map((i) => i.risk_code)).toEqual(expect.arrayContaining(["RISK-01", "RISK-02", "RISK-07"]));
    expect(risk.items.every((i) => ["高", "中", "低"].includes(i.level))).toBe(true);
  });
});

describe("AI-12 engine KPI guard", () => {
  it("LLM 输出的 KPI 不得覆盖 CalculationResultV1", () => {
    const result = toCalculationResultV1({
      ruleVersion: "RULE_PACK_V1",
      monthlyRevenue: "1",
      monthlyTotalCost: "1",
      monthlyProfit: "0",
      profitMargin: null,
      irr: null,
      monthlyVolume: "0",
      monthlyMileage: "0",
      firstPositiveMonth: null,
      cumulativeCashFlow: "0",
    });
    expect(result.source).toBe("calculation_engine");
    expect(() => assertEngineSourced(result)).not.toThrow();
    expect(() => assertEngineSourced({ ...result, source: "llm" as "calculation_engine" })).toThrow(/测算引擎/);
  });
});
