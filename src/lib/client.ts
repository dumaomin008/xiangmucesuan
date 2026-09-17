import type { DemoRole } from "@/lib/auth";

export function getDemoRole(): DemoRole {
  if (typeof window === "undefined") return "MANAGER";
  return (localStorage.getItem("demo-role") as DemoRole) || "MANAGER";
}

export function getDemoUser() {
  if (typeof window === "undefined") return "王经理";
  return localStorage.getItem("demo-user") || "王经理";
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-demo-role": getDemoRole(),
      "x-demo-user": getDemoUser(),
      ...(options.headers || {}),
    },
  });
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data.message || "请求失败") as Error & { payload?: unknown; status?: number };
    err.payload = data;
    err.status = res.status;
    throw err;
  }
  return data as T;
}
