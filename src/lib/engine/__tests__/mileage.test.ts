import { describe, expect, it } from "vitest";
import { calcSegmentMonthlyMileage } from "../revenue";
import { sampleInput } from "./fixture";

describe("MileageCalculator", () => {
  it("路段月里程 = 里程 × 趟数 × 车队", () => {
    const seg = sampleInput().routes[0].segments[0];
    expect(calcSegmentMonthlyMileage(seg, 40).toString()).toBe("72000");
  });

  it("里程 0", () => {
    const seg = { ...sampleInput().routes[0].segments[0], distanceKm: "0" };
    expect(calcSegmentMonthlyMileage(seg, 40).eq(0)).toBe(true);
  });
});
