import { prisma } from "@/lib/db";
import { actorFrom, fail, ok } from "@/lib/api";
import { canEdit } from "@/lib/auth";
import { EngineError } from "@/lib/engine/decimal";
import { requireEditableRoute } from "@/lib/services/scheme";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { role } = actorFrom(req);
    if (!canEdit(role)) return fail(new EngineError("FORBIDDEN", "role", "当前角色不能复制线路"), 403);
    await requireEditableRoute(id);
    const source = await prisma.calculationRoute.findUnique({
      where: { id },
      include: { segments: true },
    });
    if (!source) return fail(new EngineError("NOT_FOUND", "route", "线路不存在"));
    const count = await prisma.calculationRoute.count({ where: { schemeId: source.schemeId } });
    const created = await prisma.calculationRoute.create({
      data: {
        schemeId: source.schemeId,
        routeName: `${source.routeName}（副本）`,
        routeCode: `${source.routeCode}-C`,
        sortNo: count + 1,
        weight: source.weight,
        description: source.description,
        enabled: true,
        segments: {
          create: source.segments.map((seg, idx) => ({
            segmentName: seg.segmentName,
            sortNo: idx + 1,
            originName: seg.originName,
            destinationName: seg.destinationName,
            distanceKm: seg.distanceKm,
            freightPrice: seg.freightPrice,
            freightPriceUnit: seg.freightPriceUnit,
            loadTon: seg.loadTon,
            tripsPerVehicleMonth: seg.tripsPerVehicleMonth,
            operatingMonthsYear: seg.operatingMonthsYear,
            tollPerTrip: seg.tollPerTrip,
            loadingUnloadingFee: seg.loadingUnloadingFee,
            informationFee: seg.informationFee,
            loadedEnergyConsumption: seg.loadedEnergyConsumption,
            emptyEnergyConsumption: seg.emptyEnergyConsumption,
            electricityPrice: seg.electricityPrice,
            driverCostPerTrip: seg.driverCostPerTrip,
            enabled: true,
          })),
        },
      },
      include: { segments: true },
    });
    return ok(created, 201);
  } catch (err) {
    return fail(err);
  }
}
