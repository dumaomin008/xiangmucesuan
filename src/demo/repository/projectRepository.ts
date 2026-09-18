import { DEMO_STORAGE_KEYS } from "../keys";
import { VersionedStore } from "../storage/versioned";
import type { KeyValueStorage } from "../storage/kv";
import type { DemoProjectContext, DemoProjectRecord } from "../types";
import { cloneJson, nowIso } from "../utils";

export class ProjectRepository {
  private readonly store: VersionedStore<DemoProjectRecord[]>;

  constructor(storage: KeyValueStorage) {
    this.store = new VersionedStore(storage, DEMO_STORAGE_KEYS.projects, () => []);
  }

  listProjects(): DemoProjectRecord[] {
    return cloneJson(this.store.read().data);
  }

  getProject(projectId: string): DemoProjectRecord | null {
    return cloneJson(this.store.read().data.find((p) => p.projectId === projectId) ?? null);
  }

  /** 统一 ProjectContext（仅可复用字段） */
  getProjectContext(projectId: string): DemoProjectContext | null {
    const p = this.getProject(projectId);
    if (!p) return null;
    return {
      projectId: p.projectId,
      projectName: p.projectName,
      customer: p.customer,
      region: p.region,
      owner: p.owner,
      projectType: p.projectType,
      place: p.place,
      tractorDemand: p.tractorDemand,
      trailerDemand: p.trailerDemand,
      stage: p.stage,
      status: p.status,
    };
  }

  saveProject(project: DemoProjectRecord): DemoProjectRecord {
    const list = this.store.read().data;
    const idx = list.findIndex((p) => p.projectId === project.projectId);
    const next = { ...cloneJson(project), updatedAt: nowIso() };
    if (idx >= 0) list[idx] = next;
    else list.push({ ...next, createdAt: next.createdAt || nowIso() });
    this.store.write(list);
    return cloneJson(next);
  }

  deleteProject(projectId: string): boolean {
    const list = this.store.read().data;
    const next = list.filter((p) => p.projectId !== projectId);
    if (next.length === list.length) return false;
    this.store.write(next);
    return true;
  }

  replaceAll(projects: DemoProjectRecord[]) {
    this.store.write(cloneJson(projects));
  }

  clear() {
    this.store.clear();
  }
}
