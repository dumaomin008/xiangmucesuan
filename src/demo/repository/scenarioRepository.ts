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
import type { DemoCalcScenario, DemoScenarioResults, ScenarioStatus } from "../types";
import { cloneJson, createId, nowIso } from "../utils";

function buildResults(inputs: SchemeCalculationInput): DemoScenarioResults {
  const output = calculateProject(inputs);
  return {
    metrics: snapshotKeyMetrics(output),
    full: serializeCalculationResult(output),
    calculatedAt: nowIso(),
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

    const results = recalculate
      ? buildResults(inputs)
      : payload.results !== undefined
        ? cloneJson(payload.results)
        : existing?.results ?? null;

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
