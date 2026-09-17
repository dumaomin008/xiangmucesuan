import { Decimal, safeDiv, toDecimal } from "./decimal";

export function calcTireCostPerKm(params: {
  tireCount: number;
  tireUnitPrice: string;
  tireLifeKm: string;
}): Decimal | null {
  const life = toDecimal(params.tireLifeKm);
  const numerator = new Decimal(params.tireCount).mul(toDecimal(params.tireUnitPrice));
  return safeDiv(numerator, life);
}

export function calcMonthlyTireCost(params: {
  monthlyMileage: Decimal;
  tireCount: number;
  tireUnitPrice: string;
  tireLifeKm: string;
}): { costPerKm: Decimal | null; monthlyTireCost: Decimal } {
  const costPerKm = calcTireCostPerKm(params);
  if (costPerKm === null) {
    return { costPerKm, monthlyTireCost: new Decimal(0) };
  }
  return { costPerKm, monthlyTireCost: params.monthlyMileage.mul(costPerKm) };
}
