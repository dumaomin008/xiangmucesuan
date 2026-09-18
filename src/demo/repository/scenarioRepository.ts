import {
  calculateProject,
  CALCULATION_ENGINE_VERSION,
  serializeCalculationResult,
  snapshotKeyMetrics,
  type SchemeCalculationInput,
} from "@/calculation";
import { DEMO_STORAGE_KEYS } from "../keys";
import type { KeyValueStorage } from "../storage/kv";
import { VersionedStore } from "../storage/versioned";
import type { DemoCalcScenario, DemoInputsSource, DemoScenarioResults, ScenarioStatus } from "../types";
import { cloneJson, createId, nowIso } from "../utils";

/** 可编辑经营参数指纹：用于脏检查（参数变更但尚未重算） */
export function fingerprintSchemeInputs(inputs: SchemeCalculationInput): string {
  const seg = inputs.routes?.[0]?.segments?.[0];
  const fleet = inputs.fleetSize ?? inputs.vehicle?.fleetSize ?? 0;
  const payload = {
    fleet,
    rent: inputs.vehicle?.monthlyRentPerVehicle ?? "",
    distanceKm: seg?.distanceKm ?? "",
    loadTon: seg?.loadTon ?? "",
    freightPrice: seg?.freightPrice ?? "",
    trips: seg?.tripsPerVehicleMonth ?? "",
    electricityPrice: seg?.electricityPrice ?? "",
    energy: seg?.loadedEnergyConsumption ?? "",
    driver: seg?.driverCostPerTrip ?? "",
  };
  return JSON.stringify(payload);
}

function buildResults(inputs: SchemeCalculationInput): DemoScenarioResults {
  const output = calculateProject(inputs);
  const base = snapshotKeyMetrics(output);
  const fleetSize = Number(inputs.fleetSize ?? inputs.vehicle?.fleetSize ?? 0);
  const fleetOk = Number.isFinite(fleetSize) && fleetSize > 0;
  const profitPerVehicle = fleetOk ? output.monthlyProfit.div(fleetSize).toString() : null;
  return {
    metrics: {
      ...base,
      fleetSize: fleetOk ? fleetSize : 0,
      profitPerVehicle,
      profitPerVehicleReason: fleetOk ? null : "车辆数无效，无法计算单车经济性",
    },
    full: serializeCalculationResult(output),
    calculatedAt: nowIso(),
    inputFingerprint: fingerprintSchemeInputs(inputs),
  };
}

export class ScenarioRepository {
  private readonly store: VersionedStore<DemoCalcScenario[]>;

  constructor(storage: KeyValueStorage) {
    this.store = new VersionedStore(storage, DEMO_STORAGE_KEYS.scenarios, () => []);
  }

  listScenarios(projectId?: string): DemoCalcScenario[] {
    const all = this.store.read().data;
    const filtered = projectId ? all.filter((s) => s.projectId === projectId) : all;
    return cloneJson(filtered).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  getScenario(scenarioId: string): DemoCalcScenario | null {
    return cloneJson(this.store.read().data.find((s) => s.id === scenarioId) ?? null);
  }

  /**
   * 保存方案：写入输入快照；默认用浏览器引擎重算结果。
   * recalculate=false 时保留传入 results（用于导入种子）。
   */
  saveScenario(
    payload: {
      id?: string;
      projectId: string;
      name: string;
      version?: string;
      status?: ScenarioStatus;
      inputs: SchemeCalculationInput;
      results?: DemoScenarioResults | null;
      notes?: string;
      inputsSource?: DemoInputsSource;
    },
    options?: { recalculate?: boolean },
  ): DemoCalcScenario {
    const recalculate = options?.recalculate !== false;
    const list = this.store.read().data;
    const existing = payload.id ? list.find((s) => s.id === payload.id) : undefined;
    const id = payload.id ?? createId("SCN");
    const inputs = cloneJson(payload.inputs);
    inputs.schemeId = id;
    inputs.schemeName = payload.name;

    let results: DemoScenarioResults | null;
    if (recalculate) {
      results = buildResults(inputs);
    } else if (payload.results !== undefined) {
      results = cloneJson(payload.results);
    } else {
      results = existing?.results ?? null;
    }

    const record: DemoCalcScenario = {
      id,
      projectId: payload.projectId,
      name: payload.name,
      version: payload.version ?? existing?.version ?? "V1",
      status: payload.status ?? existing?.status ?? (results ? "calculated" : "draft"),
      createdAt: existing?.createdAt ?? nowIso(),
      updatedAt: nowIso(),
      inputs,
      results,
      calculationVersion: CALCULATION_ENGINE_VERSION,
      notes: payload.notes ?? existing?.notes,
      inputsSource: payload.inputsSource ?? existing?.inputsSource,
    };

    const idx = list.findIndex((s) => s.id === id);
    if (idx >= 0) list[idx] = record;
    else list.push(record);
    this.store.write(list);
    return cloneJson(record);
  }

  /** 复制输入生成新方案 ID；结果重新计算 */
  duplicateScenario(scenarioId: string, newName?: string): DemoCalcScenario {
    const origin = this.getScenario(scenarioId);
    if (!origin) {
      throw new Error(`方案不存在: ${scenarioId}`);
    }
    return this.saveScenario({
      projectId: origin.projectId,
      name: newName ?? `${origin.name}（副本）`,
      version: "V1",
      status: "calculated",
      inputs: origin.inputs,
      notes: origin.notes ? `复制自 ${origin.id}` : `复制自 ${origin.name}`,
    });
  }

  deleteScenario(scenarioId: string): boolean {
    const list = this.store.read().data;
    const next = list.filter((s) => s.id !== scenarioId);
    if (next.length === list.length) return false;
    this.store.write(next);
    return true;
  }

  setBaseline(projectId: string, scenarioId: string): DemoCalcScenario {
    const list = this.store.read().data;
    const target = list.find((s) => s.id === scenarioId && s.projectId === projectId);
    if (!target) throw new Error(`方案不存在或不属于项目: ${scenarioId}`);
    for (const s of list) {
      if (s.projectId !== projectId) continue;
      if (s.id === scenarioId) s.status = "baseline";
      else if (s.status === "baseline") s.status = "calculated";
      s.updatedAt = nowIso();
    }
    this.store.write(list);
    return cloneJson(target);
  }

  replaceAll(scenarios: DemoCalcScenario[]) {
    this.store.write(cloneJson(scenarios));
  }

  clear() {
    this.store.clear();
  }
}
