import { describe, expect, it } from "vitest";
import { calculateScheme } from "@/lib/engine/calculate";
import { sampleInput } from "@/lib/engine/__tests__/fixture";
import { evaluateP0Gate, p0GateMessage } from "../p0-gate";
import { mapWorkspaceToEngineInput } from "../map/to-engine";
import { sanitizeScenarioIntent } from "../copilot/patch-schema";
import { resolveIntent } from "../copilot/parse-intent";
import { parseIntentRuleBased } from "../copilot/intent";
import { runCopilotTurn } from "../services/copilot-run";
import type { AiRouteDraft, QuestionRecord } from "../schema/types";

function completeRoute(overrides: Partial<AiRouteDraft> = {}): AiRouteDraft {
  return {
    id: "r1",
    sort_no: 1,
    route_name: "昆钢-北城",
    origin_name: "昆钢",
    destination_name: "北城",
    distance_km: "65",
    volume_value: "3000",
    volume_unit: "吨/日",
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
    ...overrides,
  };
}

describe("Copilot LLM Intent Parser", () => {
  it("规则能识别时不调用大模型", async () => {
    let llmCalled = false;
    const intent = await resolveIntent("运价下降5%会怎么样？", async () => {
      llmCalled = true;
      return { kind: "scenario", title: "不该用", actions: [] };
    });
    expect(llmCalled).toBe(false);
    expect(intent.parser).toBe("rule");
    expect(intent.kind).toBe("scenario");
    expect(parseIntentRuleBased("运价下降5%会怎么样？").kind).toBe("scenario");
  });

  it("规则识别不了时由大模型生成白名单 ScenarioPatch，数字仍由引擎重算", async () => {
    const baseline = sampleInput();
    const frozen = JSON.stringify(baseline);
    let llmCalled = false;
    const turn = await runCopilotTurn({
      question: "把满载电耗改成1.5",
      baselineInput: baseline,
      llmComplete: async () => {
        llmCalled = true;
        return {
          kind: "scenario",
          title: "满载电耗1.5",
          actions: [{ field_code: "energy.loaded_consumption", scope: "all_routes", operation: "set", value: 1.5 }],
        };
      },
    });
    expect(llmCalled).toBe(true);
    expect(turn.intent.parser).toBe("llm");
    expect(turn.intent.kind).toBe("scenario");
    expect(turn.intent.actions).toEqual([
      { field_code: "energy.loaded_consumption", scope: "all_routes", operation: "set", value: 1.5 },
    ]);
    expect(turn.scenario?.source).toBe("calculation_engine");
    expect(turn.explanation).toMatch(/Calculation Engine|测算引擎/);
    expect(JSON.stringify(baseline)).toBe(frozen);
    const engine = calculateScheme(turn.scenario!.patchedInput);
    expect(turn.scenario?.scenario.kpis.monthly_profit).toBe(engine.monthlyProfit.toFixed(2));
    expect(turn.baselineUnchanged).toBe(true);
  });

  it("拒绝 KPI 或白名单外字段，不把模型数字当测算结果", () => {
    expect(() =>
      sanitizeScenarioIntent({
        kind: "scenario",
        title: "利润100万",
        actions: [{ field_code: "monthly_profit", scope: "project", operation: "set", value: 1000000 }],
      }),
    ).toThrow(/禁止|白名单/);
    expect(() =>
      sanitizeScenarioIntent({
        kind: "scenario",
        title: "收入",
        actions: [{ field_code: "kpis.monthly_revenue", scope: "project", operation: "set", value: 1 }],
      }),
    ).toThrow();
  });

  it("大模型不可用或输出非法时回退解释，不编造场景", async () => {
    const prev = process.env.AI_LLM_API_KEY;
    delete process.env.AI_LLM_API_KEY;
    try {
      const fallback = await resolveIntent("帮我看看这个项目能不能做");
      expect(fallback.kind).toBe("explain");
      expect(fallback.parser).toBe("fallback");
      expect(fallback.actions).toEqual([]);
    } finally {
      if (prev) process.env.AI_LLM_API_KEY = prev;
    }

    const invalid = await resolveIntent("把满载电耗改成1.5", async () => ({
      kind: "scenario",
      title: "非法",
      actions: [{ field_code: "irr", scope: "project", operation: "set", value: 0.2 }],
    }));
    expect(invalid.kind).toBe("explain");
    expect(invalid.parser).toBe("fallback");
  });
});

describe("真正的 P0 Gate", () => {
  it("缺运价、计价单位或线路时 ready=false，并给出阻断项", () => {
    const missingFreight = evaluateP0Gate({ routes: [completeRoute({ freight_price: null })], projectFleetSize: "20" });
    expect(missingFreight.ready).toBe(false);
    expect(missingFreight.blocking_p0).toContain("revenue.freight_price");

    const missingUnit = evaluateP0Gate({ routes: [completeRoute({ freight_price_unit: null })], projectFleetSize: "20" });
    expect(missingUnit.ready).toBe(false);
    expect(missingUnit.blocking_p0).toContain("revenue.freight_price_unit");

    const missingRoute = evaluateP0Gate({ routes: [], projectFleetSize: "20" });
    expect(missingRoute.ready).toBe(false);
    expect(missingRoute.blocking.some((item) => item.name.includes("线路"))).toBe(true);
    expect(p0GateMessage(missingFreight)).toMatch(/不会调用测算引擎/);
  });

  it("P0 问题已答但字段值仍空时，仍然阻断", () => {
    const questions: QuestionRecord[] = [
      {
        priority: "P0",
        field_code: "revenue.freight_price",
        route_id: "r1",
        question: "请确认运价",
        reason: "运价缺失",
        impact_metrics: ["收入"],
        has_reference: false,
        answer_action: "fill",
        answer_value: "",
        status: "answered",
      },
    ];
    const gate = evaluateP0Gate({
      routes: [completeRoute({ freight_price: null })],
      questions,
      projectFleetSize: "20",
    });
    expect(gate.ready).toBe(false);
    expect(gate.blocking.some((item) => item.field_code === "revenue.freight_price")).toBe(true);
  });
});

describe("测算假设透明展示", () => {
  it("运营月数、首付、过路费、装卸费、信息费带来源和影响", () => {
    const mapped = mapWorkspaceToEngineInput({
      title: "假设展示",
      projectFleetSize: "20",
      parameters: [],
      routes: [completeRoute({ freight_price: "32" })],
    });
    const byCode = Object.fromEntries(mapped.assumptions.map((item) => [item.field_code, item]));
    expect(byCode["ops.operating_months_year"]).toMatchObject({
      field_name: "运营月数",
      value: "12",
      source_label: "系统默认",
      impact_metrics: expect.arrayContaining(["收入", "成本", "利润", "现金流"]),
    });
    expect(byCode["vehicle.down_payment"]).toMatchObject({
      field_name: "单车首付",
      value: "80000",
      source_label: "系统默认",
    });
    expect(byCode["cost.toll_per_trip"]).toMatchObject({
      field_name: "单趟过路费",
      value: "0",
      source_label: "待确认按0测算",
      allowed_zero: true,
    });
    expect(byCode["cost.loading_unloading_fee"]).toMatchObject({
      field_name: "装卸费",
      value: "0",
      source_label: "待确认按0测算",
    });
    expect(byCode["cost.information_fee"]).toMatchObject({
      field_name: "信息费",
      value: "0",
      source_label: "待确认按0测算",
    });
  });
});
