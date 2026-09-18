import { actorFrom, fail, ok } from "@/lib/api";
import { canEdit } from "@/lib/auth";
import { EngineError } from "@/lib/engine/decimal";
import { readJson } from "@/lib/guards";
import { runWorkspaceCopilot, saveScenarioAsScheme } from "@/lib/services/ai-workspace";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { role, actor } = actorFrom(req);
    if (!canEdit(role)) return fail(new EngineError("FORBIDDEN", "role", "当前角色不能使用测算助手"), 403);
    const body = await readJson(req);
    if (body.action === "save" && body.scenarioId) {
      return ok(await saveScenarioAsScheme(id, String(body.scenarioId), actor));
    }
    const question = String(body.question || "").trim();
    if (!question) return fail(new EngineError("CALC_PARAMETER_INVALID", "question", "请输入问题"), 400);
    return ok(
      await runWorkspaceCopilot(id, actor, {
        question,
        base: body.base === "last_scenario" ? "last_scenario" : "baseline",
      }),
    );
  } catch (err) {
    return fail(err);
  }
}
