import { prisma } from "@/lib/db";
import { actorFrom, fail, ok } from "@/lib/api";
import { canEdit } from "@/lib/auth";
import { EngineError } from "@/lib/engine/decimal";
import { requireEditableRoute } from "@/lib/services/scheme";
import { assertSegmentNonNegative, readJson } from "@/lib/guards";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { role } = actorFrom(req);
    if (!canEdit(role)) return fail(new EngineError("FORBIDDEN", "role", "当前角色不能新增路段"), 403);
    const route = await requireEditableRoute(id);
    const body = (await readJson(req)) as Record<string, unknown>;
    const count = await prisma.calculationRouteSegment.count({ where: { routeId: id } });
    const std = await prisma.standardParameter.findMany({ where: { enabled: true } });
    const pick = (code: string, fallback: string) => std.find((p) => p.parameterCode === code)?.value ?? fallback;
    const source = body.copyFromId
      ? await prisma.calculationRouteSegment.findUnique({
          where: { id: String(body.copyFromId) },
          include: { route: true },
        })
      : null;
    if (body.copyFromId && !source) {
      return fail(new EngineError("NOT_FOUND", "segment", "被复制路段不存在"));
    }
    if (source && source.route.schemeId !== route.schemeId) {
      return fail(new EngineError("FORBIDDEN", "segment", "不能跨方案复制路段"));
    }

    if (!source) assertSegmentNonNegative(body);

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
            segmentName: String(body.segmentName || `路段 ${count + 1}`),
            sortNo: count + 1,
            originName: String(body.originName || ""),
            destinationName: String(body.destinationName || ""),
            distanceKm: String(body.distanceKm || "0"),
            freightPrice: String(body.freightPrice || "0"),
            freightPriceUnit: String(body.freightPriceUnit || "PER_TON"),
            loadTon: String(body.loadTon || "0"),
            tripsPerVehicleMonth: String(body.tripsPerVehicleMonth || "0"),
            operatingMonthsYear: String(body.operatingMonthsYear || "12"),
            tollPerTrip: String(body.tollPerTrip || "0"),
            loadingUnloadingFee: String(body.loadingUnloadingFee || "0"),
            informationFee: String(body.informationFee || "0"),
            loadedEnergyConsumption: String(body.loadedEnergyConsumption || pick("STD_LOADED_ENERGY", "1.35")),
            emptyEnergyConsumption: String(body.emptyEnergyConsumption || pick("STD_EMPTY_ENERGY", "0.95")),
            electricityPrice: String(body.electricityPrice || pick("STD_ELECTRICITY_PRICE", "0.82")),
            driverCostPerTrip: String(body.driverCostPerTrip || "0"),
            enabled: true,
          },
    });
    return ok(segment, 201);
  } catch (err) {
    return fail(err);
  }
}
