import { prisma } from "@/lib/db";
import { fail, ok } from "@/lib/api";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const ids: string[] = (body.schemeIds || []).slice(0, 3);
    if (ids.length < 2) return fail(new Error("请选择 2–3 个方案进行对比"), 400);
    const schemes = await prisma.calculationScheme.findMany({
      where: { id: { in: ids } },
      include: {
        routes: { include: { segments: true } },
        vehiclePlan: true,
        financeTaxPlan: true,
        results: { orderBy: { calculatedAt: "desc" }, take: 1 },
      },
    });
    const rows = schemes.map((s) => {
      const segs = s.routes.flatMap((r) => r.segments);
      const avg = (field: keyof (typeof segs)[number]) => {
        if (!segs.length) return null;
        const sum = segs.reduce((n, seg) => n + Number(seg[field] || 0), 0);
        return (sum / segs.length).toFixed(2);
      };
      const latest = s.results[0];
      return {
        id: s.id,
        schemeName: s.schemeName,
        versionNo: s.versionNo,
        status: s.status,
        fleetSize: s.fleetSize,
        routeCount: s.routes.length,
        avgFreightPrice: avg("freightPrice"),
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
