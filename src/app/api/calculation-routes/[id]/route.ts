import { prisma } from "@/lib/db";
import { actorFrom, fail, ok } from "@/lib/api";
import { canEdit } from "@/lib/auth";
import { EngineError } from "@/lib/engine/decimal";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { role } = actorFrom(req);
    if (!canEdit(role)) return fail(new EngineError("FORBIDDEN", "role", "当前角色不能编辑线路"), 403);
    const body = await req.json();
    const route = await prisma.calculationRoute.update({
      where: { id },
      data: {
        routeName: body.routeName,
        routeCode: body.routeCode,
        sortNo: body.sortNo,
        weight: body.weight,
        description: body.description,
        enabled: body.enabled,
      },
      include: { segments: { orderBy: { sortNo: "asc" } } },
    });
    return ok(route);
  } catch (err) {
    return fail(err);
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { role } = actorFrom(req);
    if (!canEdit(role)) return fail(new EngineError("FORBIDDEN", "role", "当前角色不能删除线路"), 403);
    await prisma.calculationRoute.delete({ where: { id } });
    return ok({ ok: true });
  } catch (err) {
    return fail(err);
  }
}
