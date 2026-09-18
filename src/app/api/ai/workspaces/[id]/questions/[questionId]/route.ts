import { actorFrom, fail, ok } from "@/lib/api";
import { canEdit } from "@/lib/auth";
import { EngineError } from "@/lib/engine/decimal";
import { readJson } from "@/lib/guards";
import { answerQuestion } from "@/lib/services/ai-workspace";

export async function POST(req: Request, { params }: { params: Promise<{ id: string; questionId: string }> }) {
  try {
    const { id, questionId } = await params;
    const { role, actor } = actorFrom(req);
    if (!canEdit(role)) return fail(new EngineError("FORBIDDEN", "role", "当前角色不能回答问题"), 403);
    const body = await readJson(req);
    const action = body.action as "fill" | "adopt_reference" | "skip";
    if (action !== "fill" && action !== "adopt_reference" && action !== "skip") {
      return fail(new EngineError("CALC_PARAMETER_INVALID", "action", "请选择填写、采用参考值或暂不确认"));
    }
    return ok(await answerQuestion(id, questionId, actor, { action, value: body.value != null ? String(body.value) : undefined }));
  } catch (err) {
    return fail(err);
  }
}
