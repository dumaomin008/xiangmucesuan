import { actorFrom, fail, ok } from "@/lib/api";
import { canEdit } from "@/lib/auth";
import { EngineError } from "@/lib/engine/decimal";
import { readJson } from "@/lib/guards";
import { confirmAndCalculate } from "@/lib/services/ai-workspace";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { role, actor } = actorFrom(req);
    if (!canEdit(role)) return fail(new EngineError("FORBIDDEN", "role", "当前角色不能确认测算"), 403);
    const body = await readJson(req).catch(() => ({ mode: "calculate" }));
    const mode = body.mode === "draft" ? "draft" : "calculate";
    return ok(await confirmAndCalculate(id, actor, mode));
  } catch (err) {
    return fail(err);
  }
}
