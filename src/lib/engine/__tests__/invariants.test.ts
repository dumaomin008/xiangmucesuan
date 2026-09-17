import { describe, expect, it } from "vitest";
import { formatFirstPositiveMonth } from "../../format";
import { Decimal } from "../decimal";
import { calculateScheme } from "../calculate";
import { calculateExcelMonthlyPnl } from "../excel-v5";
import { validateSchemeInput } from "../validate";
import { excelExampleInput, sampleInput } from "./fixture";

function expectClose(actual: Decimal, expected: Decimal, label: string, tol = "0.01") {
  const diff = actual.minus(expected).abs();
  expect(diff.lte(tol), `${label}: ${actual.toString()} vs ${expected.toString()}`).toBe(true);
}

describe("P0-01 核心结果守恒", () => {
  it("方案月收入 = Σ 路段月收入", () => {
    const output = calculateScheme(excelExampleInput());
    const sum = output.routes.flatMap((r) => r.segments).reduce((s, seg) => s.plus(seg.monthlyRevenue), new Decimal(0));
    expectClose(output.monthlyRevenue, sum, "revenue");
  });

  it("方案总成本 = 固定 + 变动 + 财务 + 税费", () => {
    const output = calculateScheme(excelExampleInput());
    expectClose(
      output.monthlyTotalCost,
      output.monthlyFixedCost.plus(output.monthlyVariableCost).plus(output.monthlyFinanceCost).plus(output.monthlyTaxCost),
      "totalCost",
    );
  });

  it("利润 = 收入 - 总成本，收入>0 时利润率 = 利润/收入", () => {
    const output = calculateScheme(excelExampleInput());
    expectClose(output.monthlyProfit, output.monthlyRevenue.minus(output.monthlyTotalCost), "profit");
    expect(output.profitMargin).not.toBeNull();
    expectClose(output.profitMargin!, output.monthlyProfit.div(output.monthlyRevenue), "margin", "0.0001");
  });

  it("路段变动成本含司机成本，Σ 路段分摊 = 方案对应成本", () => {
    const output = calculateScheme(excelExampleInput());
    const segs = output.routes.flatMap((r) => r.segments);
    const driver = segs.reduce((s, seg) => s.plus(seg.driverCost), new Decimal(0));
    const schemeDriver = output.costBreakdown.find((i) => i.code === "driver_cost")!.amount;
    expectClose(driver, schemeDriver, "driver");
    const routeVariable = output.routes.reduce((s, r) => s.plus(r.variableCost), new Decimal(0));
    expectClose(routeVariable, output.monthlyVariableCost, "routeVariable includes driver");
    const allocatedFixed = segs.reduce((s, seg) => s.plus(seg.allocatedFixedCost), new Decimal(0));
    expectClose(allocatedFixed, output.monthlyFixedCost, "allocatedFixed");
  });

  it("输出不含 NaN / Infinity / undefined", () => {
    const output = calculateScheme(excelExampleInput());
    expect(JSON.stringify(output)).not.toMatch(/NaN|Infinity|undefined/);
  });
});

