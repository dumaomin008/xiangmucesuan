import { describe, expect, it } from "vitest";
import { extractFromText } from "../extract/heuristic";
import { buildCalculationRequest, buildMissingAndQuestions, mergeParameterCandidates } from "../extract/missing";
import { validateAiExtractResult } from "../schema/validator";
import { FORBIDDEN_AUTOCOMPLETE_FIELDS } from "../schema/field-dictionary";
import { AI_PROJECT_EXTRACT_SCHEMA_VERSION, CALCULATION_REQUEST_SCHEMA_VERSION } from "../schema/versions";
import { mapWorkspaceToEngineInput } from "../map/to-engine";
import { toCalculationResultV1 } from "../map/from-engine";
import { emptyExtract } from "../extract/missing";

const APPENDIX_A = "客户预计每天运输3000吨，昆钢到北城，单程约65公里，先投入20台新能源重卡，运价约32元/吨。";

describe("heuristic extract", () => {
  it("附录A：抽取线路、运量、车辆、运价，不臆造趟次和电耗", () => {
    const result = extractFromText(APPENDIX_A, "附录A", "due_diligence");
    expect(result.routes).toHaveLength(1);
    expect(result.routes[0].origin_name).toBe("昆钢");
    expect(result.routes[0].destination_name).toBe("北城");
    expect(result.routes[0].distance_km).toBe("65");
    expect(result.routes[0].volume_value).toBe("3000");
    expect(result.routes[0].freight_price).toBe("32");
    expect(result.routes[0].freight_price_unit).toBe("PER_TON");
    expect(result.hits.some((h) => h.field_code === "vehicle.fleet_size" && h.value === "20")).toBe(true);
    expect(result.hits.some((h) => h.field_code === "ops.trips_per_day")).toBe(false);
    expect(result.hits.some((h) => h.field_code === "energy.loaded_consumption")).toBe(false);
  });
});

describe("conflict merge", () => {
  it("同一字段两个值时标记 conflict，不静默覆盖", () => {
    const { parameters, conflicts } = mergeParameterCandidates([
      {
        field_code: "revenue.freight_price",
        value: "32",
        unit: null,
        raw_value: "32元/吨",
        source_type: "due_diligence",
        source_ref: "文件A",
        confidence: 0.9,
        status: "extracted",
        editable: true,
        reference_meta: null,
        updated_by: "AI",
        route_id: "r1",
      },
      {
        field_code: "revenue.freight_price",
        value: "30",
        unit: null,
        raw_value: "30元/吨",
        source_type: "meeting",
        source_ref: "纪要",
        confidence: 0.7,
        status: "extracted",
        editable: true,
        reference_meta: null,
        updated_by: "AI",
        route_id: "r1",
      },
    ]);
    expect(conflicts).toHaveLength(1);
    expect(parameters[0].status).toBe("conflict");
    expect(parameters[0].value).toBeNull();
  });
});

describe("P0 gate", () => {
  it("运价缺失时 calculation_request.ready 为 false", () => {
    const routes = [
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
        freight_price: null,
        freight_price_unit: "PER_TON",
        load_ton: null,
        toll_per_trip: null,
        loading_unloading_fee: null,
        information_fee: null,
        driver_cost_per_trip: null,
        status: "confirmed" as const,
        enabled: true,
      },
    ];
    const { questions } = buildMissingAndQuestions({
      routes,
      parameters: [],
      projectFleetSize: "20",
      references: [],
    });
    const request = buildCalculationRequest(routes, questions);
    expect(request.blocking_p0).toContain("revenue.freight_price");
    expect(request.ready).toBe(false);
  });
});

describe("schema validator", () => {
  it("拒绝未知字段和解析阶段风险项", () => {
    const base = emptyExtract({ name: "t", customer: "c", region: null });
    const invalid = {
      ...base,
      parameters: [
        {
          field_code: "not.in.dictionary",
          value: "1",
          unit: null,
          raw_value: "1",
          source_type: "chat" as const,
          source_ref: "x",
          confidence: 0.1,
          status: "extracted" as const,
          editable: true,
          reference_meta: null,
          updated_by: "AI" as const,
        },
      ],
      risks: [{ name: "invented" }],
    };
    const result = validateAiExtractResult(invalid);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.path.includes("field_code"))).toBe(true);
    expect(result.errors.some((e) => e.path === "risks")).toBe(true);
  });

  it("参考值不得伪装成已确认", () => {
    const base = emptyExtract({ name: "t", customer: "c", region: null });
    const result = validateAiExtractResult({
      ...base,
      parameters: [
        {
          field_code: "energy.loaded_consumption",
          value: "1.35",
          unit: "kWh/km",
          raw_value: "1.35",
          source_type: "reference",
          source_ref: "STD",
          confidence: 0.5,
          status: "confirmed",
          editable: true,
          reference_meta: {
            source_level: "system_default",
            sample_size: null,
            statistic_method: "platform_default",
            range_min: null,
            range_max: null,
            suggested_value: "1.35",
            applicable_condition: "default",
            confidence_level: "default_only",
            updated_at: null,
          },
          updated_by: "AI",
        },
      ],
    });
    expect(result.ok).toBe(false);
  });
});

describe("engine mapping", () => {
  it("只映射字典中的引擎字段，不把日运量换算成载重或趟次", () => {
    const mapped = mapWorkspaceToEngineInput({
      title: "测试",
      projectFleetSize: "20",
      parameters: [
        {
          field_code: "cargo.daily_volume_ton",
          value: "3000",
          unit: "吨/日",
          raw_value: "3000吨",
          source_type: "due_diligence",
          source_ref: "A",
          confidence: 0.9,
          status: "extracted",
          editable: true,
          reference_meta: null,
          updated_by: "AI",
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
    expect(mapped.fleetSize).toBe(20);
    expect(mapped.routes[0].segment.distanceKm).toBe("65");
    expect(mapped.routes[0].segment.freightPrice).toBe("32");
    expect(mapped.routes[0].segment.loadTon).toBe("");
    expect(mapped.routes[0].segment.tripsPerVehicleMonth).toBe("");
    expect(mapped.unmappedParameters.some((p) => p.field_code === "cargo.daily_volume_ton")).toBe(true);
    expect(mapped.routes[0].segment.tollPerTrip).toBe("0");
    expect(mapped.assumptions.some((item) => item.field_code === "cost.toll_per_trip" && item.status === "default")).toBe(true);
    expect(mapped.routes[0].segment.electricityPrice).toBe("");
    expect(mapped.monthlyRentPerVehicle).toBeNull();
  });
});

describe("calculation result wrapper", () => {
  it("标准结果 JSON 标记数据源为测算引擎", () => {
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
    expect(result.schema_version).toBe("calculation_result_v1");
    expect(result.source).toBe("calculation_engine");
  });
});

describe("frozen dictionary", () => {
  it("运价与起终点禁止自动补全", () => {
    expect(FORBIDDEN_AUTOCOMPLETE_FIELDS).toEqual(expect.arrayContaining([
      "revenue.freight_price",
      "route.origin",
      "route.destination",
      "cargo.guaranteed_volume",
    ]));
  });
  it("schema 版本号稳定", () => {
    expect(AI_PROJECT_EXTRACT_SCHEMA_VERSION).toBe("ai_project_extract_v1");
    expect(CALCULATION_REQUEST_SCHEMA_VERSION).toBe("calculation_request_v1");
  });
});
