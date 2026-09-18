import { describe, expect, it } from "vitest";
import { calculateScheme } from "@/lib/engine/calculate";
import { excelExampleInput, EXCEL_EXAMPLE_AC } from "@/lib/engine/__tests__/fixture";
import { toPreviewDto } from "../serialize-preview";
import { calcCompleteness } from "@/lib/workspace/completeness";
import type { Scheme } from "@/lib/workspace/types";

describe("UX preview reuses engine", () => {
  it("preview DTO comes from calculateScheme, not hardcoded demo numbers", () => {
    const output = calculateScheme(excelExampleInput());
    const preview = toPreviewDto(output);
    expect(Number(preview.monthlyRevenue)).toBeCloseTo(Number(EXCEL_EXAMPLE_AC.revenue), 2);
    expect(Number(preview.monthlyTotalCost)).toBeCloseTo(Number(EXCEL_EXAMPLE_AC.totalCost), 2);
    expect(Number(preview.monthlyProfit)).toBeCloseTo(Number(EXCEL_EXAMPLE_AC.profit), 2);
    expect(preview.annualRevenue).toBe(output.monthlyRevenue.mul(output.operatingMonthsYear).toFixed(2));
  });
});

describe("completeness uses real scheme fields", () => {
  it("empty scheme is incomplete", () => {
    const scheme = {
      id: "s1",
      projectId: "p1",
      schemeName: "",
      description: null,
      leaseType: "PURE_LEASE",
      fleetSize: 0,
      calculationYears: 5,
      expectedStartDate: null,
      expectedEndDate: null,
      status: "draft",
      versionNo: "V1",
      routes: [],
      vehiclePlan: {},
      financeTaxPlan: { operatingMonthsYear: 12 },
      overrides: [],
    } as Scheme;
    const result = calcCompleteness(scheme, false);
    expect(result.percent).toBeLessThan(100);
    expect(result.missing.length).toBeGreaterThan(0);
  });
});
