import { describe, expect, it } from "vitest";
import { calcSegmentRevenue, calcSegmentMonthlyVolume, calcVehicleMonthlyVolume } from "../revenue";
import { sampleInput } from "./fixture";

const segment = sampleInput().routes[0].segments[0];

describe("RevenueCalculator", () => {
  it("正常值：按吨计收", () => {
    const revenue = calcSegmentRevenue(segment, 40, "PER_TON");
    expect(revenue.toString()).toBe("2640000");
  });

  it("按趟计收", () => {
    const revenue = calcSegmentRevenue(segment, 40, "PER_TRIP");
    expect(revenue.toString()).toBe("88000");
  });

  it("按吨公里计收", () => {
    const revenue = calcSegmentRevenue(segment, 40, "PER_TON_KM");
    expect(revenue.toString()).toBe("475200000");
  });

  it("趟数为 0 时收入为 0", () => {
    const revenue = calcSegmentRevenue({ ...segment, tripsPerVehicleMonth: "0" }, 40, "PER_TON");
    expect(revenue.toString()).toBe("0");
  });

  it("极大值仍为有限 Decimal", () => {
    const revenue = calcSegmentRevenue({ ...segment, freightPrice: "999999" }, 999, "PER_TON");
    expect(revenue.isFinite()).toBe(true);
  });

  it("运量公式", () => {
    expect(calcVehicleMonthlyVolume(segment).toString()).toBe("300");
    expect(calcSegmentMonthlyVolume(segment, 40).toString()).toBe("12000");
  });

  it("空字符串抛错而不是 NaN", () => {
    expect(() => calcSegmentRevenue({ ...segment, freightPrice: "" }, 40, "PER_TON")).toThrow();
  });
});
