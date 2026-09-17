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

function minDec(a: Decimal, b: Decimal): Decimal {
  return a.lte(b) ? a : b;
}

function maxDec(a: Decimal, b: Decimal): Decimal {
  return a.gte(b) ? a : b;
}

export type VatSettlement = {
  openingVatCredit: Decimal;
  outputVat: Decimal;
  inputVat: Decimal;
  vatCreditUsed: Decimal;
  vatCashOut: Decimal;
  closingVatCredit: Decimal;
};

/**
 * V1 现金流 VAT 结算。
 * CARRY_FORWARD：进项超过销项时形成留抵，当月不产生现金流入。
 * RECOGNIZE_NEGATIVE：当月进销项差额全部计入现金流，进项大于销项视为退税流入，不结转留抵。
 */
export function settleMonthlyVat(params: {
  openingVatCredit: Decimal;
  outputVat: Decimal;
  inputVat: Decimal;
  handling: InputVatRuleInput["negativeVatHandling"];
}): VatSettlement {
  const { openingVatCredit, outputVat, inputVat, handling } = params;
  if (handling === "RECOGNIZE_NEGATIVE") {
    const vatCreditUsed = minDec(outputVat, inputVat);
    return {
      openingVatCredit,
      outputVat,
      inputVat,
      vatCreditUsed: vatCreditUsed.gt(0) ? vatCreditUsed : new Decimal(0),
      vatCashOut: outputVat.minus(inputVat),
      closingVatCredit: new Decimal(0),
    };
  }

  const availableCredit = openingVatCredit.plus(inputVat);
  return {
    openingVatCredit,
    outputVat,
    inputVat,
    vatCreditUsed: minDec(outputVat, availableCredit),
    vatCashOut: maxDec(new Decimal(0), outputVat.minus(availableCredit)),
    closingVatCredit: maxDec(new Decimal(0), availableCredit.minus(outputVat)),
  };
}
