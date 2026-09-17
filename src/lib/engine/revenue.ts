import { Decimal, toDecimal } from "./decimal";
import { splitMileage } from "./rule-engine";
import type { SchemeCalculationInput, SegmentInput, SegmentMetrics } from "./types";

export function calcSegmentRevenue(
  segment: SegmentInput,
  fleetSize: number,
  formula: "PER_TON" | "PER_TRIP" | "PER_TON_KM",
): Decimal {
  const price = toDecimal(segment.freightPrice);
  const load = toDecimal(segment.loadTon);
  const trips = toDecimal(segment.tripsPerVehicleMonth);
  const distance = toDecimal(segment.distanceKm);
  const fleet = new Decimal(fleetSize);

  if (formula === "PER_TRIP") {
    return price.mul(trips).mul(fleet);
  }
  if (formula === "PER_TON_KM") {
    return price.mul(load).mul(distance).mul(trips).mul(fleet);
  }
  return price.mul(load).mul(trips).mul(fleet);
}

export function calcVehicleMonthlyVolume(segment: SegmentInput): Decimal {
  return toDecimal(segment.loadTon).mul(toDecimal(segment.tripsPerVehicleMonth));
}

export function calcSegmentMonthlyVolume(segment: SegmentInput, fleetSize: number): Decimal {
  return calcVehicleMonthlyVolume(segment).mul(fleetSize);
}

export function calcVehicleMonthlyMileage(segment: SegmentInput): Decimal {
  return toDecimal(segment.distanceKm).mul(toDecimal(segment.tripsPerVehicleMonth));
}

export function calcSegmentMonthlyMileage(segment: SegmentInput, fleetSize: number): Decimal {
  return calcVehicleMonthlyMileage(segment).mul(fleetSize);
}

export function buildSegmentBaseMetrics(
  input: SchemeCalculationInput,
  segment: SegmentInput,
  routeId: string,
): Omit<
  SegmentMetrics,
  | "energyQuantity"
  | "energyCost"
  | "tollCost"
  | "loadingUnloadingCost"
  | "informationFeeCost"
  | "tireCost"
  | "otherVariableCost"
  | "monthlyProfit"
  | "allocationWeight"
  | "allocationWeightRaw"
  | "loadState"
  | "allocatedFixedCost"
  | "allocatedFinanceCost"
  | "taxCost"
  | "driverCost"
> {
  const fleetSize = input.fleetSize;
  const formulaMap = input.ruleSet.revenue.formulaByUnit;
  const formula = formulaMap[segment.freightPriceUnit] ?? "PER_TON";
  const distanceKm = toDecimal(segment.distanceKm);
  const { loadedDistance, emptyDistance } = splitMileage(distanceKm, input.ruleSet.energyMileage);
  const trips = toDecimal(segment.tripsPerVehicleMonth);
  const fleet = new Decimal(fleetSize);

  return {
    segmentId: segment.id,
    routeId,
    segmentName: segment.segmentName,
    distanceKm,
    freightPrice: toDecimal(segment.freightPrice),
    freightPriceUnit: segment.freightPriceUnit,
    loadTon: toDecimal(segment.loadTon),
    tripsPerVehicleMonth: trips,
    fleetSize,
    vehicleMonthlyVolume: calcVehicleMonthlyVolume(segment),
    vehicleMonthlyMileage: calcVehicleMonthlyMileage(segment),
    segmentMonthlyVolume: calcSegmentMonthlyVolume(segment, fleetSize),
    segmentMonthlyMileage: calcSegmentMonthlyMileage(segment, fleetSize),
    loadedDistance,
    emptyDistance,
    loadedMileage: loadedDistance.mul(trips).mul(fleet),
    emptyMileage: emptyDistance.mul(trips).mul(fleet),
    monthlyRevenue: calcSegmentRevenue(segment, fleetSize, formula),
  };
}

export function calcProjectMonthlyRevenue(segments: { monthlyRevenue: Decimal }[]): Decimal {
  return segments.reduce((sum, s) => sum.plus(s.monthlyRevenue), new Decimal(0));
}
