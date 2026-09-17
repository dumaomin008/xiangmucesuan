import { describe, expect, it } from "vitest";
import { Decimal } from "../../src/lib/engine/decimal";
import { calculateScheme } from "../../src/lib/engine/calculate";
import { calculateExcelMonthlyPnl, calculateExcelV5 } from "../../src/lib/engine/excel-v5";
import { resolveManagementFee } from "../../src/lib/engine/rule-engine";
import { runSensitivity } from "../../src/lib/engine/sensitivity";
import { summarizeFreightPricing } from "../../src/lib/engine/revenue";
import { resolveSegmentDriverPerTrip } from "../../src/lib/engine/variable-cost";
import {
  EXCEL_EXAMPLE_AC,
  excelExampleInput,
} from "../../src/lib/engine/__tests__/fixture";

function expectClose(actual: Decimal, expected: Decimal.Value, label: string, tol = "0.01") {
  const exp = new Decimal(expected);
  const diff = actual.minus(exp).abs();
  expect(diff.lte(tol), `${label}: actual=${actual.toString()} expected=${exp.toString()} diff=${diff.toString()}`).toBe(
    true,
  );
}

describe("Excel 黄金样本 /tests/golden", () => {
  it("1. 单线路单路段纯租赁：收入/车辆/固定/能源/轮胎/司机/过路/装卸/信息/财务/VAT/利润", () => {
    const input = excelExampleInput();
    input.routes[0].segments = [input.routes[0].segments[0]];
    const { total } = calculateExcelMonthlyPnl(input);
    const output = calculateScheme(input);
    expectClose(output.monthlyRevenue, total.revenue, "revenue");
    expectClose(total.vehicleCost, output.costBreakdown.find((i) => i.code === "vehicle_cost")!.amount, "vehicle");
    expectClose(total.energyCost, output.costBreakdown.find((i) => i.code === "energy_cost")!.amount, "energy");
    expectClose(total.tireCost, output.costBreakdown.find((i) => i.code === "tire_cost")!.amount, "tire");
    expectClose(total.driverCost, output.costBreakdown.find((i) => i.code === "driver_cost")!.amount, "driver");
    expectClose(total.tollCost, output.costBreakdown.find((i) => i.code === "toll")!.amount, "toll");
    expectClose(total.loadingCost, output.costBreakdown.find((i) => i.code === "loading_unloading")!.amount, "loading");
    expectClose(total.infoCost, output.costBreakdown.find((i) => i.code === "information_fee")!.amount, "info");
    expectClose(output.monthlyFinanceCost, total.advanceCost.plus(total.wcInterest), "finance");
    expectClose(output.monthlyTaxCost, total.vatPayable, "vat");
    expectClose(output.monthlyProfit, total.profit, "profit");
  });

  it("2. 多路段按 (distance × trips) / Σ 分摊，禁止按路段数量平均", () => {
    const { segments, ctx } = calculateExcelMonthlyPnl(excelExampleInput());
    expect(ctx.totalWeight.toString()).toBe("10044");
    expect(segments[0].weight.toString()).toBe("3240");
    expect(segments[1].weight.toString()).toBe("1854");
    expect(segments[2].weight.toString()).toBe("4950");
    const share0 = segments[0].vehicleCost.div(segments.reduce((s, r) => s.plus(r.vehicleCost), new Decimal(0)));
    expectClose(share0, new Decimal(3240).div(10044), "share0", "0.0001");
    expect(segments[0].vehicleCost.eq(segments[1].vehicleCost)).toBe(false);
  });

  it("3. 空载路段 loadTon=0 使用 emptyEnergyConsumption，元/吨收入为 0", () => {
    const input = excelExampleInput();
    input.routes[0].segments = [input.routes[0].segments[0]];
    input.routes[0].segments[0].loadTon = "0";
    input.routes[0].segments[0].freightPriceUnit = "PER_TON";
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
    expect(output.profitMarginReason).toBe("REVENUE_ZERO");
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
  ])("4. 管理费边界 车队 %i → %s", (fleet, fee) => {
    expect(resolveManagementFee(fleet, excelExampleInput().managementFeeTiers).toString()).toBe(fee);
  });

  it("5. 非纯租赁：首付摊销 + 月租", () => {
    const input = excelExampleInput();
    input.leaseType = "HIRE_PURCHASE";
    input.vehicle.leaseType = "HIRE_PURCHASE";
    input.vehicle.downPaymentPerVehicle = "60000";
    input.finance.depreciationMonths = 60;
    const { total, annualizedRent } = calculateExcelMonthlyPnl(input);
    expect(total.vehicleCost.toString()).toBe("35760");
    expect(annualizedRent.toString()).toBe("33360");
    expect(total.vehicleCost.gt(annualizedRent)).toBe(true);
  });

  it("6. 长周期现金流：初始投资、月经营现金流、累计、转正、IRR", () => {
    const input = excelExampleInput();
    input.leaseType = "HIRE_PURCHASE";
    input.vehicle.leaseType = "HIRE_PURCHASE";
    input.vehicle.downPaymentPerVehicle = "60000";
    const v5 = calculateExcelV5(input);
    expect(v5.cashFlows[0].monthIndex).toBe(0);
    expect(v5.cashFlows[0].currentNetCashFlow.lt(0)).toBe(true);
    expect(v5.annualCashFlows[0].currentNetCashFlow.lt(0)).toBe(true);
    expect(v5.cashFlows.some((row) => row.cumulativeCashFlow.gte(0))).toBe(true);
    const irr4 = v5.irrByYears.find((row) => row.years === 4);
    expect(irr4?.irr).not.toBeNull();
    expect(irr4?.reason).toBeNull();
  });

  it("黄金样本月营收/成本/利润/VAT 与 Excel 缓存值误差 <= 0.01 元", () => {
    const { total } = calculateExcelMonthlyPnl(excelExampleInput());
    expectClose(total.revenue, EXCEL_EXAMPLE_AC.revenue, "月营收");
    expectClose(total.totalCost, EXCEL_EXAMPLE_AC.totalCost, "月成本");
    expectClose(total.profit, EXCEL_EXAMPLE_AC.profit, "月利润");
    expectClose(total.vatPayable, EXCEL_EXAMPLE_AC.vatPayable, "VAT");
    const output = calculateScheme(excelExampleInput());
    expect(output.irr).toBeNull();
    expect(output.irrReason).toBe("IRR_NO_SIGN_CHANGE");
    expect(JSON.stringify(output)).not.toMatch(/NaN|Infinity|#DIV\/0!|#NUM!/);
  });

  it("运价单位进入正式引擎：元/趟空载仍有收入", () => {
    const input = excelExampleInput();
    input.routes[0].segments = [input.routes[0].segments[0]];
    input.routes[0].segments[0].loadTon = "0";
    input.routes[0].segments[0].freightPriceUnit = "PER_TRIP";
    input.routes[0].segments[0].freightPrice = "100";
    input.routes[0].segments[0].tripsPerVehicleMonth = "8";
    input.fleetSize = 2;
    const output = calculateScheme(input);
    expect(output.monthlyRevenue.toString()).toBe("1600");
  });

  it("方案级年运营月数覆盖不一致的路段值", () => {
    const input = excelExampleInput();
    input.finance.operatingMonthsYear = 12;
    input.routes[0].segments[0].operatingMonthsYear = "8";
    input.routes[0].segments[1].operatingMonthsYear = "10";
    const a = calculateExcelMonthlyPnl(input);
    input.finance.operatingMonthsYear = 10;
    const b = calculateExcelMonthlyPnl(input);
    expect(a.total.vehicleCost.eq(b.total.vehicleCost)).toBe(false);
  });

  it("司机成本：路段覆盖优先于方案默认，并标明来源", () => {
    const input = excelExampleInput();
    const covered = resolveSegmentDriverPerTrip(input.routes[0].segments[0], input.vehicle);
    const fallback = resolveSegmentDriverPerTrip(input.routes[0].segments[1], { ...input.vehicle, driverCost: "900", driverCostType: "PER_TRIP" });
    expect(covered.source).toBe("SEGMENT_OVERRIDE");
    expect(covered.amount.toString()).toBe("1500");
    expect(fallback.source).toBe("SCHEME_DEFAULT");
    expect(fallback.amount.toString()).toBe("900");
    const output = calculateScheme(input);
    const driverTrace = output.traces.find((t) => t.resultCode === "driver_cost");
    expect(driverTrace?.explanation).toContain("司机成本来源");
  });

  it("不同运价单位禁止平均", () => {
    const input = excelExampleInput();
    input.routes[0].segments[0].freightPriceUnit = "PER_TON";
    input.routes[0].segments[1].freightPriceUnit = "PER_TRIP";
    const summary = summarizeFreightPricing(input);
    expect(summary.mixed).toBe(true);
    expect(summary.label).toBe("多计价口径");
    expect(summary.averagePrice).toBeNull();
  });

  it("敏感性 0% 与 baseline 完全一致，完整重算而非利润乘百分比", () => {
    const input = excelExampleInput();
    const origin = calculateScheme(input);
    for (const variable of ["freight_price", "electricity_price", "trips_per_vehicle_month", "monthly_rent_per_vehicle", "loaded_energy_consumption"] as const) {
      const rows = runSensitivity({
        input,
        variable,
        changeMode: "PERCENT",
        minChange: "-10",
        maxChange: "10",
        step: "5",
      });
      const baseline = rows.find((r) => r.isBaseline);
      expect(baseline?.monthlyProfit).toBe(origin.monthlyProfit.toFixed(2));
      expect(baseline?.monthlyRevenue).toBe(origin.monthlyRevenue.toFixed(2));
      expect(baseline?.monthlyCost).toBe(origin.monthlyTotalCost.toFixed(2));
      expect(baseline?.profitMargin).toBe(origin.profitMargin ? origin.profitMargin.toFixed(4) : null);
    }
  });
});
