import { actorFrom, fail, ok } from "@/lib/api";
import { canEdit } from "@/lib/auth";
import { EngineError } from "@/lib/engine/decimal";
import { executeCalculation, loadCalculationInput } from "@/lib/services/scheme";
import { validateSchemeInput } from "@/lib/engine/validate";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { role, actor } = actorFrom(req);
    if (!canEdit(role)) return fail(new EngineError("FORBIDDEN", "role", "当前角色不能执行测算"), 403);
    const result = await executeCalculation(id, actor);
    return ok(result);
  } catch (err) {
    return fail(err);
  }
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const url = new URL(req.url);
    if (url.searchParams.get("validate") === "1") {
      const input = await loadCalculationInput(id);
      return ok(validateSchemeInput(input));
    }
    return ok({ ok: true });
  } catch (err) {
    return fail(err);
  }
}
