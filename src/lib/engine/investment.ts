import { Decimal } from "./decimal";
import { IRR_REASONS } from "./reasons";

function solveIrr(
  cashFlows: Decimal[],
  guess: number,
  maxIter: number,
  tolerance: number,
): { irr: Decimal | null; reason: string | null } {
  if (cashFlows.length < 2) {
    return { irr: null, reason: IRR_REASONS.IRR_INSUFFICIENT_PERIODS };
  }

  const hasPositive = cashFlows.some((v) => v.gt(0));
  const hasNegative = cashFlows.some((v) => v.lt(0));
  if (!hasPositive || !hasNegative) {
    return { irr: null, reason: IRR_REASONS.IRR_NO_SIGN_CHANGE };
  }

  let rate = new Decimal(guess);
  for (let i = 0; i < maxIter; i++) {
    let npv = new Decimal(0);
    let dNpv = new Decimal(0);
    for (let t = 0; t < cashFlows.length; t++) {
      const denom = rate.plus(1).pow(t);
      if (denom.isZero()) {
        return { irr: null, reason: IRR_REASONS.IRR_DIV_ZERO };
      }
      npv = npv.plus(cashFlows[t].div(denom));
      if (t > 0) {
        dNpv = dNpv.minus(cashFlows[t].mul(t).div(rate.plus(1).pow(t + 1)));
      }
    }
    if (dNpv.isZero()) {
      return { irr: null, reason: IRR_REASONS.IRR_NOT_CONVERGED };
    }
    const next = rate.minus(npv.div(dNpv));
    if (!next.isFinite() || next.abs().gt(100)) {
      return { irr: null, reason: IRR_REASONS.IRR_DIVERGED };
    }
    if (next.minus(rate).abs().lt(tolerance)) {
      return { irr: next, reason: null };
    }
    rate = next;
  }
  return { irr: null, reason: IRR_REASONS.IRR_NOT_CONVERGED };
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
    return { irr: null, reason: IRR_REASONS.IRR_ANNUALIZE_INVALID };
  }
  return { irr: annual, reason: null };
}

/**
 * 首次累计现金流转正：previous < 0 且 current >= 0。
 * Month 0 已经 >= 0 时返回 0，不得误判为 Month 1。
 * 整个测算期均未转正则返回 null。
 */
export function firstPositiveMonth(cashFlows: { monthIndex: number; cumulativeCashFlow: Decimal }[]): number | null {
  for (let i = 0; i < cashFlows.length; i++) {
    const current = cashFlows[i].cumulativeCashFlow;
    if (i === 0) {
      if (current.gte(0)) return cashFlows[i].monthIndex;
      continue;
    }
    const previous = cashFlows[i - 1].cumulativeCashFlow;
    if (previous.lt(0) && current.gte(0)) {
      return cashFlows[i].monthIndex;
    }
  }
  return null;
}

export function calcIrrForYears(
  monthly: Decimal[],
  years: number,
): { irr: Decimal | null; reason: string | null } {
  const months = years * 12;
  const slice = monthly.slice(0, months);
  if (slice.length < months) {
    return { irr: null, reason: IRR_REASONS.IRR_HORIZON_SHORT };
  }
  return newtonRaphsonIrr(slice);
}
