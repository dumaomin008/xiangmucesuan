import { Decimal, toDecimal } from "./decimal";
import type { InputVatRuleInput } from "./types";

export function calcExcelOutputVat(revenue: Decimal, outputVatRate: Decimal.Value): Decimal {
  const rate = toDecimal(outputVatRate);
  return revenue.mul(rate).div(rate.plus(1));
}

export function calcExcelInputVat(params: {
  vehicleCost: Decimal;
  energyCost: Decimal;
  tireCost: Decimal;
  insuranceCost: Decimal;
  inputStandardRate: Decimal.Value;
  inputInsuranceRate: Decimal.Value;
}): Decimal {
  const rate13 = toDecimal(params.inputStandardRate);
  const rate6 = toDecimal(params.inputInsuranceRate);
  const vat13 = params.vehicleCost.plus(params.energyCost).plus(params.tireCost).mul(rate13).div(rate13.plus(1));
  const vat6 = params.insuranceCost.mul(rate6).div(rate6.plus(1));
  return vat13.plus(vat6);
}

export function calcExcelVatPayable(outputVat: Decimal, inputVat: Decimal): Decimal {
  const raw = outputVat.minus(inputVat);
  return raw.gt(0) ? raw : new Decimal(0);
}

export function calcOutputVat(params: {
  revenue: Decimal;
  outputVatRate: string;
  pricesIncludeVat: boolean;
}): Decimal {
  const rate = toDecimal(params.outputVatRate);
  if (params.pricesIncludeVat) {
    return params.revenue.div(rate.plus(1)).mul(rate);
  }
  return params.revenue.mul(rate);
}

export function calcInputVat(params: {
  costs: Record<string, Decimal>;
  rule: InputVatRuleInput;
}): Decimal {
  const rate = toDecimal(params.rule.inputVatRate);
  const deductible = params.rule.deductibleCostCodes.reduce((sum, code) => {
    return sum.plus(params.costs[code] ?? new Decimal(0));
  }, new Decimal(0));
  return deductible.mul(rate);
}

export function calcVatPayable(outputVat: Decimal, inputVat: Decimal): Decimal {
  return outputVat.minus(inputVat);
}

export function calcTaxCostForProfit(
  vatPayable: Decimal,
  handling: InputVatRuleInput["negativeVatHandling"],
): Decimal {
  if (handling === "CARRY_FORWARD" && vatPayable.lt(0)) {
    return new Decimal(0);
  }
  return vatPayable;
}
