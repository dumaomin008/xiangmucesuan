import { prisma } from "@/lib/db";
import { ok } from "@/lib/api";
import { SENSITIVITY_VARIABLES } from "@/lib/engine/types";
import { ROLE_LABEL } from "@/lib/auth";

export async function GET() {
  const [leaseTypes, vatRules, units, tiers, rules] = await Promise.all([
    prisma.leaseTypeConfig.findMany({ where: { enabled: true }, orderBy: { sortNo: "asc" } }),
    prisma.inputVatRuleConfig.findMany({ where: { enabled: true } }),
    prisma.freightPriceUnitConfig.findMany({ where: { enabled: true }, orderBy: { sortNo: "asc" } }),
    prisma.managementFeeTier.findMany({ where: { enabled: true }, orderBy: { minVehicleCount: "asc" } }),
    prisma.calculationRule.findMany({ include: { versions: { where: { enabled: true } } } }),
  ]);
  return ok({
    leaseTypes,
    vatRules,
    units,
    tiers,
    rules,
    sensitivityVariables: SENSITIVITY_VARIABLES,
    roles: ROLE_LABEL,
    driverCostTypes: [
      { code: "PER_VEHICLE_MONTH", name: "按车/月" },
      { code: "PER_TRIP", name: "按趟" },
      { code: "FIXED_MONTH", name: "固定月金额" },
    ],
    parameterCategories: ["车辆", "能源", "轮胎", "人工", "财务", "税务", "管理费", "其他"],
  });
}
