import { prisma } from "@/lib/db";
import { actorFrom, fail, ok } from "@/lib/api";
import { canManageRules } from "@/lib/auth";
import { EngineError } from "@/lib/engine/decimal";
import { audit } from "@/lib/services/scheme";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { role, actor } = actorFrom(req);
    if (!canManageRules(role)) return fail(new EngineError("FORBIDDEN", "role", "仅管理员可维护标准参数库"), 403);
    const current = await prisma.standardParameter.findUnique({ where: { id } });
    if (!current) return fail(new Error("参数不存在"), 404);
    const body = await req.json();
    const nextVersion = body.bumpVersion
      ? `V${Number(current.version.replace(/\D/g, "") || "1") + 1}`
      : body.version || current.version;

    await prisma.standardParameterVersion.create({
      data: {
        parameterId: id,
        value: current.value,
        version: current.version,
        effectiveDate: current.effectiveDate,
        expireDate: current.expireDate,
      },
    });

    const updated = await prisma.standardParameter.update({
      where: { id },
      data: {
        parameterName: body.parameterName ?? current.parameterName,
        category: body.category ?? current.category,
        value: body.value != null ? String(body.value) : current.value,
        unit: body.unit ?? current.unit,
        effectiveDate: body.effectiveDate ? new Date(body.effectiveDate) : current.effectiveDate,
        expireDate: body.expireDate ? new Date(body.expireDate) : current.expireDate,
        version: nextVersion,
        enabled: body.enabled ?? current.enabled,
        description: body.description ?? current.description,
        scope: body.scope ?? current.scope,
      },
    });
    await audit("UPDATE_STANDARD_PARAMETER", "StandardParameter", id, actor, {
      oldValue: current.value,
      newValue: updated.value,
      version: updated.version,
    });
    return ok(updated);
  } catch (err) {
    return fail(err);
  }
}
