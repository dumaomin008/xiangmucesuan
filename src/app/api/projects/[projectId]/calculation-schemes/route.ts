import { prisma } from "@/lib/db";
import { actorFrom, fail, ok } from "@/lib/api";
import { canEdit } from "@/lib/auth";
import { EngineError } from "@/lib/engine/decimal";
import { createBlankScheme, serializeScheme } from "@/lib/services/scheme";
import { readJson } from "@/lib/guards";

export async function GET(_req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params;
    const schemes = await prisma.calculationScheme.findMany({
      where: { projectId },
      include: {
        routes: { include: { segments: true } },
        results: { orderBy: { calculatedAt: "desc" }, take: 1 },
      },
      orderBy: { updatedAt: "desc" },
    });
    return ok(schemes.map(serializeScheme));
  } catch (err) {
    return fail(err);
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params;
    const { role, actor } = actorFrom(req);
    if (!canEdit(role)) return fail(new EngineError("FORBIDDEN", "role", "当前角色不能新建测算"), 403);
    const body = await readJson(req);
    const scheme = await createBlankScheme(projectId, actor, {
      schemeName: body.schemeName != null ? String(body.schemeName) : undefined,
      description: body.description != null ? String(body.description) : undefined,
      leaseType: body.leaseType != null ? String(body.leaseType) : undefined,
      fleetSize: body.fleetSize != null ? Number(body.fleetSize) : undefined,
      calculationYears: body.calculationYears != null ? Number(body.calculationYears) : undefined,
      expectedStartDate: body.expectedStartDate != null ? String(body.expectedStartDate) : undefined,
      expectedEndDate: body.expectedEndDate != null ? String(body.expectedEndDate) : undefined,
      downPaymentPerVehicle: body.downPaymentPerVehicle != null ? String(body.downPaymentPerVehicle) : undefined,
      installmentMonths: body.installmentMonths != null ? Number(body.installmentMonths) : undefined,
      monthlyRentPerVehicle: body.monthlyRentPerVehicle != null ? String(body.monthlyRentPerVehicle) : undefined,
      receivableCycle: body.receivableCycle != null ? Number(body.receivableCycle) : undefined,
      workingCapitalLoanCycle: body.workingCapitalLoanCycle != null ? Number(body.workingCapitalLoanCycle) : undefined,
      inputVatRule: body.inputVatRule != null ? String(body.inputVatRule) : undefined,
      depreciationMonths: body.depreciationMonths != null ? Number(body.depreciationMonths) : undefined,
      projectOperatingMonths: body.projectOperatingMonths != null ? Number(body.projectOperatingMonths) : undefined,
      operatingMonthsYear: body.operatingMonthsYear != null ? Number(body.operatingMonthsYear) : undefined,
    });
    return ok(scheme, 201);
  } catch (err) {
    return fail(err);
  }
}
