import { prisma } from "@/lib/db";
import { actorFrom, fail, ok } from "@/lib/api";
import { canEdit } from "@/lib/auth";
import { EngineError } from "@/lib/engine/decimal";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { role } = actorFrom(req);
    if (!canEdit(role)) return fail(new EngineError("FORBIDDEN", "role", "当前角色不能新增路段"), 403);
    const body = await req.json();
    const count = await prisma.calculationRouteSegment.count({ where: { routeId: id } });
    const std = await prisma.standardParameter.findMany({ where: { enabled: true } });
    const pick = (code: string, fallback: string) => std.find((p) => p.parameterCode === code)?.value ?? fallback;
    const source = body.copyFromId
      ? await prisma.calculationRouteSegment.findUnique({ where: { id: body.copyFromId } })
      : null;

    const segment = await prisma.calculationRouteSegment.create({
      data: source
        ? {
            routeId: id,
            segmentName: `${source.segmentName}（副本）`,
            sortNo: count + 1,
            originName: source.originName,
            destinationName: source.destinationName,
            distanceKm: source.distanceKm,
            freightPrice: source.freightPrice,
            freightPriceUnit: source.freightPriceUnit,
            loadTon: source.loadTon,
            tripsPerVehicleMonth: source.tripsPerVehicleMonth,
            operatingMonthsYear: source.operatingMonthsYear,
            tollPerTrip: source.tollPerTrip,
            loadingUnloadingFee: source.loadingUnloadingFee,
            informationFee: source.informationFee,
            loadedEnergyConsumption: source.loadedEnergyConsumption,
            emptyEnergyConsumption: source.emptyEnergyConsumption,
            electricityPrice: source.electricityPrice,
            driverCostPerTrip: source.driverCostPerTrip,
            enabled: true,
          }
        : {
            routeId: id,
            segmentName: body.segmentName || `路段 ${count + 1}`,
            sortNo: count + 1,
            originName: body.originName || "",
            destinationName: body.destinationName || "",
            distanceKm: body.distanceKm || "0",
            freightPrice: body.freightPrice || "0",
            freightPriceUnit: body.freightPriceUnit || "PER_TON",
            loadTon: body.loadTon || "0",
            tripsPerVehicleMonth: body.tripsPerVehicleMonth || "0",
            operatingMonthsYear: body.operatingMonthsYear || "12",
            tollPerTrip: body.tollPerTrip || "0",
            loadingUnloadingFee: body.loadingUnloadingFee || "0",
            informationFee: body.informationFee || "0",
            loadedEnergyConsumption: body.loadedEnergyConsumption || pick("STD_LOADED_ENERGY", "1.35"),
            emptyEnergyConsumption: body.emptyEnergyConsumption || pick("STD_EMPTY_ENERGY", "0.95"),
            electricityPrice: body.electricityPrice || pick("STD_ELECTRICITY_PRICE", "0.82"),
            driverCostPerTrip: body.driverCostPerTrip || "0",
            enabled: true,
          },
    });
    return ok(segment, 201);
  } catch (err) {
    return fail(err);
  }
}
