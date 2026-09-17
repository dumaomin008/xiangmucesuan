import { prisma } from "@/lib/db";
import { actorFrom, fail, ok } from "@/lib/api";
import { canEdit } from "@/lib/auth";
import { EngineError } from "@/lib/engine/decimal";
import { audit, nextSchemeCode, serializeScheme } from "@/lib/services/scheme";

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
    const body = await req.json();
    if (body.fleetSize != null) {
      const n = Number(body.fleetSize);
      if (!Number.isInteger(n) || n <= 0) {
        return fail(new EngineError("CALC_PARAMETER_INVALID", "fleet_size", "车辆数必须为正整数"));
      }
    }
    const std = await prisma.standardParameter.findMany({ where: { enabled: true } });
    const pick = (code: string, fallback: string) => std.find((p) => p.parameterCode === code)?.value ?? fallback;

    const scheme = await prisma.calculationScheme.create({
      data: {
        projectId,
        schemeName: body.schemeName || "未命名测算方案",
        schemeCode: await nextSchemeCode(projectId),
        versionNo: "V1",
        status: "draft",
        description: body.description || "",
        leaseType: body.leaseType || "FINANCE_LEASE",
        fleetSize: Number(body.fleetSize || 1),
        calculationYears: Number(body.calculationYears || 5),
        expectedStartDate: body.expectedStartDate ? new Date(body.expectedStartDate) : null,
        expectedEndDate: body.expectedEndDate ? new Date(body.expectedEndDate) : null,
        createdBy: actor,
        updatedBy: actor,
        ruleVersionId: "RULE_PACK_V1",
      },
    });

    await prisma.vehiclePlan.create({
      data: {
        schemeId: scheme.id,
        fleetSize: scheme.fleetSize,
        leaseType: scheme.leaseType,
        downPaymentPerVehicle: body.downPaymentPerVehicle || "0",
        installmentMonths: Number(body.installmentMonths || 36),
        monthlyRentPerVehicle: body.monthlyRentPerVehicle || "0",
        managementFeePerVehicle: pick("STD_MANAGEMENT_FEE", "1500"),
        roadMaintenanceFee: pick("STD_ROAD_MAINTENANCE_FEE", "200"),
        maintenanceFee: pick("STD_MAINTENANCE_FEE", "800"),
        annualInspectionFee: pick("STD_ANNUAL_INSPECTION_FEE", "200"),
        insuranceFee: pick("STD_INSURANCE_FEE", "1000"),
        parkingFee: pick("STD_PARKING_FEE", "300"),
        heaterFee: pick("STD_HEATER_FEE", "150"),
        consumableFee: pick("STD_CONSUMABLE_FEE", "200"),
        tireLifeKm: pick("STD_TIRE_LIFE", "80000"),
        tireCount: Number(pick("STD_TIRE_COUNT", "12")),
        tireUnitPrice: pick("STD_TIRE_PRICE", "1800"),
        driverCost: pick("STD_DRIVER_COST", "12000"),
        driverCostType: "PER_VEHICLE_MONTH",
      },
    });

    await prisma.financeTaxPlan.create({
      data: {
        schemeId: scheme.id,
        receivableCycle: Number(body.receivableCycle || pick("STD_RECEIVABLE_CYCLE", "1")),
        workingCapitalLoanCycle: Number(body.workingCapitalLoanCycle || pick("STD_WC_LOAN_CYCLE", "1")),
        workingCapitalInterestRate: pick("STD_WC_INTEREST_RATE", "0.045"),
        discountRate: pick("STD_DISCOUNT_RATE", "0.04"),
        outputVatRate: pick("STD_OUTPUT_VAT_RATE", "0.09"),
        inputVatRule: body.inputVatRule || "STANDARD_DEDUCT",
        calculationYears: scheme.calculationYears,
        depreciationMonths: Number(body.depreciationMonths || pick("STD_DEPRECIATION_MONTHS", "60")),
        projectOperatingMonths: body.projectOperatingMonths ? Number(body.projectOperatingMonths) : null,
        operatingMonthsYear: body.operatingMonthsYear ? Number(body.operatingMonthsYear) : 12,
      },
    });

    await audit("CREATE_SCHEME", "CalculationScheme", scheme.id, actor, body);
    return ok(scheme, 201);
  } catch (err) {
    return fail(err);
  }
}
