export function nowIso(): string {
  return new Date().toISOString();
}

export function createId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  const time = Date.now().toString(36);
  return `${prefix}_${time}_${rand}`;
}

export function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
