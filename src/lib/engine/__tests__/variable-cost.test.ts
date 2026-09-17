import { describe, expect, it } from "vitest";
import { Decimal } from "../decimal";
import { calcDriverCost } from "../variable-cost";

describe("VariableCostCalculator", () => {
  it("按车/月", () => {
    expect(
      calcDriverCost({
        driverCost: "12000",
        driverCostType: "PER_VEHICLE_MONTH",
        fleetSize: 40,
        totalTrips: new Decimal(400),
      }).toString(),
    ).toBe("480000");
  });

  it("按趟", () => {
    expect(
      calcDriverCost({
        driverCost: "200",
        driverCostType: "PER_TRIP",
        fleetSize: 40,
        totalTrips: new Decimal(400),
      }).toString(),
    ).toBe("80000");
  });

  it("固定月", () => {
    expect(
      calcDriverCost({
        driverCost: "50000",
        driverCostType: "FIXED_MONTH",
        fleetSize: 40,
        totalTrips: new Decimal(400),
      }).toString(),
    ).toBe("50000");
  });
});
