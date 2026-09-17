import { prisma } from "@/lib/db";
import { fail, ok } from "@/lib/api";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const ids: string[] = body.orderedIds || [];
    await prisma.$transaction(
      ids.map((routeId, index) =>
        prisma.calculationRoute.update({ where: { id: routeId }, data: { sortNo: index + 1 } }),
      ),
    );
    const routes = await prisma.calculationRoute.findMany({
      where: { schemeId: id },
      include: { segments: { orderBy: { sortNo: "asc" } } },
      orderBy: { sortNo: "asc" },
    });
    return ok(routes);
  } catch (err) {
    return fail(err);
  }
}
