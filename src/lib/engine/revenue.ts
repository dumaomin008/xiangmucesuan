import { Decimal, toDecimal } from "./decimal";
import { splitMileage } from "./rule-engine";
import type {
  FreightPricingSummary,
  SchemeCalculationInput,
  SegmentInput,
  SegmentMetrics,
} from "./types";

export function resolveRevenueFormula(
  unit: string,
  formulaByUnit: Record<string, "PER_TON" | "PER_TRIP" | "PER_TON_KM">,
): "PER_TON" | "PER_TRIP" | "PER_TON_KM" {
  return formulaByUnit[unit] ?? "PER_TON";
}

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

  if ((formula === "PER_TON" || formula === "PER_TON_KM") && load.isZero()) {
    return new Decimal(0);
  }
  if (formula === "PER_TRIP") {
    return fleet.mul(trips).mul(price);
  }
  if (formula === "PER_TON_KM") {
    return fleet.mul(trips).mul(load).mul(distance).mul(price);
  }
  return fleet.mul(trips).mul(load).mul(price);
}

export function revenueExpression(
  formula: "PER_TON" | "PER_TRIP" | "PER_TON_KM",
  segment: SegmentInput,
  fleetSize: number,
  amount: Decimal,
): string {
  const fleet = String(fleetSize);
  const trips = segment.tripsPerVehicleMonth;
  const price = segment.freightPrice;
  const load = segment.loadTon;
  const distance = segment.distanceKm;
  if (formula === "PER_TRIP") {
    return `${fleet} × ${trips} × ${price} = ¥${amount.toString()}`;
  }
  if (formula === "PER_TON_KM") {
    return `${fleet} × ${trips} × ${load} × ${distance} × ${price} = ¥${amount.toString()}`;
  }
  return `${fleet} × ${trips} × ${load} × ${price} = ¥${amount.toString()}`;
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
  | "driverCostSource"
> {
  const fleetSize = input.fleetSize;
  const formula = resolveRevenueFormula(segment.freightPriceUnit, input.ruleSet.revenue.formulaByUnit);
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

export function summarizeFreightPricing(
  input: Pick<SchemeCalculationInput, "routes" | "freightPriceUnits">,
): FreightPricingSummary {
  const segments = input.routes
    .filter((route) => route.enabled)
    .flatMap((route) => route.segments.filter((seg) => seg.enabled));
  const nameOf = (code: string) => input.freightPriceUnits.find((u) => u.code === code)?.name ?? code;
  const groups = new Map<string, { sum: Decimal; count: number }>();
  for (const seg of segments) {
    const price = toDecimal(seg.freightPrice);
    const cur = groups.get(seg.freightPriceUnit) ?? { sum: new Decimal(0), count: 0 };
    groups.set(seg.freightPriceUnit, { sum: cur.sum.plus(price), count: cur.count + 1 });
  }
  const byUnit = [...groups.entries()].map(([code, g]) => ({
    code,
    name: nameOf(code),
    averagePrice: g.sum.div(g.count).toDecimalPlaces(4).toString(),
    segmentCount: g.count,
  }));
  if (byUnit.length === 0) {
    return { mixed: false, label: "—", averagePrice: null, unitCode: null, byUnit: [] };
  }
  if (byUnit.length === 1) {
    return {
      mixed: false,
      label: `平均运价 ${byUnit[0].averagePrice} ${byUnit[0].name}`,
      averagePrice: byUnit[0].averagePrice,
      unitCode: byUnit[0].code,
      byUnit,
    };
  }
  return {
    mixed: true,
    label: "多计价口径",
    averagePrice: null,
    unitCode: null,
    byUnit,
  };
}
