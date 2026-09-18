import type { SchemeCalculationInput } from "@/calculation";
import { DEMO_STORAGE_KEYS } from "../keys";
import type { KeyValueStorage } from "../storage/kv";
import { VersionedStore } from "../storage/versioned";
import type { DemoCalcDraft, DemoCalcPreferences } from "../types";
import { cloneJson, createId, nowIso } from "../utils";

const DEFAULT_PREFS: DemoCalcPreferences = {
  lastProjectId: null,
  lastScenarioId: null,
  compareScenarioIds: [],
  uiDensity: "comfortable",
};

/** 草稿与偏好（参数层），页面不直接碰 LocalStorage */
export class ParameterRepository {
  private readonly draftStore: VersionedStore<DemoCalcDraft[]>;
  private readonly prefStore: VersionedStore<DemoCalcPreferences>;

  constructor(storage: KeyValueStorage) {
    this.draftStore = new VersionedStore(storage, DEMO_STORAGE_KEYS.drafts, () => []);
    this.prefStore = new VersionedStore(storage, DEMO_STORAGE_KEYS.preferences, () => ({ ...DEFAULT_PREFS }));
  }

  listDrafts(projectId?: string): DemoCalcDraft[] {
    const all = this.draftStore.read().data;
    return cloneJson(projectId ? all.filter((d) => d.projectId === projectId) : all);
  }

  getDraft(draftId: string): DemoCalcDraft | null {
    return cloneJson(this.draftStore.read().data.find((d) => d.id === draftId) ?? null);
  }

  saveDraft(payload: {
    id?: string;
    projectId: string;
    scenarioId?: string | null;
    name: string;
    inputs: SchemeCalculationInput;
  }): DemoCalcDraft {
    const list = this.draftStore.read().data;
    const id = payload.id ?? createId("DFT");
    const existing = list.find((d) => d.id === id);
    const record: DemoCalcDraft = {
      id,
      projectId: payload.projectId,
      scenarioId: payload.scenarioId ?? existing?.scenarioId ?? null,
      name: payload.name,
      inputs: cloneJson(payload.inputs),
      updatedAt: nowIso(),
    };
    const idx = list.findIndex((d) => d.id === id);
    if (idx >= 0) list[idx] = record;
    else list.push(record);
    this.draftStore.write(list);
    return cloneJson(record);
  }

  deleteDraft(draftId: string): boolean {
    const list = this.draftStore.read().data;
    const next = list.filter((d) => d.id !== draftId);
    if (next.length === list.length) return false;
    this.draftStore.write(next);
    return true;
  }

  getPreferences(): DemoCalcPreferences {
    return cloneJson(this.prefStore.read().data);
  }

  savePreferences(patch: Partial<DemoCalcPreferences>): DemoCalcPreferences {
    const next = { ...this.prefStore.read().data, ...patch };
    this.prefStore.write(next);
    return cloneJson(next);
  }

  clear() {
    this.draftStore.clear();
    this.prefStore.clear();
  }
}
