import { Decimal, toDecimal } from "./decimal";
import { resolveManagementFee } from "./rule-engine";
import type { SchemeCalculationInput } from "./types";

/** Excel 固定成本年化：fleet × 单车月费 × 12 / 年运营月数 */
export function excelAnnualizeMonthly(perVehicleMonth: Decimal, fleetSize: number, operatingMonths: Decimal): Decimal {
  if (operatingMonths.isZero()) {
    return new Decimal(0);
  }
  return perVehicleMonth.mul(fleetSize).mul(12).div(operatingMonths);
}

/**
 * Excel AC41：
 * 纯租赁 = fleet × 月租 × 12 / 运营月数
 * 非纯租赁 = fleet × (首付/折旧月数 + 月租) × 12 / 运营月数
 */
export function calcExcelVehicleCost(params: {
  isPureLease: boolean;
  fleetSize: number;
  monthlyRent: Decimal;
  downPayment: Decimal;
  depreciationMonths: Decimal;
  operatingMonths: Decimal;
}): Decimal {
  const rentPart = params.isPureLease
    ? params.monthlyRent
    : params.depreciationMonths.isZero()
      ? params.monthlyRent
      : params.downPayment.div(params.depreciationMonths).plus(params.monthlyRent);
  return excelAnnualizeMonthly(rentPart, params.fleetSize, params.operatingMonths);
}

export type FixedCostBreakdown = {
  vehicleRent: Decimal;
  managementFee: Decimal;
  roadMaintenanceFee: Decimal;
  maintenanceFee: Decimal;
  annualInspectionFee: Decimal;
  insuranceFee: Decimal;
  parkingFee: Decimal;
  heaterFee: Decimal;
  consumableFee: Decimal;
  fixedCostTotal: Decimal;
  items: { code: string; name: string; amount: Decimal }[];
};

export function calcFixedCost(input: SchemeCalculationInput): FixedCostBreakdown {
  const fleet = new Decimal(input.fleetSize);
  const vehicle = input.vehicle;
  const months = new Decimal(input.ruleSet.annualFeeAmortizationMonths);

  const vehicleRent = toDecimal(vehicle.monthlyRentPerVehicle).mul(fleet);
  const configuredMgmt = toDecimal(vehicle.managementFeePerVehicle);
  const tierFee = resolveManagementFee(input.fleetSize, input.managementFeeTiers);
  const managementFeeUnit = configuredMgmt.gt(0) ? configuredMgmt : tierFee;
  const managementFee = managementFeeUnit.mul(fleet);

  const monthly = (perVehicleMonth: string) => toDecimal(perVehicleMonth).mul(fleet);
  const monthlyFromAnnual = (annualPerVehicle: string) =>
    toDecimal(annualPerVehicle).div(months).mul(fleet);

  const roadMaintenanceFee = monthly(vehicle.roadMaintenanceFee);
  const maintenanceFee =
    input.ruleSet.maintenance.mode === "PER_VEHICLE_MONTH"
      ? monthly(vehicle.maintenanceFee)
      : new Decimal(0);
  const annualInspectionFee = monthlyFromAnnual(vehicle.annualInspectionFee);
  const insuranceFee = monthlyFromAnnual(vehicle.insuranceFee);
  const parkingFee = monthly(vehicle.parkingFee);
  const heaterFee = monthly(vehicle.heaterFee);
  const consumableFee = monthly(vehicle.consumableFee);

  const items = [
    { code: "vehicle_rent", name: "车辆租金/融资成本", amount: vehicleRent },
    { code: "management_fee", name: "管理费", amount: managementFee },
    { code: "road_maintenance_fee", name: "路保费", amount: roadMaintenanceFee },
    { code: "maintenance_fee", name: "维保费", amount: maintenanceFee },
    { code: "annual_inspection_fee", name: "年审费", amount: annualInspectionFee },
    { code: "insurance_fee", name: "保险费", amount: insuranceFee },
    { code: "parking_fee", name: "停车费", amount: parkingFee },
    { code: "heater_fee", name: "柴暖费", amount: heaterFee },
    { code: "consumable_fee", name: "消耗费用", amount: consumableFee },
  ];

  const fixedCostTotal = items.reduce((sum, item) => sum.plus(item.amount), new Decimal(0));

  return {
    vehicleRent,
    managementFee,
    roadMaintenanceFee,
    maintenanceFee,
    annualInspectionFee,
    insuranceFee,
    parkingFee,
    heaterFee,
    consumableFee,
    fixedCostTotal,
    items,
  };
}
