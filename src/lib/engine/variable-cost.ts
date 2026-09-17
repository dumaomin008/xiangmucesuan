import { Decimal, toDecimal } from "./decimal";
import type { DriverCostSource, DriverCostType, SegmentInput, VehiclePlanInput } from "./types";

export function hasSegmentDriverOverride(value: string | undefined | null): boolean {
  const raw = String(value ?? "").trim();
  return raw !== "" && raw !== "0";
}

export function resolveSegmentDriverPerTrip(
  segment: SegmentInput,
  vehicle: Pick<VehiclePlanInput, "driverCost" | "driverCostType">,
): { amount: Decimal; source: DriverCostSource } {
  if (hasSegmentDriverOverride(segment.driverCostPerTrip)) {
    return { amount: toDecimal(segment.driverCostPerTrip || "0"), source: "SEGMENT_OVERRIDE" };
  }
  if (vehicle.driverCostType === "PER_TRIP") {
    return { amount: toDecimal(vehicle.driverCost || "0"), source: "SCHEME_DEFAULT" };
  }
  return { amount: new Decimal(0), source: "NONE" };
}

export function driverCostSourceLabel(source: DriverCostSource): string {
  if (source === "SEGMENT_OVERRIDE") return "司机成本来源：路段覆盖值";
  if (source === "SCHEME_DEFAULT") return "司机成本来源：方案默认值";
  return "司机成本来源：未按趟计";
}

export function calcDriverCost(params: {
  driverCost: string;
  driverCostType: DriverCostType;
  fleetSize: number;
  totalTrips: Decimal;
}): Decimal {
  const unit = toDecimal(params.driverCost);
  if (params.driverCostType === "PER_TRIP") {
    return unit.mul(params.totalTrips);
  }
  if (params.driverCostType === "FIXED_MONTH") {
    return unit;
  }
  return unit.mul(params.fleetSize);
}

export function calcSegmentTripCosts(segment: SegmentInput, fleetSize: number) {
  const trips = toDecimal(segment.tripsPerVehicleMonth).mul(fleetSize);
  return {
    trips,
    tollCost: toDecimal(segment.tollPerTrip).mul(trips),
    loadingUnloadingCost: toDecimal(segment.loadingUnloadingFee).mul(trips),
    informationFeeCost: toDecimal(segment.informationFee).mul(trips),
  };
}

export type VariableCostBreakdown = {
  driverCost: Decimal;
  tollCost: Decimal;
  loadingUnloadingCost: Decimal;
  informationFeeCost: Decimal;
  energyCost: Decimal;
  tireCost: Decimal;
  variableCostTotal: Decimal;
  items: { code: string; name: string; amount: Decimal }[];
};

export function assembleVariableCost(parts: {
  driverCost: Decimal;
  tollCost: Decimal;
  loadingUnloadingCost: Decimal;
  informationFeeCost: Decimal;
  energyCost: Decimal;
  tireCost: Decimal;
}): VariableCostBreakdown {
  const items = [
    { code: "driver_cost", name: "司机成本", amount: parts.driverCost },
    { code: "toll", name: "车辆过路费", amount: parts.tollCost },
    { code: "loading_unloading", name: "装卸费", amount: parts.loadingUnloadingCost },
    { code: "information_fee", name: "信息费", amount: parts.informationFeeCost },
    { code: "energy_cost", name: "能源成本", amount: parts.energyCost },
    { code: "tire_cost", name: "轮胎成本", amount: parts.tireCost },
  ];
  const variableCostTotal = items.reduce((sum, item) => sum.plus(item.amount), new Decimal(0));
  return { ...parts, variableCostTotal, items };
}
