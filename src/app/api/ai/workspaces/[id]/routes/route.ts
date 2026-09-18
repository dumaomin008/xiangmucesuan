import { actorFrom, fail, ok } from "@/lib/api";
import { canEdit } from "@/lib/auth";
import { EngineError } from "@/lib/engine/decimal";
import { readJson } from "@/lib/guards";
import { addRoute, confirmAllRoutes, mergeRoutes } from "@/lib/services/ai-workspace";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { role, actor } = actorFrom(req);
    if (!canEdit(role)) return fail(new EngineError("FORBIDDEN", "role", "当前角色不能编辑线路"), 403);
    const body = await readJson(req);
    const action = String(body.action || "add");
    if (action === "confirm_all") return ok(await confirmAllRoutes(id, actor));
    if (action === "merge") return ok(await mergeRoutes(id, Array.isArray(body.routeIds) ? body.routeIds.map(String) : [], actor));
    return ok(await addRoute(id, actor), 201);
  } catch (err) {
    return fail(err);
  }
}
