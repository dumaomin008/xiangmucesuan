import { prisma } from "@/lib/db";
import { ok } from "@/lib/api";

export async function GET() {
  const projects = await prisma.project.findMany({
    include: {
      schemes: {
        include: {
          results: { orderBy: { calculatedAt: "desc" }, take: 1 },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  const rows = projects.map((p) => {
    const baseline = p.schemes.find((s) => s.status === "baseline");
    const latest = baseline?.results[0];
    return {
      id: p.id,
      projectCode: p.projectCode,
      projectName: p.projectName,
      customerName: p.customerName,
      projectManager: p.projectManager,
      projectStatus: p.projectStatus,
      startDate: p.startDate,
      endDate: p.endDate,
      schemeCount: p.schemes.length,
      baselineSchemeName: baseline ? `${baseline.schemeName} ${baseline.versionNo}` : null,
      baselineProfit: latest?.monthlyProfit ?? null,
      baselineMargin: latest?.profitMargin ?? null,
    };
  });
  return ok(rows);
}
