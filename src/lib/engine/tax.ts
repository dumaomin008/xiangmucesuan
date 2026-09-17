import { Decimal, toDecimal } from "./decimal";
import type { InputVatRuleInput } from "./types";

const EXCEL_OUTPUT_VAT_RATE = new Decimal("0.09");
const EXCEL_INPUT_VAT_13 = new Decimal("0.13");
const EXCEL_INPUT_VAT_6 = new Decimal("0.06");

/** Excel AC58：revenue × 9% / 1.09（含税价） */
export function calcExcelOutputVat(revenue: Decimal, outputVatRate = EXCEL_OUTPUT_VAT_RATE): Decimal {
  return revenue.mul(outputVatRate).div(outputVatRate.plus(1));
}

/** Excel AC59：(车辆+能源+轮胎)×13%/1.13 + 保险×6%/1.06 */
export function calcExcelInputVat(params: {
  vehicleCost: Decimal;
  energyCost: Decimal;
  tireCost: Decimal;
  insuranceCost: Decimal;
}): Decimal {
  const rate13 = EXCEL_INPUT_VAT_13;
  const rate6 = EXCEL_INPUT_VAT_6;
  const vat13 = params.vehicleCost.plus(params.energyCost).plus(params.tireCost).mul(rate13).div(rate13.plus(1));
  const vat6 = params.insuranceCost.mul(rate6).div(rate6.plus(1));
  return vat13.plus(vat6);
}

/** Excel AC60：MAX(0, 销项-进项) */
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
