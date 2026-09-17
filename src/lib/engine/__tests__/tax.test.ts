import { describe, expect, it } from "vitest";
import { Decimal } from "../decimal";
import { calcInputVat, calcOutputVat, calcTaxCostForProfit, calcVatPayable, settleMonthlyVat } from "../tax";

describe("TaxCalculator", () => {
  it("正常销项税", () => {
    expect(calcOutputVat({ revenue: new Decimal(10000), outputVatRate: "0.09", pricesIncludeVat: false }).toString()).toBe("900");
  });

  it("税额为负时按留抵规则利润税成本为 0", () => {
    const payable = calcVatPayable(new Decimal(100), new Decimal(300));
    expect(payable.toString()).toBe("-200");
    expect(calcTaxCostForProfit(payable, "CARRY_FORWARD").toString()).toBe("0");
    expect(calcTaxCostForProfit(payable, "RECOGNIZE_NEGATIVE").toString()).toBe("-200");
  });

  it("进项按可抵扣范围汇总", () => {
    const inputVat = calcInputVat({
      costs: { energy_cost: new Decimal(1000), toll: new Decimal(500) },
      rule: {
        code: "STANDARD_DEDUCT",
        name: "标准抵扣",
        deductibleCostCodes: ["energy_cost"],
        inputVatRate: "0.13",
        negativeVatHandling: "CARRY_FORWARD",
      },
    });
    expect(inputVat.toString()).toBe("130");
  });

  it("CARRY_FORWARD 留抵：负差不形成现金流入", () => {
    const settled = settleMonthlyVat({
      openingVatCredit: new Decimal(0),
      outputVat: new Decimal(50000),
      inputVat: new Decimal(80000),
      handling: "CARRY_FORWARD",
    });
    expect(settled.vatCashOut.toString()).toBe("0");
    expect(settled.closingVatCredit.toString()).toBe("30000");
  });
});
