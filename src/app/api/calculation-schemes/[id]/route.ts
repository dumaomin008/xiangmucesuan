import { prisma } from "@/lib/db";
import { actorFrom, fail, ok } from "@/lib/api";
import { canEdit } from "@/lib/auth";
import { EngineError } from "@/lib/engine/decimal";
import { audit } from "@/lib/services/scheme";
import {
  assertFinanceNonNegative,
  assertPositiveInt,
  assertVehicleNonNegative,
  readJson,
} from "@/lib/guards";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const scheme = await prisma.calculationScheme.findUnique({
      where: { id },
      include: {
        project: true,
        routes: { include: { segments: { orderBy: { sortNo: "asc" } } }, orderBy: { sortNo: "asc" } },
        vehiclePlan: true,
        financeTaxPlan: true,
        overrides: true,
        results: { orderBy: { calculatedAt: "desc" }, take: 1 },
      },
    });
    if (!scheme) return fail(new EngineError("NOT_FOUND", "scheme", "方案不存在"));
    return ok(scheme);
  } catch (err) {
    return fail(err);
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { role, actor } = actorFrom(req);
    if (!canEdit(role)) return fail(new EngineError("FORBIDDEN", "role", "当前角色不能编辑方案"), 403);
    const scheme = await prisma.calculationScheme.findUnique({
      where: { id },
      include: { vehiclePlan: true, financeTaxPlan: true },
    });
    if (!scheme) return fail(new EngineError("NOT_FOUND", "scheme", "方案不存在"));
    if (scheme.status === "baseline") {
      return fail(new EngineError("CALC_PARAMETER_INVALID", "status", "基准方案不可直接覆盖修改，请先复制生成新版本"), 400);
    }
    if (scheme.status === "archived") {
      return fail(new EngineError("CALC_PARAMETER_INVALID", "status", "已归档方案不可修改"), 400);
    }
    const body = (await readJson(req)) as {
      schemeName?: string;
      description?: string;
      leaseType?: string;
      fleetSize?: number;
      calculationYears?: number;
      expectedStartDate?: string;
      expectedEndDate?: string;
      vehicle?: Record<string, string | number>;
      finance?: Record<string, string | number | null>;
      overrides?: {
        parameterCode: string;
        standardValue: string;
        overrideValue: string;
        overrideReason?: string;
        unit?: string | null;
        parameterName?: string;
      }[];
    };
    if (body.fleetSize != null) assertPositiveInt(body.fleetSize, "fleet_size", "车辆数");
    if (body.calculationYears != null) assertPositiveInt(body.calculationYears, "calculation_years", "测算年限");
    if (body.vehicle && typeof body.vehicle === "object") {
      assertVehicleNonNegative(body.vehicle as Record<string, unknown>);
    }
    if (body.finance && typeof body.finance === "object") {
      assertFinanceNonNegative(body.finance as Record<string, unknown>);
    }

    const updated = await prisma.calculationScheme.update({
      where: { id },
      data: {
        schemeName: body.schemeName ?? scheme.schemeName,
        description: body.description ?? scheme.description,
        leaseType: body.leaseType ?? scheme.leaseType,
        fleetSize: body.fleetSize ?? scheme.fleetSize,
        calculationYears: body.calculationYears ?? scheme.calculationYears,
        expectedStartDate: body.expectedStartDate ? new Date(body.expectedStartDate) : scheme.expectedStartDate,
        expectedEndDate: body.expectedEndDate ? new Date(body.expectedEndDate) : scheme.expectedEndDate,
        updatedBy: actor,
        status: scheme.status === "calculated" ? "draft" : scheme.status,
      },
    });

    if (body.vehicle && scheme.vehiclePlan) {
      const vehicle = body.vehicle as Record<string, string>;
      await prisma.vehiclePlan.update({
        where: { schemeId: id },
        data: {
          fleetSize: updated.fleetSize,
          leaseType: updated.leaseType,
          downPaymentPerVehicle: String(vehicle.downPaymentPerVehicle ?? ""),
          installmentMonths: Number(vehicle.installmentMonths || 0),
          monthlyRentPerVehicle: String(vehicle.monthlyRentPerVehicle ?? ""),
          managementFeePerVehicle: String(vehicle.managementFeePerVehicle ?? ""),
          roadMaintenanceFee: String(vehicle.roadMaintenanceFee ?? ""),
          maintenanceFee: String(vehicle.maintenanceFee ?? ""),
          annualInspectionFee: String(vehicle.annualInspectionFee ?? ""),
          insuranceFee: String(vehicle.insuranceFee ?? ""),
          parkingFee: String(vehicle.parkingFee ?? ""),
          heaterFee: String(vehicle.heaterFee ?? ""),
          consumableFee: String(vehicle.consumableFee ?? ""),
          tireLifeKm: String(vehicle.tireLifeKm ?? ""),
          tireCount: Number(vehicle.tireCount || 0),
          tireUnitPrice: String(vehicle.tireUnitPrice ?? ""),
          driverCost: String(vehicle.driverCost ?? ""),
          driverCostType: String(vehicle.driverCostType ?? "PER_VEHICLE_MONTH"),
        },
      });
    }

    if (body.finance && scheme.financeTaxPlan) {
      const finance = body.finance as Record<string, string | number | null>;
      await prisma.financeTaxPlan.update({
        where: { schemeId: id },
        data: {
          receivableCycle: Number(finance.receivableCycle),
          workingCapitalLoanCycle: Number(finance.workingCapitalLoanCycle),
          workingCapitalInterestRate: String(finance.workingCapitalInterestRate ?? ""),
          discountRate: String(finance.discountRate ?? ""),
          outputVatRate: String(finance.outputVatRate ?? ""),
          inputVatRule: String(finance.inputVatRule ?? ""),
          calculationYears: updated.calculationYears,
          depreciationMonths: Number(finance.depreciationMonths || 60),
          projectOperatingMonths:
            finance.projectOperatingMonths === "" || finance.projectOperatingMonths == null
              ? null
              : Number(finance.projectOperatingMonths),
          operatingMonthsYear:
            finance.operatingMonthsYear === "" || finance.operatingMonthsYear == null
              ? null
              : Number(finance.operatingMonthsYear),
        },
      });
      if (finance.operatingMonthsYear !== undefined && finance.operatingMonthsYear !== "" && finance.operatingMonthsYear != null) {
        const months = String(finance.operatingMonthsYear);
        const routes = await prisma.calculationRoute.findMany({ where: { schemeId: id }, select: { id: true } });
        await prisma.calculationRouteSegment.updateMany({
          where: { routeId: { in: routes.map((r) => r.id) } },
          data: { operatingMonthsYear: months },
        });
      }
    }

    if (Array.isArray(body.overrides)) {
      await prisma.parameterOverride.deleteMany({ where: { schemeId: id } });
      for (const o of body.overrides) {
        await prisma.parameterOverride.create({
          data: {
            schemeId: id,
            parameterCode: o.parameterCode,
            standardValue: o.standardValue,
            overrideValue: o.overrideValue,
            overrideReason: o.overrideReason || "",
            unit: o.unit,
            createdBy: actor,
          },
        });
        await prisma.parameterChangeLog.create({
          data: {
            schemeId: id,
            parameterCode: o.parameterCode,
            parameterName: o.parameterName || o.parameterCode,
            oldValue: o.standardValue,
            newValue: o.overrideValue,
            unit: o.unit,
            changeReason: o.overrideReason,
            changedBy: actor,
          },
        });
      }
    }

    await audit("UPDATE_SCHEME", "CalculationScheme", id, actor, { keys: Object.keys(body) });
    const fresh = await prisma.calculationScheme.findUnique({
      where: { id },
      include: {
        routes: { include: { segments: { orderBy: { sortNo: "asc" } } }, orderBy: { sortNo: "asc" } },
        vehiclePlan: true,
        financeTaxPlan: true,
        overrides: true,
      },
    });
    return ok(fresh);
  } catch (err) {
    return fail(err);
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { role, actor } = actorFrom(req);
    if (!canEdit(role)) return fail(new EngineError("FORBIDDEN", "role", "当前角色不能删除"), 403);
    const scheme = await prisma.calculationScheme.findUnique({ where: { id } });
    if (!scheme) return fail(new EngineError("NOT_FOUND", "scheme", "方案不存在"));
    if (scheme.status !== "draft") {
      return fail(new EngineError("CALC_PARAMETER_INVALID", "status", "只能删除草稿方案"), 400);
    }
    await prisma.calculationScheme.delete({ where: { id } });
    await audit("DELETE_DRAFT", "CalculationScheme", id, actor, {});
    return ok({ ok: true });
  } catch (err) {
    return fail(err);
  }
}
