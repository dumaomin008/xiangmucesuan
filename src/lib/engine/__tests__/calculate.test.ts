import { describe, expect, it } from "vitest";
import { calculateScheme } from "../calculate";
import { EngineError } from "../decimal";
import { runSensitivity } from "../sensitivity";
import { validateSchemeInput } from "../validate";
import { sampleInput } from "./fixture";

describe("calculateScheme 集成", () => {
  it("正常测算输出收入、五类成本、利润、利润率、现金流和追溯项", () => {
    const output = calculateScheme(sampleInput());
    expect(output.monthlyRevenue.gt(0)).toBe(true);
    expect(output.monthlyFixedCost.gt(0)).toBe(true);
    expect(output.monthlyVariableCost.gt(0)).toBe(true);
    expect(output.monthlyTotalCost.eq(
      output.monthlyFixedCost.plus(output.monthlyVariableCost).plus(output.monthlyFinanceCost).plus(output.monthlyTaxCost),
    )).toBe(true);
    expect(output.monthlyProfit.eq(output.monthlyRevenue.minus(output.monthlyTotalCost))).toBe(true);
    expect(output.profitMargin).not.toBeNull();
    expect(output.cashFlows).toHaveLength(61);
    expect(output.traces.find((t) => t.resultCode === "energy_cost")).toBeTruthy();
    expect(output.costBreakdown.map((c) => c.code)).toEqual(
      expect.arrayContaining(["vehicle_cost", "driver_cost", "energy_cost", "finance_cost", "tax_cost"]),
    );
    expect(JSON.stringify(output)).not.toMatch(/NaN|Infinity|#DIV\/0!|#NUM!/);
  });

  it("负数非法输入被拦截", () => {
    const input = sampleInput();
    input.routes[0].segments[0].loadTon = "-1";
    expect(() => calculateScheme(input)).toThrow(EngineError);
  });

  it("车辆数为 0 被拦截", () => {
    const input = sampleInput();
    input.fleetSize = 0;
    const { errors } = validateSchemeInput(input);
    expect(errors.some((e) => e.field === "fleet_size")).toBe(true);
  });

  it("历史方案结果不随规则库更新而变化：同一快照两次计算结果一致", () => {
    const input = sampleInput();
    const a = calculateScheme(input);
    const b = calculateScheme(JSON.parse(JSON.stringify(input)));
    expect(a.monthlyProfit.toFixed(2)).toBe(b.monthlyProfit.toFixed(2));
    expect(a.monthlyRevenue.toFixed(2)).toBe(b.monthlyRevenue.toFixed(2));
  });

  it("标准参数版本切换会改变新测算，但不改写旧快照", () => {
    const v1 = sampleInput();
    const out1 = calculateScheme(v1);
    const v2 = sampleInput();
    v2.standardParameters = v2.standardParameters.map((p) =>
      p.parameterCode === "STD_LOADED_ENERGY" ? { ...p, value: "2.00", version: "V2" } : p,
    );
    v2.routes[0].segments[0].loadedEnergyConsumption = "2.00";
    const out2 = calculateScheme(v2);
    expect(out1.monthlyProfit.toFixed(2)).not.toBe(out2.monthlyProfit.toFixed(2));
    expect(out1.monthlyProfit.toFixed(2)).toBe(calculateScheme(v1).monthlyProfit.toFixed(2));
  });

  it("敏感性分析对每个情景完整重算", () => {
    const rows = runSensitivity({
      input: sampleInput(),
      variable: "freight_price",
      changeMode: "PERCENT",
      minChange: "-10",
      maxChange: "10",
      step: "5",
    });
    expect(rows.length).toBeGreaterThanOrEqual(5);
    const baseline = rows.find((r) => r.isBaseline);
    expect(baseline).toBeTruthy();
    const down = rows.find((r) => r.parameterChange === "-10");
    expect(Number(down?.monthlyProfit)).not.toBe(Number(baseline?.monthlyProfit));
    expect(baseline?.monthlyProfit).toBe(calculateScheme(sampleInput()).monthlyProfit.toFixed(2));
  });

  it("多路段运价按各自原值百分比变动，0% 情景与原测算一致", () => {
    const input = sampleInput();
    input.routes.push({
      ...input.routes[0],
      id: "r2",
      routeName: "对照线路",
      segments: [{ ...input.routes[0].segments[0], id: "s2", freightPrice: "80" }],
    });
    const origin = calculateScheme(input);
    const rows = runSensitivity({
      input,
      variable: "freight_price",
      changeMode: "PERCENT",
      minChange: "-10",
      maxChange: "10",
      step: "10",
    });
    const baseline = rows.find((r) => r.isBaseline);
    expect(baseline?.monthlyProfit).toBe(origin.monthlyProfit.toFixed(2));
  });
});
