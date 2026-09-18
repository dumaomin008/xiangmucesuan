import { EngineError } from "@/lib/engine/decimal";
import { parseRole, type DemoRole } from "@/lib/auth";

export function ok(data: unknown, status = 200) {
  return Response.json(data, { status });
}

export function fail(err: unknown, status?: number) {
  if (err instanceof EngineError) {
    const mapped =
      status ??
      (err.code === "NOT_FOUND"
        ? 404
        : err.code === "FORBIDDEN"
          ? 403
          : err.code === "CALC_IN_PROGRESS"
            ? 409
            : 400);
    return Response.json({ code: err.code, field: err.field, message: err.message }, { status: mapped });
  }
  const message = err instanceof Error ? err.message : "服务器异常";
  return Response.json({ code: "INTERNAL_ERROR", field: "", message }, { status: status ?? 500 });
}

export function actorFrom(req: Request): { role: DemoRole; actor: string } {
  const raw = req.headers.get("x-demo-user") || "王经理";
  let actor = raw;
  try {
    actor = decodeURIComponent(raw);
  } catch {
    actor = raw;
  }
  return {
    role: parseRole(req.headers.get("x-demo-role")),
    actor: actor || "王经理",
  };
}
