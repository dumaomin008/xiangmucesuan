import { describe, expect, it } from "vitest";
import { Decimal } from "../decimal";
import { calcMonthlyTireCost, calcTireCostPerKm } from "../tire";

describe("TireCalculator", () => {
  it("正常值", () => {
    const perKm = calcTireCostPerKm({ tireCount: 12, tireUnitPrice: "1800", tireLifeKm: "80000" });
    expect(perKm?.toString()).toBe("0.27");
    const monthly = calcMonthlyTireCost({
      monthlyMileage: new Decimal(72000),
      tireCount: 12,
      tireUnitPrice: "1800",
      tireLifeKm: "80000",
    });
    expect(monthly.monthlyTireCost.toString()).toBe("19440");
  });

  it("寿命为 0 时分母保护，返回 null 而不是 Infinity", () => {
    const perKm = calcTireCostPerKm({ tireCount: 12, tireUnitPrice: "1800", tireLifeKm: "0" });
    expect(perKm).toBeNull();
  });
});
