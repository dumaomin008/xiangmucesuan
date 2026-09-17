import { actorFrom, fail, ok } from "@/lib/api";
import { canEdit } from "@/lib/auth";
import { EngineError } from "@/lib/engine/decimal";
import { runSchemeSensitivity } from "@/lib/services/scheme";
import type { SensitivityVariableCode } from "@/lib/engine/types";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { role, actor } = actorFrom(req);
    if (!canEdit(role)) return fail(new EngineError("FORBIDDEN", "role", "当前角色不能做敏感性分析"), 403);
    const body = await req.json();
    const task = await runSchemeSensitivity({
      schemeId: id,
      variableCode: body.variableCode as SensitivityVariableCode,
      changeMode: body.changeMode,
      minChange: String(body.minChange),
      maxChange: String(body.maxChange),
      step: String(body.step),
      actor,
    });
    return ok(task);
  } catch (err) {
    return fail(err);
  }
}
