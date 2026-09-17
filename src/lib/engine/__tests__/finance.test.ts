import { describe, expect, it } from "vitest";
import { Decimal } from "../decimal";
import { calcFinanceCost } from "../finance";

describe("FinanceCostCalculator", () => {
  it("正常值", () => {
    const result = calcFinanceCost({
      revenue: new Decimal("2640000"),
      receivableCycle: 45,
      workingCapitalLoanCycle: 30,
      workingCapitalInterestRate: "0.045",
      discountRate: "0.08",
      advanceRateSource: "WORKING_CAPITAL_INTEREST_RATE",
      principalMode: "REVENUE_TIMES_LOAN_CYCLE_MONTHS",
      daysPerMonth: 30,
    });
    expect(result.financeCostTotal.isFinite()).toBe(true);
    expect(result.revenueAdvanceCost.gt(0)).toBe(true);
  });

  it("利率为 0 时财务成本为 0", () => {
    const result = calcFinanceCost({
      revenue: new Decimal("2640000"),
      receivableCycle: 45,
      workingCapitalLoanCycle: 30,
      workingCapitalInterestRate: "0",
      discountRate: "0",
      advanceRateSource: "WORKING_CAPITAL_INTEREST_RATE",
      principalMode: "REVENUE_TIMES_LOAN_CYCLE_MONTHS",
      daysPerMonth: 30,
    });
    expect(result.financeCostTotal.toString()).toBe("0");
  });
});
