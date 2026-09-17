import { describe, expect, it } from "vitest";
import { Decimal } from "../decimal";
import { calcEnergyCost, calcEnergyQuantity, calcExcelSegmentEnergyCost } from "../energy";

describe("Excel energy kWh/km", () => {
  it("载重 > 0 整段按满载能耗，单位 kWh/km 不除以 100", () => {
    const { energyQuantity, energyCost } = calcExcelSegmentEnergyCost({
      fleetSize: 1,
      electricityPrice: new Decimal(1),
      loadedConsumptionKwhKm: new Decimal(2),
      emptyConsumptionKwhKm: new Decimal(1),
      loadTon: new Decimal(20),
      distanceKm: new Decimal(100),
      tripsPerVehicleMonth: new Decimal(8),
    });
    expect(energyQuantity.toString()).toBe("1600");
    expect(energyCost.toString()).toBe("1600");
  });

  it("载重 = 0 整段按空载能耗", () => {
    const { energyQuantity, energyCost } = calcExcelSegmentEnergyCost({
      fleetSize: 1,
      electricityPrice: new Decimal(1),
      loadedConsumptionKwhKm: new Decimal(2),
      emptyConsumptionKwhKm: new Decimal(1),
      loadTon: new Decimal(0),
      distanceKm: new Decimal(100),
      tripsPerVehicleMonth: new Decimal(8),
    });
    expect(energyQuantity.toString()).toBe("800");
    expect(energyCost.toString()).toBe("800");
  });
});

describe("预留 kWh/100km 规则（当前 V1 Excel 口径不走这条）", () => {
  it("正常值", () => {
    const qty = calcEnergyQuantity({
      loadedMileage: new Decimal(72000),
      emptyMileage: new Decimal(72000),
      loadedConsumption: new Decimal(135),
      emptyConsumption: new Decimal(95),
    });
    expect(qty.toString()).toBe("165600");
    expect(calcEnergyCost({ energyQuantity: qty, electricityPrice: new Decimal("0.82") }).toString()).toBe("135792");
  });

  it("里程为 0 时能源成本为 0", () => {
    const qty = calcEnergyQuantity({
      loadedMileage: new Decimal(0),
      emptyMileage: new Decimal(0),
      loadedConsumption: new Decimal(135),
      emptyConsumption: new Decimal(95),
    });
    expect(qty.toString()).toBe("0");
  });
});
