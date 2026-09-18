import { actorFrom, fail, ok } from "@/lib/api";
import { canEdit } from "@/lib/auth";
import { EngineError } from "@/lib/engine/decimal";
import { deleteSource } from "@/lib/services/ai-workspace";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; sourceId: string }> }) {
  try {
    const { id, sourceId } = await params;
    const { role, actor } = actorFrom(_req);
    if (!canEdit(role)) return fail(new EngineError("FORBIDDEN", "role", "当前角色不能删除资料"), 403);
    return ok(await deleteSource(id, sourceId, actor));
  } catch (err) {
    return fail(err);
  }
}
