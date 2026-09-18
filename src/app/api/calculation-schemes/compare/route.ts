import { prisma } from "@/lib/db";
import { fail, ok } from "@/lib/api";
import { EngineError } from "@/lib/engine/decimal";
import { summarizeFreightPricing } from "@/lib/engine/revenue";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const ids: string[] = (body.schemeIds || []).slice(0, 3);
    if (ids.length < 2) return fail(new EngineError("CALC_PARAMETER_INVALID", "schemeIds", "请选择 2–3 个方案进行对比"));
    const schemes = await prisma.calculationScheme.findMany({
      where: { id: { in: ids } },
      include: {
        routes: { include: { segments: true } },
        vehiclePlan: true,
        financeTaxPlan: true,
        results: { orderBy: { calculatedAt: "desc" }, take: 1 },
      },
    });
    const units = await prisma.freightPriceUnitConfig.findMany({ where: { enabled: true } });
    const rows = schemes.map((s) => {
      const segs = s.routes.flatMap((r) => r.segments);
      const avg = (field: keyof (typeof segs)[number]) => {
        if (!segs.length) return null;
        const sum = segs.reduce((n, seg) => n + Number(seg[field] || 0), 0);
        return (sum / segs.length).toFixed(2);
      };
      const latest = s.results[0];
      const payload = latest
        ? (JSON.parse(latest.payloadJson) as {
            freightPricing?: {
              mixed: boolean;
              label: string;
              averagePrice: string | null;
              byUnit: { name: string; averagePrice: string; segmentCount: number }[];
            };
          })
        : null;
      const pricing =
        payload?.freightPricing ??
        summarizeFreightPricing({
          routes: s.routes.map((route) => ({
            id: route.id,
            routeName: route.routeName,
            routeCode: route.routeCode,
            sortNo: route.sortNo,
            weight: route.weight,
            description: route.description,
            enabled: route.enabled,
            segments: route.segments.map((seg) => ({ ...seg, enabled: true })),
          })),
          freightPriceUnits: units,
        });
      return {
        id: s.id,
        schemeName: s.schemeName,
        versionNo: s.versionNo,
        status: s.status,
        fleetSize: s.fleetSize,
        routeCount: s.routes.length,
        avgFreightPrice: pricing.mixed ? null : pricing.averagePrice,
        freightPricingLabel: pricing.label,
        freightPricingMixed: pricing.mixed,
        freightPricingByUnit: pricing.byUnit,
        avgTrips: avg("tripsPerVehicleMonth"),
        avgElectricityPrice: avg("electricityPrice"),
        avgLoadedEnergy: avg("loadedEnergyConsumption"),
        monthlyRent: s.vehiclePlan?.monthlyRentPerVehicle ?? null,
        monthlyRevenue: latest?.monthlyRevenue ?? null,
        monthlyCost: latest?.monthlyTotalCost ?? null,
        monthlyProfit: latest?.monthlyProfit ?? null,
        profitMargin: latest?.profitMargin ?? null,
        irr: latest?.irr ?? null,
        firstPositiveMonth: latest?.firstPositiveMonth ?? null,
      };
    });
    return ok({ schemes: rows });
  } catch (err) {
    return fail(err);
  }
}
