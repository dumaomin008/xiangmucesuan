import { prisma } from "@/lib/db";
import { actorFrom, fail, ok } from "@/lib/api";
import { canManageRules } from "@/lib/auth";
import { EngineError } from "@/lib/engine/decimal";
import { audit } from "@/lib/services/scheme";

export async function GET() {
  const rows = await prisma.standardParameter.findMany({ orderBy: [{ category: "asc" }, { parameterCode: "asc" }] });
  return ok(rows);
}

export async function POST(req: Request) {
  try {
    const { role, actor } = actorFrom(req);
    if (!canManageRules(role)) return fail(new EngineError("FORBIDDEN", "role", "仅管理员可维护标准参数库"), 403);
    const body = await req.json();
    const created = await prisma.standardParameter.create({
      data: {
        parameterCode: body.parameterCode,
        parameterName: body.parameterName,
        category: body.category,
        value: String(body.value),
        unit: body.unit || "",
        effectiveDate: new Date(body.effectiveDate || Date.now()),
        expireDate: body.expireDate ? new Date(body.expireDate) : null,
        version: body.version || "V1",
        enabled: body.enabled !== false,
        description: body.description || "",
        scope: body.scope || "COMPANY",
      },
    });
    await audit("CREATE_STANDARD_PARAMETER", "StandardParameter", created.id, actor, body);
    return ok(created, 201);
  } catch (err) {
    return fail(err);
  }
}
