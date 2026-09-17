import { prisma } from "@/lib/db";
import { actorFrom, fail, ok } from "@/lib/api";
import { canEdit } from "@/lib/auth";
import { EngineError } from "@/lib/engine/decimal";
import { requireEditableSegment } from "@/lib/services/scheme";
import { assertSegmentNonNegative, readJson } from "@/lib/guards";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { role } = actorFrom(req);
    if (!canEdit(role)) return fail(new EngineError("FORBIDDEN", "role", "当前角色不能编辑路段"), 403);
    const current = await requireEditableSegment(id);
    const body = (await readJson(req)) as Record<string, unknown>;
    if (body.move && (body.move === "up" || body.move === "down")) {
      const neighbor = await prisma.calculationRouteSegment.findFirst({
        where: {
          routeId: current.routeId,
          sortNo: body.move === "up" ? { lt: current.sortNo } : { gt: current.sortNo },
        },
        orderBy: { sortNo: body.move === "up" ? "desc" : "asc" },
      });
      if (neighbor) {
        await prisma.$transaction([
          prisma.calculationRouteSegment.update({ where: { id: current.id }, data: { sortNo: neighbor.sortNo } }),
          prisma.calculationRouteSegment.update({ where: { id: neighbor.id }, data: { sortNo: current.sortNo } }),
        ]);
      }
      const list = await prisma.calculationRouteSegment.findMany({
        where: { routeId: current.routeId },
        orderBy: { sortNo: "asc" },
      });
      return ok(list);
    }

    assertSegmentNonNegative(body);
    const segment = await prisma.calculationRouteSegment.update({
      where: { id },
      data: {
        segmentName: String(body.segmentName ?? current.segmentName),
        originName: String(body.originName ?? current.originName),
        destinationName: String(body.destinationName ?? current.destinationName),
        distanceKm: String(body.distanceKm ?? "0"),
        freightPrice: String(body.freightPrice ?? "0"),
        freightPriceUnit: String(body.freightPriceUnit ?? current.freightPriceUnit),
        loadTon: String(body.loadTon ?? "0"),
        tripsPerVehicleMonth: String(body.tripsPerVehicleMonth ?? "0"),
        operatingMonthsYear: String(body.operatingMonthsYear ?? "12"),
        tollPerTrip: String(body.tollPerTrip ?? "0"),
        loadingUnloadingFee: String(body.loadingUnloadingFee ?? "0"),
        informationFee: String(body.informationFee ?? "0"),
        loadedEnergyConsumption: String(body.loadedEnergyConsumption ?? "0"),
        emptyEnergyConsumption: String(body.emptyEnergyConsumption ?? "0"),
        electricityPrice: String(body.electricityPrice ?? "0"),
        driverCostPerTrip: String(body.driverCostPerTrip ?? "0"),
        enabled: (body.enabled as boolean | undefined) ?? true,
        sortNo: (body.sortNo as number | undefined) ?? current.sortNo,
      },
    });
    return ok(segment);
  } catch (err) {
    return fail(err);
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { role } = actorFrom(req);
    if (!canEdit(role)) return fail(new EngineError("FORBIDDEN", "role", "当前角色不能删除路段"), 403);
    await requireEditableSegment(id);
    await prisma.calculationRouteSegment.delete({ where: { id } });
    return ok({ ok: true });
  } catch (err) {
    return fail(err);
  }
}
