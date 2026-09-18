import { actorFrom, fail, ok } from "@/lib/api";
import { canEdit } from "@/lib/auth";
import { EngineError } from "@/lib/engine/decimal";
import { readJson } from "@/lib/guards";
import { resolveConflict } from "@/lib/services/ai-workspace";

export async function POST(req: Request, { params }: { params: Promise<{ id: string; conflictId: string }> }) {
  try {
    const { id, conflictId } = await params;
    const { role, actor } = actorFrom(req);
    if (!canEdit(role)) return fail(new EngineError("FORBIDDEN", "role", "当前角色不能处理冲突"), 403);
    const body = await readJson(req);
    return ok(await resolveConflict(id, conflictId, actor, String(body.value || "")));
  } catch (err) {
    return fail(err);
  }
}
