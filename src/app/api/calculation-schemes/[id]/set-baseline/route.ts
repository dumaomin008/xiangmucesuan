import { actorFrom, fail, ok } from "@/lib/api";
import { canSetBaseline } from "@/lib/auth";
import { EngineError } from "@/lib/engine/decimal";
import { setBaseline } from "@/lib/services/scheme";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { role, actor } = actorFrom(req);
    if (!canSetBaseline(role)) return fail(new EngineError("FORBIDDEN", "role", "仅项目负责人可设置基准方案"), 403);
    const updated = await setBaseline(id, actor);
    return ok(updated);
  } catch (err) {
    return fail(err);
  }
}
