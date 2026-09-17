import { Decimal } from "./decimal";

function solveIrr(
  cashFlows: Decimal[],
  guess: number,
  maxIter: number,
  tolerance: number,
): { irr: Decimal | null; reason: string | null } {
  if (cashFlows.length < 2) {
    return { irr: null, reason: "现金流期数不足，无法计算" };
  }

  const hasPositive = cashFlows.some((v) => v.gt(0));
  const hasNegative = cashFlows.some((v) => v.lt(0));
  if (!hasPositive || !hasNegative) {
    return { irr: null, reason: "现金流未同时出现正负号，无法计算" };
  }

  let rate = new Decimal(guess);
  for (let i = 0; i < maxIter; i++) {
    let npv = new Decimal(0);
    let dNpv = new Decimal(0);
    for (let t = 0; t < cashFlows.length; t++) {
      const denom = rate.plus(1).pow(t);
      if (denom.isZero()) {
        return { irr: null, reason: "迭代过程中分母为 0，无法计算" };
      }
      npv = npv.plus(cashFlows[t].div(denom));
      if (t > 0) {
        dNpv = dNpv.minus(cashFlows[t].mul(t).div(rate.plus(1).pow(t + 1)));
      }
    }
    if (dNpv.isZero()) {
      return { irr: null, reason: "导数为 0，无法计算" };
    }
    const next = rate.minus(npv.div(dNpv));
    if (!next.isFinite() || next.abs().gt(100)) {
      return { irr: null, reason: "迭代发散，无法计算" };
    }
    if (next.minus(rate).abs().lt(tolerance)) {
      return { irr: next, reason: null };
    }
    rate = next;
  }
  return { irr: null, reason: "超过最大迭代次数，无法计算" };
}

/** Excel IRR()：对给定周期现金流求解，不做月度年化 */
export function newtonRaphsonPeriodicIrr(
  cashFlows: Decimal[],
  guess = 0.1,
  maxIter = 80,
  tolerance = 1e-8,
): { irr: Decimal | null; reason: string | null } {
  return solveIrr(cashFlows, guess, maxIter, tolerance);
}

/** 月度现金流 IRR 再年化：(1+r)^12-1 */
export function newtonRaphsonIrr(
  cashFlows: Decimal[],
  guess = 0.01,
  maxIter = 80,
  tolerance = 1e-8,
): { irr: Decimal | null; reason: string | null } {
  const monthly = solveIrr(cashFlows, guess, maxIter, tolerance);
  if (monthly.irr == null) return monthly;
  const annual = monthly.irr.plus(1).pow(12).minus(1);
  if (!annual.isFinite()) {
    return { irr: null, reason: "年化结果非法，无法计算" };
  }
  return { irr: annual, reason: null };
}

export function firstPositiveMonth(cashFlows: { monthIndex: number; cumulativeCashFlow: Decimal }[]): number | null {
  const found = cashFlows.find((row) => row.cumulativeCashFlow.gte(0));
  return found ? found.monthIndex : null;
}

export function calcIrrForYears(
  monthly: Decimal[],
  years: number,
): { irr: Decimal | null; reason: string | null } {
  const months = years * 12;
  const slice = monthly.slice(0, months);
  if (slice.length < months) {
    return { irr: null, reason: `测算年限不足 ${years} 年` };
  }
  return newtonRaphsonIrr(slice);
}
