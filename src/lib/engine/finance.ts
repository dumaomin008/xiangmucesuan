import { Decimal, toDecimal } from "./decimal";
import type { FinanceRule } from "./types";

/** Excel AC56：营收 × 年贴现率 / 12 × 回款周期(月)；周期空为 0 */
export function calcExcelAdvanceCost(params: {
  revenue: Decimal;
  discountRate: Decimal;
  receivableCycleMonths: Decimal;
}): Decimal {
  return params.revenue.mul(params.discountRate).div(12).mul(params.receivableCycleMonths);
}

/**
 * Excel AC57：($E$4*$E$13*12/$E$10 + SUM(AC42:AC55)) * 利率/12 * 贷款周期
 * 流动资金基数用年化月租，不含非纯租赁首付摊销（不用 AC41）。
 */
export function calcExcelWorkingCapitalInterest(params: {
  annualizedRent: Decimal;
  sumAc42ToAc55: Decimal;
  workingCapitalInterestRate: Decimal;
  loanCycleMonths: Decimal;
}): Decimal {
  const base = params.annualizedRent.plus(params.sumAc42ToAc55);
  return base.mul(params.workingCapitalInterestRate).div(12).mul(params.loanCycleMonths);
}

export function calcRevenueAdvanceCost(params: {
  revenue: Decimal;
  receivableCycleDays: number;
  annualRate: Decimal;
  daysPerMonth: number;
}): Decimal {
  const cycleMonths = new Decimal(params.receivableCycleDays).div(params.daysPerMonth);
  const monthlyRate = params.annualRate.div(12);
  return params.revenue.mul(cycleMonths).mul(monthlyRate);
}

export function calcWorkingCapitalInterest(params: {
  revenue: Decimal;
  loanCycleDays: number;
  annualRate: Decimal;
  daysPerMonth: number;
  principalMode: FinanceRule["workingCapitalPrincipalMode"];
}): { principal: Decimal; workingCapitalInterest: Decimal } {
  const cycleMonths = new Decimal(params.loanCycleDays).div(params.daysPerMonth);
  const principal =
    params.principalMode === "REVENUE_TIMES_LOAN_CYCLE_MONTHS"
      ? params.revenue.mul(cycleMonths)
      : params.revenue.mul(cycleMonths);
  const workingCapitalInterest = principal.mul(params.annualRate.div(12));
  return { principal, workingCapitalInterest };
}

export function calcFinanceCost(params: {
  revenue: Decimal;
  receivableCycle: number;
  workingCapitalLoanCycle: number;
  workingCapitalInterestRate: string;
  discountRate: string;
  advanceRateSource: FinanceRule["advanceRateSource"];
  principalMode: FinanceRule["workingCapitalPrincipalMode"];
  daysPerMonth: number;
}) {
  const annualRate =
    params.advanceRateSource === "DISCOUNT_RATE"
      ? toDecimal(params.discountRate)
      : toDecimal(params.workingCapitalInterestRate);
  const revenueAdvanceCost = calcRevenueAdvanceCost({
    revenue: params.revenue,
    receivableCycleDays: params.receivableCycle,
    annualRate,
    daysPerMonth: params.daysPerMonth,
  });
  const wc = calcWorkingCapitalInterest({
    revenue: params.revenue,
    loanCycleDays: params.workingCapitalLoanCycle,
    annualRate: toDecimal(params.workingCapitalInterestRate),
    daysPerMonth: params.daysPerMonth,
    principalMode: params.principalMode,
  });
  return {
    revenueAdvanceCost,
    workingCapitalPrincipal: wc.principal,
    workingCapitalInterest: wc.workingCapitalInterest,
    financeCostTotal: revenueAdvanceCost.plus(wc.workingCapitalInterest),
  };
}
