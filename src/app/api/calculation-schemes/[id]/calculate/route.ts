import { actorFrom, fail, ok } from "@/lib/api";
import { canEdit } from "@/lib/auth";
import { EngineError } from "@/lib/engine/decimal";
import { executeCalculation, loadCalculationInput } from "@/lib/services/scheme";
import { toPreviewDto } from "@/lib/workspace/serialize-preview";
import { calculateScheme } from "@/lib/engine/calculate";
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
    const needInput = url.searchParams.get("validate") === "1" || url.searchParams.get("preview") === "1";
    if (!needInput) return ok({ ok: true });
    const input = await loadCalculationInput(id);
    const validation = validateSchemeInput(input);
    if (url.searchParams.get("validate") === "1" && url.searchParams.get("preview") !== "1") {
      return ok(validation);
    }
    if (url.searchParams.get("preview") === "1") {
      if (validation.errors.length) {
        return ok({ preview: null, ...validation });
      }
      try {
        const output = calculateScheme(input);
        return ok({ preview: toPreviewDto(output), ...validation });
      } catch (err) {
        const message = err instanceof EngineError ? err.message : err instanceof Error ? err.message : "预览失败";
        return ok({ preview: null, ...validation, message });
      }
    }
    return ok({ ok: true });
  } catch (err) {
    return fail(err);
  }
}
