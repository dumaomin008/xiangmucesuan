import { describe, expect, it } from "vitest";
import { Decimal } from "../decimal";
import { calcProfit, calcProfitMargin, calcTotalCost } from "../profit";

describe("ProfitCalculator", () => {
  it("正常利润率", () => {
    const total = calcTotalCost({
      fixedCost: new Decimal(100),
      variableCost: new Decimal(50),
      financeCost: new Decimal(10),
      taxCost: new Decimal(5),
    });
    expect(total.toString()).toBe("165");
    const profit = calcProfit(new Decimal(200), total);
    expect(profit.toString()).toBe("35");
    expect(calcProfitMargin(profit, new Decimal(200)).margin?.toString()).toBe("0.175");
  });

  it("营收为 0 时利润率返回 null，不抛除零", () => {
    const result = calcProfitMargin(new Decimal(-100), new Decimal(0));
    expect(result.margin).toBeNull();
    expect(result.reason).toContain("无法计算");
  });
});
