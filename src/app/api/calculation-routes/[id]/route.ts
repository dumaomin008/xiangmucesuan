import { prisma } from "@/lib/db";
import { actorFrom, fail, ok } from "@/lib/api";
import { canEdit } from "@/lib/auth";
import { EngineError } from "@/lib/engine/decimal";
import { requireEditableRoute } from "@/lib/services/scheme";
import { readJson } from "@/lib/guards";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { role } = actorFrom(req);
    if (!canEdit(role)) return fail(new EngineError("FORBIDDEN", "role", "当前角色不能编辑线路"), 403);
    await requireEditableRoute(id);
    const body = await readJson(req);
    const route = await prisma.calculationRoute.update({
      where: { id },
      data: {
        routeName: body.routeName as string | undefined,
        routeCode: body.routeCode as string | undefined,
        sortNo: body.sortNo as number | undefined,
        weight: body.weight as number | null | undefined,
        description: body.description as string | undefined,
        enabled: body.enabled as boolean | undefined,
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
    await requireEditableRoute(id);
    await prisma.calculationRoute.delete({ where: { id } });
    return ok({ ok: true });
  } catch (err) {
    return fail(err);
  }
}
