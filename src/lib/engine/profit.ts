import { Decimal, safeDiv } from "./decimal";

export function calcTotalCost(params: {
  fixedCost: Decimal;
  variableCost: Decimal;
  financeCost: Decimal;
  taxCost: Decimal;
}): Decimal {
  return params.fixedCost
    .plus(params.variableCost)
    .plus(params.financeCost)
    .plus(params.taxCost);
}

export function calcProfit(revenue: Decimal, totalCost: Decimal): Decimal {
  return revenue.minus(totalCost);
}

export function calcProfitMargin(
  profit: Decimal,
  revenue: Decimal,
): { margin: Decimal | null; reason: string | null } {
  const margin = safeDiv(profit, revenue);
  if (margin === null) {
    return { margin: null, reason: "营收为 0，利润率无法计算" };
  }
  return { margin, reason: null };
}
