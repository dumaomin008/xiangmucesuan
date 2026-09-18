import { prisma } from "@/lib/db";
import { actorFrom, fail, ok } from "@/lib/api";
import { canEdit } from "@/lib/auth";
import { EngineError } from "@/lib/engine/decimal";
import { audit } from "@/lib/services/scheme";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { role, actor } = actorFrom(req);
    if (!canEdit(role)) return fail(new EngineError("FORBIDDEN", "role", "当前角色不能归档"), 403);
    const scheme = await prisma.calculationScheme.findUnique({ where: { id } });
    if (!scheme) return fail(new EngineError("NOT_FOUND", "scheme", "方案不存在"));
    if (scheme.status === "baseline") {
      return fail(new EngineError("CALC_PARAMETER_INVALID", "status", "基准方案请先取消基准再归档"), 400);
    }
    const updated = await prisma.calculationScheme.update({
      where: { id },
      data: { status: "archived", updatedBy: actor },
    });
    await audit("ARCHIVE", "CalculationScheme", id, actor, {});
    return ok(updated);
  } catch (err) {
    return fail(err);
  }
}
