import { EngineError } from "@/lib/engine/decimal";
import { parseRole, type DemoRole } from "@/lib/auth";

export function ok(data: unknown, status = 200) {
  return Response.json(data, { status });
}

export function fail(err: unknown, status?: number) {
  if (err instanceof EngineError) {
    return Response.json({ code: err.code, field: err.field, message: err.message }, { status: status ?? 400 });
  }
  const message = err instanceof Error ? err.message : "服务器异常";
  return Response.json({ code: "INTERNAL_ERROR", field: "", message }, { status: status ?? 500 });
}

export function actorFrom(req: Request): { role: DemoRole; actor: string } {
  return {
    role: parseRole(req.headers.get("x-demo-role")),
    actor: req.headers.get("x-demo-user") || "王经理",
  };
}
