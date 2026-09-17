import { describe, expect, it } from "vitest";
import { Decimal } from "../decimal";
import { calculateScheme } from "../calculate";
import {
  calculateExcelAnnualCashFlows,
  calculateExcelMonthlyPnl,
  calculateExcelV5,
} from "../excel-v5";
import { resolveManagementFee } from "../rule-engine";
import { calcExcelVehicleCost } from "../fixed-cost";
import { calcExcelOutputVat, calcExcelInputVat, calcExcelVatPayable } from "../tax";
import {
  EXCEL_EXAMPLE_AC,
  EXCEL_EXAMPLE_SEGMENTS,
  excelExampleInput,
  sampleInput,
} from "./fixture";
import type { ExcelPnl } from "../excel-v5";

function expectClose(actual: Decimal, expected: Decimal.Value, label: string, tol = "1e-6") {
  const exp = new Decimal(expected);
  const diff = actual.minus(exp).abs();
  expect(diff.lte(tol), `${label}: actual=${actual.toString()} expected=${exp.toString()} diff=${diff.toString()}`).toBe(
    true,
  );
}

function expectPnl(actual: ExcelPnl, expected: Record<string, string>) {
  for (const key of Object.keys(actual) as (keyof ExcelPnl)[]) {
    if (expected[key] == null) continue;
    expectClose(actual[key], expected[key], String(key));
  }
}

