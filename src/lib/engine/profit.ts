import { Decimal, safeDiv } from "./decimal";
import { PROFIT_MARGIN_REASONS } from "./reasons";

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
    return { margin: null, reason: PROFIT_MARGIN_REASONS.REVENUE_ZERO };
  }
  return { margin, reason: null };
}
