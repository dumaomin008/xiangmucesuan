import { DEMO_SCHEMA_VERSION, type VersionedEnvelope } from "../types";
import type { KeyValueStorage } from "./kv";

export class VersionedStore<T> {
  constructor(
    private readonly storage: KeyValueStorage,
    private readonly key: string,
    private readonly empty: () => T,
    private readonly migrate: (fromVersion: number, data: unknown) => T = (_v, data) => data as T,
  ) {}

  read(): VersionedEnvelope<T> {
    const raw = this.storage.getItem(this.key);
    if (!raw) {
      return this.wrap(this.empty());
    }
    try {
      const parsed = JSON.parse(raw) as Partial<VersionedEnvelope<T>> & { data?: unknown };
      const version = typeof parsed.schemaVersion === "number" ? parsed.schemaVersion : 0;
      if (version === DEMO_SCHEMA_VERSION && parsed.data !== undefined) {
        return {
          schemaVersion: DEMO_SCHEMA_VERSION,
          updatedAt: parsed.updatedAt ?? new Date().toISOString(),
          data: parsed.data as T,
        };
      }
      const migrated = this.migrate(version, parsed.data ?? parsed);
      const envelope = this.wrap(migrated);
      this.write(envelope.data);
      return envelope;
    } catch {
      const envelope = this.wrap(this.empty());
      this.write(envelope.data);
      return envelope;
    }
  }

  write(data: T): VersionedEnvelope<T> {
    const envelope = this.wrap(data);
    this.storage.setItem(this.key, JSON.stringify(envelope));
    return envelope;
  }

  clear() {
    this.storage.removeItem(this.key);
  }

  private wrap(data: T): VersionedEnvelope<T> {
    return {
      schemaVersion: DEMO_SCHEMA_VERSION,
      updatedAt: new Date().toISOString(),
      data,
    };
  }
}