describe("P0-03 路段成本分摊", () => {
  it("1 路段权重为 100%", () => {
    const input = excelExampleInput();
    input.routes[0].segments = [input.routes[0].segments[0]];
    const { segments, ctx } = calculateExcelMonthlyPnl(input);
    expect(segments).toHaveLength(1);
    expect(segments[0].weight.div(ctx.totalWeight).toString()).toBe("1");
  });

  it("2 路段按 distance×trips 分摊，不按路段数平均", () => {
    const input = excelExampleInput();
    input.routes[0].segments = input.routes[0].segments.slice(0, 2);
    const { segments } = calculateExcelMonthlyPnl(input);
    expect(segments[0].vehicleCost.eq(segments[1].vehicleCost)).toBe(false);
    const w0 = new Decimal(360).mul(9);
    const w1 = new Decimal(206).mul(9);
    expectClose(segments[0].vehicleCost.div(segments[0].vehicleCost.plus(segments[1].vehicleCost)), w0.div(w0.plus(w1)), "share", "0.0001");
  });

  it("5 路段仍按里程×趟数权重", () => {
    const input = excelExampleInput();
    const base = input.routes[0].segments[0];
    input.routes[0].segments = [
      { ...base, id: "a", distanceKm: "100", tripsPerVehicleMonth: "10" },
      { ...base, id: "b", distanceKm: "200", tripsPerVehicleMonth: "10" },
      { ...base, id: "c", distanceKm: "300", tripsPerVehicleMonth: "10" },
      { ...base, id: "d", distanceKm: "400", tripsPerVehicleMonth: "10" },
      { ...base, id: "e", distanceKm: "500", tripsPerVehicleMonth: "10" },
    ];
    const { segments, ctx } = calculateExcelMonthlyPnl(input);
    expect(ctx.totalWeight.toString()).toBe("15000");
    expect(segments[0].weight.toString()).toBe("1000");
    expect(segments[4].weight.toString()).toBe("5000");
    expectClose(segments[4].vehicleCost.div(segments[0].vehicleCost), new Decimal(5), "5x", "0.0001");
  });

  it("全部 distance×trips=0 返回 validation/engine error，不平均分摊", () => {
    const input = excelExampleInput();
    for (const seg of input.routes[0].segments) {
      seg.distanceKm = "0";
      seg.tripsPerVehicleMonth = "0";
    }
    const { errors } = validateSchemeInput(input);
    expect(errors.some((e) => e.field.includes("distance") || e.field.includes("trips"))).toBe(true);
    const raw = excelExampleInput();
    for (const seg of raw.routes[0].segments) {
      seg.distanceKm = "10";
      seg.tripsPerVehicleMonth = "0";
    }
    expect(() => calculateExcelMonthlyPnl(raw)).toThrow(/无法按 Excel 口径分摊/);
  });
});

describe("P0-05 Snapshot 冻结", () => {
  it("测算 A → 改运价测算 B → 用 A 快照重算，A 完全不变", () => {
    const inputA = excelExampleInput();
    const snapA = JSON.parse(JSON.stringify(inputA));
    const resultA = calculateScheme(inputA);
    inputA.routes[0].segments[0].freightPrice = "1";
    const resultB = calculateScheme(inputA);
    expect(resultB.monthlyRevenue.eq(resultA.monthlyRevenue)).toBe(false);
    const resultAAgain = calculateScheme(snapA);
    expect(resultAAgain.monthlyRevenue.toFixed(2)).toBe(resultA.monthlyRevenue.toFixed(2));
    expect(resultAAgain.monthlyTotalCost.toFixed(2)).toBe(resultA.monthlyTotalCost.toFixed(2));
    expect(resultAAgain.monthlyProfit.toFixed(2)).toBe(resultA.monthlyProfit.toFixed(2));
    expect(resultAAgain.ruleVersionId).toBe(resultA.ruleVersionId);
    expect(resultAAgain.cashFlows.map((row) => row.currentNetCashFlow.toFixed(2))).toEqual(
      resultA.cashFlows.map((row) => row.currentNetCashFlow.toFixed(2)),
    );
  });
});

describe("P1-01 初始投资为 0 的展示口径", () => {
  it("firstPositiveMonth=0 展示无需回收初始投资，不改数学定义", () => {
    expect(formatFirstPositiveMonth(0)).toBe("无需回收初始投资");
    expect(formatFirstPositiveMonth(18)).toBe("第 18 月");
    expect(formatFirstPositiveMonth(null)).toBe("测算期内未转正");
  });
});

describe("P1-02 输入不得为负", () => {
  it("运价为负被拦截", () => {
    const input = sampleInput();
    input.routes[0].segments[0].freightPrice = "-1";
    const { errors } = validateSchemeInput(input);
    expect(errors.some((e) => e.code === "INVALID_FREIGHT_PRICE")).toBe(true);
  });

  it("电价/月租为负被拦截", () => {
    const a = sampleInput();
    a.routes[0].segments[0].electricityPrice = "-0.1";
    expect(validateSchemeInput(a).errors.some((e) => e.field.includes("electricity"))).toBe(true);
    const b = sampleInput();
    b.vehicle.monthlyRentPerVehicle = "-10";
    expect(validateSchemeInput(b).errors.some((e) => e.field === "monthly_rent_per_vehicle")).toBe(true);
  });

  it("无启用线路返回 NO_ENABLED_SEGMENT", () => {
    const input = sampleInput();
    input.routes[0].enabled = false;
    const { errors } = validateSchemeInput(input);
    expect(errors.some((e) => e.code === "NO_ENABLED_SEGMENT")).toBe(true);
  });
});
