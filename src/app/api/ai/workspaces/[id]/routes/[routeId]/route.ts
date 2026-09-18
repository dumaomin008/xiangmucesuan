import { actorFrom, fail, ok } from "@/lib/api";
import { canEdit } from "@/lib/auth";
import { EngineError } from "@/lib/engine/decimal";
import { readJson } from "@/lib/guards";
import { deleteRoute, splitRoute, updateRoute } from "@/lib/services/ai-workspace";
import type { AiRouteDraft } from "@/lib/ai/schema/types";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; routeId: string }> }) {
  try {
    const { id, routeId } = await params;
    const { role, actor } = actorFrom(req);
    if (!canEdit(role)) return fail(new EngineError("FORBIDDEN", "role", "当前角色不能编辑线路"), 403);
    const body = (await readJson(req)) as Partial<AiRouteDraft> & { confirm?: boolean };
    return ok(await updateRoute(id, routeId, actor, body));
  } catch (err) {
    return fail(err);
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string; routeId: string }> }) {
  try {
    const { id, routeId } = await params;
    const { role, actor } = actorFrom(req);
    if (!canEdit(role)) return fail(new EngineError("FORBIDDEN", "role", "当前角色不能删除线路"), 403);
    return ok(await deleteRoute(id, routeId, actor));
  } catch (err) {
    return fail(err);
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string; routeId: string }> }) {
  try {
    const { id, routeId } = await params;
    const { role, actor } = actorFrom(req);
    if (!canEdit(role)) return fail(new EngineError("FORBIDDEN", "role", "当前角色不能拆分线路"), 403);
    return ok(await splitRoute(id, routeId, actor));
  } catch (err) {
    return fail(err);
  }
}
