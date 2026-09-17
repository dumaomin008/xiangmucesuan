import { describe, expect, it } from "vitest";
import { Decimal } from "../decimal";
import { newtonRaphsonIrr } from "../investment";

describe("InvestmentCalculator", () => {
  it("常规正负现金流可计算 IRR", () => {
    const flows = [new Decimal(-1000), new Decimal(300), new Decimal(300), new Decimal(300), new Decimal(300)];
    const result = newtonRaphsonIrr(flows);
    expect(result.reason).toBeNull();
    expect(result.irr).not.toBeNull();
    expect(result.irr!.isFinite()).toBe(true);
  });

  it("全为正现金流无法计算，不返回 #NUM!", () => {
    const result = newtonRaphsonIrr([new Decimal(100), new Decimal(100)]);
    expect(result.irr).toBeNull();
    expect(result.reason).toBe("现金流未同时出现正负号，无法计算");
  });

  it("期数不足", () => {
    const result = newtonRaphsonIrr([new Decimal(-1)]);
    expect(result.reason).toBe("现金流期数不足，无法计算");
  });
});
