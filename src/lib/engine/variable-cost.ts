import { Decimal, toDecimal } from "./decimal";
import type { DriverCostType, SegmentInput } from "./types";

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
