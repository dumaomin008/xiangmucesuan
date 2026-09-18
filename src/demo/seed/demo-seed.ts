import {
  calculateProject,
  CALCULATION_ENGINE_VERSION,
  serializeCalculationResult,
  snapshotKeyMetrics,
  type SchemeCalculationInput,
} from "@/calculation";
import { fingerprintSchemeInputs } from "../repository/scenarioRepository";
import type { DemoCalcScenario, DemoProjectRecord, DemoScenarioResults } from "../types";
import { cloneJson, nowIso } from "../utils";
import {
  financeHirePurchaseInput,
  highEnergyPriceInput,
  lossInput,
  marginalInput,
  profitableInput,
  rescueLossInput,
} from "./inputs";

/** 与 demo-frontend-package 对齐的 3 个演示测算项目 */
export function buildSeedProjects(): DemoProjectRecord[] {
  const ts = "2026-09-12T09:00:00.000Z";
  return [
    {
      projectId: "PRJ-DEMO-001",
      projectName: "临港港区短倒电动化项目",
      customer: "东澜绿色物流",
      region: "华东大区",
      owner: "林晨",
      members: ["周琪"],
      projectType: "港口短倒",
      place: "上海市浦东新区临港港区",
      tractorDemand: 20,
      trailerDemand: 20,
      stage: "10%线索建联",
      status: "储备",
      eco: "未对接",
      source: "客户转介绍",
      createdAt: ts,
      updatedAt: ts,
    },
    {
      projectId: "PRJ-DEMO-008",
      projectName: "杭州城市配送二期项目",
      customer: "新源城配",
      region: "华东大区",
      owner: "周琪",
      members: ["林晨"],
      projectType: "城市配送",
      place: "浙江省杭州市上城区",
      tractorDemand: 10,
      trailerDemand: 10,
      stage: "100%正式运营",
      status: "运营中",
      eco: "正式运营",
      source: "集团协同",
      createdAt: ts,
      updatedAt: ts,
    },
    {
      projectId: "PRJ-DEMO-003",
      projectName: "深圳盐田港新能源牵引项目",
      customer: "海岳港运",
      region: "华南大区",
      owner: "陈航",
      members: [],
      projectType: "港口短倒",
      place: "广东省深圳市盐田港",
      tractorDemand: 30,
      trailerDemand: 35,
      stage: "30%意向确认",
      status: "暂停",
      eco: "对接中",
      source: "渠道合作",
      createdAt: ts,
      updatedAt: ts,
    },
  ];
}

function withSchemeMeta(input: SchemeCalculationInput, schemeId: string, schemeName: string): SchemeCalculationInput {
  const next = cloneJson(input);
  next.schemeId = schemeId;
  next.schemeName = schemeName;
  return next;
}

export function computeScenarioResults(inputs: SchemeCalculationInput): DemoScenarioResults {
  const output = calculateProject(inputs);
  const base = snapshotKeyMetrics(output);
  const fleetSize = Number(inputs.fleetSize ?? inputs.vehicle?.fleetSize ?? 0);
  const fleetOk = Number.isFinite(fleetSize) && fleetSize > 0;
  return {
    metrics: {
      ...base,
      fleetSize: fleetOk ? fleetSize : 0,
      profitPerVehicle: fleetOk ? output.monthlyProfit.div(fleetSize).toString() : null,
      profitPerVehicleReason: fleetOk ? null : "车辆数无效，无法计算单车经济性",
    },
    full: serializeCalculationResult(output),
    calculatedAt: nowIso(),
    inputFingerprint: fingerprintSchemeInputs(inputs),
  };
}

function scenario(params: {
  id: string;
  projectId: string;
  name: string;
  version: string;
  status: DemoCalcScenario["status"];
  inputs: SchemeCalculationInput;
  notes?: string;
}): DemoCalcScenario {
  const inputs = withSchemeMeta(params.inputs, params.id, params.name);
  const results = computeScenarioResults(inputs);
  const ts = nowIso();
  return {
    id: params.id,
    projectId: params.projectId,
    name: params.name,
    version: params.version,
    status: params.status,
    createdAt: ts,
    updatedAt: ts,
    inputs,
    results,
    calculationVersion: CALCULATION_ENGINE_VERSION,
    notes: params.notes,
  };
}

/**
 * 每项目：1 基准 + 1 对比方案，结果均为真实引擎计算。
 * - PRJ-DEMO-001 正常盈利
 * - PRJ-DEMO-008 盈利边缘
 * - PRJ-DEMO-003 明显亏损
 */
export function buildSeedScenarios(): DemoCalcScenario[] {
  return [
    scenario({
      id: "SCN-001-BASE",
      projectId: "PRJ-DEMO-001",
      name: "基准方案",
      version: "V1",
      status: "baseline",
      inputs: profitableInput(),
      notes: "正常盈利基准",
    }),
    scenario({
      id: "SCN-001-CMP",
      projectId: "PRJ-DEMO-001",
      name: "电价上涨情景",
      version: "V1",
      status: "calculated",
      inputs: highEnergyPriceInput(),
      notes: "对比：高电价冲击",
    }),
    scenario({
      id: "SCN-008-BASE",
      projectId: "PRJ-DEMO-008",
      name: "基准方案",
      version: "V1",
      status: "baseline",
      inputs: marginalInput(),
      notes: "盈利边缘基准",
    }),
    scenario({
      id: "SCN-008-CMP",
      projectId: "PRJ-DEMO-008",
      name: "融资对比方案",
      version: "V1",
      status: "calculated",
      inputs: financeHirePurchaseInput(),
      notes: "对比：非纯租赁融资",
    }),
    scenario({
      id: "SCN-003-BASE",
      projectId: "PRJ-DEMO-003",
      name: "基准方案",
      version: "V1",
      status: "baseline",
      inputs: lossInput(),
      notes: "明显亏损基准",
    }),
    scenario({
      id: "SCN-003-CMP",
      projectId: "PRJ-DEMO-003",
      name: "降租自救方案",
      version: "V1",
      status: "calculated",
      inputs: rescueLossInput(),
      notes: "对比：降租降通行费",
    }),
  ];
}
