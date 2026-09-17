import { prisma } from "@/lib/db";
import { actorFrom, fail, ok } from "@/lib/api";
import { canEdit } from "@/lib/auth";
import { EngineError } from "@/lib/engine/decimal";
import { audit } from "@/lib/services/scheme";

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
    if (!scheme) return fail(new Error("方案不存在"), 404);
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
    if (!scheme) return fail(new Error("方案不存在"), 404);
    if (scheme.status === "baseline") {
      return fail(new EngineError("CALC_PARAMETER_INVALID", "status", "基准方案不可直接覆盖修改，请先复制生成新版本"), 400);
    }
    if (scheme.status === "archived") {
      return fail(new EngineError("CALC_PARAMETER_INVALID", "status", "已归档方案不可修改"), 400);
    }
    const body = await req.json();

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
      const vehicle = body.vehicle;
      await prisma.vehiclePlan.update({
        where: { schemeId: id },
        data: {
          fleetSize: updated.fleetSize,
          leaseType: updated.leaseType,
          downPaymentPerVehicle: vehicle.downPaymentPerVehicle,
          installmentMonths: Number(vehicle.installmentMonths || 0),
          monthlyRentPerVehicle: vehicle.monthlyRentPerVehicle,
          managementFeePerVehicle: vehicle.managementFeePerVehicle,
          roadMaintenanceFee: vehicle.roadMaintenanceFee,
          maintenanceFee: vehicle.maintenanceFee,
          annualInspectionFee: vehicle.annualInspectionFee,
          insuranceFee: vehicle.insuranceFee,
          parkingFee: vehicle.parkingFee,
          heaterFee: vehicle.heaterFee,
          consumableFee: vehicle.consumableFee,
          tireLifeKm: vehicle.tireLifeKm,
          tireCount: Number(vehicle.tireCount || 0),
          tireUnitPrice: vehicle.tireUnitPrice,
          driverCost: vehicle.driverCost,
          driverCostType: vehicle.driverCostType,
        },
      });
    }

    if (body.finance && scheme.financeTaxPlan) {
      const finance = body.finance;
      await prisma.financeTaxPlan.update({
        where: { schemeId: id },
        data: {
          receivableCycle: Number(finance.receivableCycle),
          workingCapitalLoanCycle: Number(finance.workingCapitalLoanCycle),
          workingCapitalInterestRate: finance.workingCapitalInterestRate,
          discountRate: finance.discountRate,
          outputVatRate: finance.outputVatRate,
          inputVatRule: finance.inputVatRule,
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
    if (!scheme) return fail(new Error("方案不存在"), 404);
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
