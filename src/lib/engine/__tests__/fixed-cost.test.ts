import { describe, expect, it } from "vitest";
import { resolveManagementFee } from "../rule-engine";
import { calcFixedCost } from "../fixed-cost";
import { sampleInput } from "./fixture";

const tiers = sampleInput().managementFeeTiers;

describe("FixedCostCalculator / 管理费阶梯", () => {
  it.each([
    [29, "2000"],
    [30, "1500"],
    [49, "1500"],
    [50, "1200"],
    [99, "1200"],
    [100, "1000"],
    [199, "1000"],
    [200, "800"],
  ])("车队 %i 对应管理费 %s", (fleet, fee) => {
    expect(resolveManagementFee(fleet, tiers).toString()).toBe(fee);
  });

  it("固定成本分项都单独输出", () => {
    const result = calcFixedCost(sampleInput());
    expect(result.items.map((i) => i.code)).toEqual([
      "vehicle_rent",
      "management_fee",
      "road_maintenance_fee",
      "maintenance_fee",
      "annual_inspection_fee",
      "insurance_fee",
      "parking_fee",
      "heater_fee",
      "consumable_fee",
    ]);
    expect(result.fixedCostTotal.eq(result.items.reduce((s, i) => s.plus(i.amount), result.items[0].amount.mul(0)))).toBe(true);
  });
});
