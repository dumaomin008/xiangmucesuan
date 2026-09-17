import { Decimal, toDecimal } from "./decimal";
import type { SegmentInput } from "./types";

export function calcLoadedEmptyMileage(params: {
  loadedDistance: Decimal;
  emptyDistance: Decimal;
  tripsPerVehicleMonth: Decimal;
  fleetSize: number;
}): { loadedMileage: Decimal; emptyMileage: Decimal; totalMileage: Decimal } {
  const fleet = new Decimal(params.fleetSize);
  const loadedMileage = params.loadedDistance.mul(params.tripsPerVehicleMonth).mul(fleet);
  const emptyMileage = params.emptyDistance.mul(params.tripsPerVehicleMonth).mul(fleet);
  return {
    loadedMileage,
    emptyMileage,
    totalMileage: loadedMileage.plus(emptyMileage),
  };
}

export function sumMileage(values: Decimal[]): Decimal {
  return values.reduce((acc, v) => acc.plus(v), new Decimal(0));
}

export function segmentTripCount(segment: SegmentInput, fleetSize: number): Decimal {
  return toDecimal(segment.tripsPerVehicleMonth).mul(fleetSize);
}
