import { prisma } from "@/lib/db";
import { actorFrom, fail, ok } from "@/lib/api";
import { canEdit } from "@/lib/auth";
import { EngineError } from "@/lib/engine/decimal";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { role } = actorFrom(req);
    if (!canEdit(role)) return fail(new EngineError("FORBIDDEN", "role", "当前角色不能新增线路"), 403);
    const body = await req.json();
    const count = await prisma.calculationRoute.count({ where: { schemeId: id } });
    const route = await prisma.calculationRoute.create({
      data: {
        schemeId: id,
        routeName: body.routeName || `线路 ${count + 1}`,
        routeCode: body.routeCode || `R${String(count + 1).padStart(2, "0")}`,
        sortNo: body.sortNo ?? count + 1,
        weight: body.weight ?? null,
        description: body.description || "",
        enabled: true,
      },
      include: { segments: true },
    });
    return ok(route, 201);
  } catch (err) {
    return fail(err);
  }
}