describe("Excel parity 黄金对账", () => {
  it("Case 示例：月度利润表 AC39–AC62 与原表缓存值对上", () => {
    const { total } = calculateExcelMonthlyPnl(excelExampleInput());
    expectPnl(total, EXCEL_EXAMPLE_AC);
  });

  it("Case 示例：calculateScheme 与 Excel 公式副本同一组输入一致（展示位四舍五入）", () => {
    const input = excelExampleInput();
    const { total } = calculateExcelMonthlyPnl(input);
    const output = calculateScheme(input);
    expect(output.monthlyRevenue.toFixed(2)).toBe(total.revenue.toDecimalPlaces(2).toFixed(2));
    expect(output.monthlyTotalCost.toFixed(2)).toBe(total.totalCost.toDecimalPlaces(2).toFixed(2));
    expect(output.monthlyProfit.toFixed(2)).toBe(total.profit.toDecimalPlaces(2).toFixed(2));
    expect(output.monthlyTaxCost.toFixed(2)).toBe(total.vatPayable.toDecimalPlaces(2).toFixed(2));
    expectClose(total.revenue, EXCEL_EXAMPLE_AC.revenue, "scheme-vs-excel revenue");
    expectClose(total.profit, EXCEL_EXAMPLE_AC.profit, "scheme-vs-excel profit");
    expect(JSON.stringify(output)).not.toMatch(/NaN|Infinity|#DIV\/0!|#NUM!/);
  });

  it("Case 02 多路段：按 里程×趟数 分摊固定成本，变动成本留在本路段", () => {
    const { segments } = calculateExcelMonthlyPnl(excelExampleInput());
    for (const row of segments) {
      const golden = EXCEL_EXAMPLE_SEGMENTS[row.segmentId as keyof typeof EXCEL_EXAMPLE_SEGMENTS];
      expectClose(row.revenue, golden.revenue, `${row.segmentId}.revenue`);
      expectClose(row.vehicleCost, golden.vehicleCost, `${row.segmentId}.vehicleCost`);
      expectClose(row.driverCost, golden.driverCost, `${row.segmentId}.driverCost`);
      expectClose(row.energyCost, golden.energyCost, `${row.segmentId}.energyCost`);
      expectClose(row.profit, golden.profit, `${row.segmentId}.profit`);
    }
    const weights = segments.map((s) => s.weight);
    expect(weights[0].toString()).toBe("3240");
    expect(weights[1].toString()).toBe("1854");
    expect(weights[2].toString()).toBe("4950");
  });

  it("Case 01 单路段满载纯租赁：手算公式与引擎一致", () => {
    const input = excelExampleInput();
    input.routes[0].segments = [input.routes[0].segments[0]];
    input.fleetSize = 1;
    input.vehicle.fleetSize = 1;
    input.vehicle.monthlyRentPerVehicle = "10000";
    input.vehicle.maintenanceFee = "0";
    input.vehicle.annualInspectionFee = "0";
    input.vehicle.insuranceFee = "0";
    input.vehicle.heaterFee = "0";
    input.vehicle.consumableFee = "0";
    input.routes[0].segments[0].distanceKm = "100";
    input.routes[0].segments[0].freightPrice = "10";
    input.routes[0].segments[0].loadTon = "20";
    input.routes[0].segments[0].tripsPerVehicleMonth = "8";
    input.routes[0].segments[0].operatingMonthsYear = "12";
    input.routes[0].segments[0].driverCostPerTrip = "100";
    input.routes[0].segments[0].tollPerTrip = "0";
    input.routes[0].segments[0].informationFee = "0";
    input.routes[0].segments[0].loadedEnergyConsumption = "2";
    input.routes[0].segments[0].emptyEnergyConsumption = "1";
    input.routes[0].segments[0].electricityPrice = "1";
    input.vehicle.tireLifeKm = "80000";
    input.vehicle.tireCount = 10;
    input.vehicle.tireUnitPrice = "800";
    input.finance.workingCapitalInterestRate = "0.12";
    input.finance.workingCapitalLoanCycle = 1;
    input.finance.discountRate = "0";
    input.finance.receivableCycle = 0;

    const { total } = calculateExcelMonthlyPnl(input);
    expect(total.revenue.toString()).toBe("1600");
    expect(total.energyCost.toString()).toBe("1600");
    expect(total.tireCost.toString()).toBe("80");
    expect(total.vehicleCost.toString()).toBe("10000");
    expect(total.managementFee.toString()).toBe("2000");
    expect(total.driverCost.toString()).toBe("800");
    expectClose(total.wcInterest, "144.8", "wc");
    const outputVat = calcExcelOutputVat(new Decimal(1600));
    const inputVat = calcExcelInputVat({
      vehicleCost: new Decimal(10000),
      energyCost: new Decimal(1600),
      tireCost: new Decimal(80),
      insuranceCost: new Decimal(0),
    });
    expectClose(total.outputVat, outputVat, "outputVat");
    expectClose(total.inputVat, inputVat, "inputVat");
    expectClose(total.vatPayable, calcExcelVatPayable(outputVat, inputVat), "vatPayable");
    expect(total.profit.eq(total.revenue.minus(total.totalCost))).toBe(true);
  });

  it("路段电价相互独立：不同含电损均价按各自路段计入能源成本", () => {
    const input = excelExampleInput();
    input.routes[0].segments[0].electricityPrice = "1";
    input.routes[0].segments[1].electricityPrice = "2";
    input.routes[0].segments[2].electricityPrice = "0.5";
    const { segments, total } = calculateExcelMonthlyPnl(input);
    const expected = segments.reduce((sum, row) => sum.plus(row.energyCost), new Decimal(0));
    expectClose(total.energyCost, expected, "sum-energy");
    expect(segments[0].energyCost.eq(segments[1].energyCost)).toBe(false);
  });

  it("Case 03 载重为 0：收入为 0，能耗走空载 kWh/km", () => {
    const input = excelExampleInput();
    input.routes[0].segments = [input.routes[0].segments[0]];
    input.routes[0].segments[0].loadTon = "0";
    input.routes[0].segments[0].distanceKm = "100";
    input.routes[0].segments[0].tripsPerVehicleMonth = "8";
    input.routes[0].segments[0].electricityPrice = "1";
    input.routes[0].segments[0].loadedEnergyConsumption = "2";
    input.routes[0].segments[0].emptyEnergyConsumption = "1";
    input.fleetSize = 1;
    const { total } = calculateExcelMonthlyPnl(input);
    expect(total.revenue.toString()).toBe("0");
    expect(total.energyCost.toString()).toBe("800");
    const output = calculateScheme(input);
    expect(output.profitMargin).toBeNull();
    expect(output.profitMarginReason).toContain("无法计算");
  });

  it.each([
    [29, "2000"],
    [30, "1500"],
    [49, "1500"],
    [50, "1200"],
    [99, "1200"],
    [100, "1000"],
    [199, "1000"],
    [200, "800"],
  ])("Case 04 管理费边界：车队 %i → 单车 %s，AC42=fee×fleet×12/运营月数", (fleet, fee) => {
    expect(resolveManagementFee(fleet, excelExampleInput().managementFeeTiers).toString()).toBe(fee);
    const input = excelExampleInput();
    input.fleetSize = fleet;
    input.vehicle.fleetSize = fleet;
    const { total } = calculateExcelMonthlyPnl(input);
    expectClose(total.managementFee, new Decimal(fee).mul(fleet).mul(12).div(10), `fleet=${fleet} AC42`);
  });

  it("Case 05 非纯租赁：车辆成本含首付摊销，流动资金基数仍只用年化月租", () => {
    const input = excelExampleInput();
    input.leaseType = "HIRE_PURCHASE";
    input.vehicle.leaseType = "HIRE_PURCHASE";
    input.vehicle.downPaymentPerVehicle = "60000";
    input.finance.depreciationMonths = 60;
    const { total, annualizedRent } = calculateExcelMonthlyPnl(input);
    expect(total.vehicleCost.toString()).toBe("35760");
    expect(annualizedRent.toString()).toBe("33360");
    expect(total.vehicleCost.gt(annualizedRent)).toBe(true);

    const annual = calculateExcelAnnualCashFlows(input);
    expect(annual[0].yearIndex).toBe(0);
    expect(annual[0].currentNetCashFlow.lt(0)).toBe(true);
    expectClose(annual[0].currentNetCashFlow, new Decimal(-120000).minus(new Decimal(120000).mul("0.13").div("1.13")), "year0");

    const v5 = calculateExcelV5(input);
    const irr4 = v5.irrByYears.find((row) => row.years === 4);
    expect(irr4?.irr).not.toBeNull();
    expect(irr4?.reason).toBeNull();
  });

  it("Case 06 IRR 4/5/6/8 年：示例无首付全为正，返回无法计算而不是 #NUM!", () => {
    const v5 = calculateExcelV5(excelExampleInput());
    const annual = v5.annualCashFlows;
    expectClose(annual[0].currentNetCashFlow, 0, "year0");
    expectClose(annual[1].currentNetCashFlow, EXCEL_EXAMPLE_AC.annualYear1CashFlow, "year1");
    expectClose(annual[2].currentNetCashFlow, EXCEL_EXAMPLE_AC.annualYear1CashFlow, "year2");
    expect(annual[3].active).toBe(false);
    for (const years of [4, 5, 6, 8]) {
      const row = v5.irrByYears.find((item) => item.years === years);
      expect(row?.irr).toBeNull();
      expect(row?.reason).toContain("无法计算");
    }
    const output = calculateScheme(excelExampleInput());
    expect(output.irr).toBeNull();
    expect(output.irrReason).toContain("无法计算");
  });
});

describe("Excel 公式单元", () => {
  it("纯租赁车辆成本 = fleet × 月租 × 12 / 运营月数", () => {
    const cost = calcExcelVehicleCost({
      isPureLease: true,
      fleetSize: 2,
      monthlyRent: new Decimal(13900),
      downPayment: new Decimal(0),
      depreciationMonths: new Decimal(60),
      operatingMonths: new Decimal(10),
    });
    expect(cost.toString()).toBe("33360");
  });

  it("非纯租赁车辆成本 = fleet × (首付/折旧月 + 月租) × 12 / 运营月数", () => {
    const cost = calcExcelVehicleCost({
      isPureLease: false,
      fleetSize: 2,
      monthlyRent: new Decimal(13900),
      downPayment: new Decimal(60000),
      depreciationMonths: new Decimal(60),
      operatingMonths: new Decimal(10),
    });
    expect(cost.toString()).toBe("35760");
  });
});

describe("既有集成夹具在 Excel 口径下仍可算通", () => {
  it("sampleInput 输出有限且利润恒等式成立", () => {
    const output = calculateScheme(sampleInput());
    expect(output.monthlyRevenue.gt(0)).toBe(true);
    expect(
      output.monthlyTotalCost.eq(
        output.monthlyFixedCost.plus(output.monthlyVariableCost).plus(output.monthlyFinanceCost).plus(output.monthlyTaxCost),
      ),
    ).toBe(true);
    expect(output.monthlyProfit.eq(output.monthlyRevenue.minus(output.monthlyTotalCost))).toBe(true);
    expect(output.cashFlows).toHaveLength(60);
  });
});
