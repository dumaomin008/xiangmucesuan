import { Decimal, toDecimal } from "./decimal";
import type { LeaseTypeConfigInput, MonthlyCashFlow, SchemeCalculationInput } from "./types";

export function buildMonthlyCashFlows(params: {
  input: SchemeCalculationInput;
  lease: LeaseTypeConfigInput;
  monthlyRevenue: Decimal;
  operatingCashOut: Decimal;
  monthlyVehicleRent: Decimal;
  taxCashOut: Decimal;
  workingCapitalInterest: Decimal;
}): MonthlyCashFlow[] {
  const months = params.input.calculationYears * 12;
  const delayMonths = Math.max(
    0,
    Math.round(params.input.finance.receivableCycle / params.input.ruleSet.finance.daysPerMonth),
  );
  const downPayment = toDecimal(params.input.vehicle.downPaymentPerVehicle).mul(params.input.fleetSize);
  const installmentMonths = params.input.vehicle.installmentMonths;
  const rule = params.lease.cashFlowRule;

  const rows: MonthlyCashFlow[] = [];
  let cumulative = new Decimal(0);

  for (let month = 1; month <= months; month++) {
    const revenueCashIn = month > delayMonths ? params.monthlyRevenue : new Decimal(0);

    let vehicleCashOut = new Decimal(0);
    if (rule.treatDownPaymentAsFullPurchase && month === rule.downPaymentMonth) {
      vehicleCashOut = vehicleCashOut.plus(downPayment);
    } else if (!rule.treatDownPaymentAsFullPurchase && month === rule.downPaymentMonth && downPayment.gt(0)) {
      vehicleCashOut = vehicleCashOut.plus(downPayment);
    }

    const rentApplies = (() => {
      if (rule.rentDurationMode === "NONE") return false;
      if (month < rule.rentStartMonth) return false;
      if (rule.rentDurationMode === "ALL_MONTHS") return true;
      return month < rule.rentStartMonth + installmentMonths;
    })();
    if (rentApplies) {
      vehicleCashOut = vehicleCashOut.plus(params.monthlyVehicleRent);
    }

    const financingCashFlow = params.workingCapitalInterest;
    const currentNet = revenueCashIn
      .minus(params.operatingCashOut)
      .minus(vehicleCashOut)
      .minus(financingCashFlow)
      .minus(params.taxCashOut);

    cumulative = cumulative.plus(currentNet);
    rows.push({
      monthIndex: month,
      revenueCashIn,
      operatingCashOut: params.operatingCashOut,
      vehicleCashOut,
      financingCashFlow,
      taxCashOut: params.taxCashOut,
      currentNetCashFlow: currentNet,
      cumulativeCashFlow: cumulative,
    });
  }

  return rows;
}
