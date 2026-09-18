export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** 浏览器 LocalStorage；不可用时退回内存 */
export function createLocalStorageAdapter(): KeyValueStorage {
  try {
    if (typeof globalThis !== "undefined" && "localStorage" in globalThis && globalThis.localStorage) {
      return globalThis.localStorage;
    }
  } catch {
    /* private mode / SSR */
  }
  return createMemoryStorage();
}

export function createMemoryStorage(initial: Record<string, string> = {}): KeyValueStorage {
  const map = new Map<string, string>(Object.entries(initial));
  return {
    getItem(key) {
      return map.has(key) ? map.get(key)! : null;
    },
    setItem(key, value) {
      map.set(key, value);
    },
    removeItem(key) {
      map.delete(key);
    },
  };
}
