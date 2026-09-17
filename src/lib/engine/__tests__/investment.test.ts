import { describe, expect, it } from "vitest";
import { Decimal } from "../decimal";
import { newtonRaphsonIrr, firstPositiveMonth } from "../investment";

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
    expect(result.reason).toBe("IRR_NO_SIGN_CHANGE");
  });

  it("期数不足", () => {
    const result = newtonRaphsonIrr([new Decimal(-1)]);
    expect(result.reason).toBe("IRR_INSUFFICIENT_PERIODS");
  });

  it("全负现金流无法计算", () => {
    const result = newtonRaphsonIrr([new Decimal(-100), new Decimal(-80), new Decimal(-20)]);
    expect(result.irr).toBeNull();
    expect(result.reason).toBe("IRR_NO_SIGN_CHANGE");
  });

  it("极端现金流仍返回有限值或原因码，不出现 Infinity", () => {
    const result = newtonRaphsonIrr([new Decimal(-1e12), new Decimal(1), new Decimal(1)]);
    if (result.irr) expect(result.irr.isFinite()).toBe(true);
    else expect(result.reason).toMatch(/^IRR_/);
  });

  it("长周期现金流可计算", () => {
    const flows = [new Decimal(-50000), ...Array.from({ length: 24 }, () => new Decimal(3000))];
    const result = newtonRaphsonIrr(flows);
    expect(result.reason).toBeNull();
    expect(result.irr?.isFinite()).toBe(true);
  });

  it("首次转正：Month0=-180万, 每月+10万, Month18累计=0", () => {
    let cumulative = new Decimal(0);
    const rows = [];
    const nets = [new Decimal(-1800000), ...Array.from({ length: 24 }, () => new Decimal(100000))];
    for (let i = 0; i < nets.length; i++) {
      cumulative = cumulative.plus(nets[i]);
      rows.push({ monthIndex: i, cumulativeCashFlow: cumulative });
    }
    expect(rows[17].cumulativeCashFlow.toString()).toBe("-100000");
    expect(rows[18].cumulativeCashFlow.toString()).toBe("0");
    expect(firstPositiveMonth(rows)).toBe(18);
  });
});
