import { actorFrom, fail, ok } from "@/lib/api";
import { canEdit } from "@/lib/auth";
import { EngineError } from "@/lib/engine/decimal";
import { readJson } from "@/lib/guards";
import { enrichWorkspaceAnalysis } from "@/lib/services/ai-workspace";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { role } = actorFrom(req);
    if (!canEdit(role)) return fail(new EngineError("FORBIDDEN", "role", "当前角色不能使用测算助手"), 403);
    const body = await readJson(req);
    const scenarioId = typeof body.scenarioId === "string" ? body.scenarioId : undefined;
    const question = typeof body.question === "string" ? body.question : undefined;
    return ok(await enrichWorkspaceAnalysis(id, { scenarioId, question }));
  } catch (err) {
    return fail(err);
  }
}
