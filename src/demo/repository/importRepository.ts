import { DEMO_STORAGE_KEYS } from "../keys";
import type { KeyValueStorage } from "../storage/kv";
import { VersionedStore } from "../storage/versioned";
import { cloneJson, createId, nowIso } from "../utils";
import type { ExtractedParameter, ImportFile, ImportSession } from "../import/types";

export class ImportRepository {
  private readonly store: VersionedStore<ImportSession[]>;

  constructor(storage: KeyValueStorage) {
    this.store = new VersionedStore(storage, DEMO_STORAGE_KEYS.imports, () => []);
  }

  listSessions(): ImportSession[] {
    return cloneJson(this.store.read().data).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  getSession(id: string): ImportSession | null {
    return cloneJson(this.store.read().data.find((s) => s.id === id) ?? null);
  }

  saveSession(session: ImportSession): ImportSession {
    const all = this.store.read().data;
    const idx = all.findIndex((s) => s.id === session.id);
    const next = { ...session, updatedAt: nowIso() };
    if (idx >= 0) all[idx] = next;
    else all.push(next);
    this.store.write(all);
    return cloneJson(next);
  }

  createSession(partial?: Partial<ImportSession>): ImportSession {
    const now = nowIso();
    const session: ImportSession = {
      id: createId("IMP"),
      status: "draft",
      files: [],
      parameters: [],
      createMode: "ai_import",
      createdAt: now,
      updatedAt: now,
      ...partial,
    };
    return this.saveSession(session);
  }

  deleteSession(id: string): void {
    const next = this.store.read().data.filter((s) => s.id !== id);
    this.store.write(next);
  }

  clear(): void {
    this.store.write([]);
  }

  updateFiles(sessionId: string, files: ImportFile[]): ImportSession | null {
    const s = this.getSession(sessionId);
    if (!s) return null;
    s.files = files;
    s.status = files.length ? "uploaded" : "draft";
    return this.saveSession(s);
  }

  updateParameters(sessionId: string, parameters: ExtractedParameter[]): ImportSession | null {
    const s = this.getSession(sessionId);
    if (!s) return null;
    s.parameters = parameters;
    return this.saveSession(s);
  }
}
