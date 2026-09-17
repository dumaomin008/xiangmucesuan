import { actorFrom, fail, ok } from "@/lib/api";
import { canEdit } from "@/lib/auth";
import { EngineError } from "@/lib/engine/decimal";
import { copyScheme } from "@/lib/services/scheme";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { role, actor } = actorFrom(req);
    if (!canEdit(role)) return fail(new EngineError("FORBIDDEN", "role", "当前角色不能复制方案"), 403);
    const body = await req.json().catch(() => ({}));
    const created = await copyScheme(id, actor, Boolean(body.asNewVersion));
    return ok(created, 201);
  } catch (err) {
    return fail(err);
  }
}
