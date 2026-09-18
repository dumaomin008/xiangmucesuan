import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { calculateExcelMonthlyPnl } from "../../../src/lib/engine/excel-v5";
import { calculateScheme } from "../../../src/lib/engine/calculate";
import { settleMonthlyVat } from "../../../src/lib/engine/tax";
import { Decimal } from "../../../src/lib/engine/decimal";
import { formatFirstPositiveMonth } from "../../../src/lib/format";
import { excelExampleInput, EXCEL_EXAMPLE_AC } from "../../../src/lib/engine/__tests__/fixture";
import {
  addRoute,
  addSegment,
  api,
  calculate,
  createExcelGoldenScheme,
  createProject,
  createScheme,
  getCashFlow,
  getResults,
  getScheme,
  putScheme,
} from "../../helpers/http";

function money(v: string | number) {
  return Number(v);
}

test.describe("标准业务场景", () => {
  test("Scenario 01 Excel Golden：Calculator 与 API 对齐 Excel", async ({ request }) => {
    const input = excelExampleInput();
    const { total } = calculateExcelMonthlyPnl(input);
    const calc = calculateScheme(input);
    expect(total.revenue.toNumber()).toBeCloseTo(Number(EXCEL_EXAMPLE_AC.revenue), 1);
    expect(total.vehicleCost.toNumber()).toBeCloseTo(Number(EXCEL_EXAMPLE_AC.vehicleCost), 1);
    expect(total.managementFee.toNumber()).toBeCloseTo(Number(EXCEL_EXAMPLE_AC.managementFee), 1);
    expect(total.maintenanceFee.toNumber()).toBeCloseTo(Number(EXCEL_EXAMPLE_AC.maintenanceFee), 1);
    expect(total.inspectionFee.toNumber()).toBeCloseTo(Number(EXCEL_EXAMPLE_AC.inspectionFee), 1);
    expect(total.insuranceFee.toNumber()).toBeCloseTo(Number(EXCEL_EXAMPLE_AC.insuranceFee), 1);
    expect(total.heaterFee.toNumber()).toBeCloseTo(Number(EXCEL_EXAMPLE_AC.heaterFee), 1);
    expect(total.consumableFee.toNumber()).toBeCloseTo(Number(EXCEL_EXAMPLE_AC.consumableFee), 1);
    expect(total.driverCost.toNumber()).toBeCloseTo(Number(EXCEL_EXAMPLE_AC.driverCost), 1);
    expect(total.tollCost.toNumber()).toBeCloseTo(Number(EXCEL_EXAMPLE_AC.tollCost), 1);
    expect(total.infoCost.toNumber()).toBeCloseTo(Number(EXCEL_EXAMPLE_AC.infoCost), 1);
    expect(total.energyCost.toNumber()).toBeCloseTo(Number(EXCEL_EXAMPLE_AC.energyCost), 2);
    expect(total.tireCost.toNumber()).toBeCloseTo(Number(EXCEL_EXAMPLE_AC.tireCost), 2);
    expect(total.wcInterest.toNumber()).toBeCloseTo(Number(EXCEL_EXAMPLE_AC.wcInterest), 2);
    expect(total.outputVat.toNumber()).toBeCloseTo(Number(EXCEL_EXAMPLE_AC.outputVat), 2);
    expect(total.inputVat.toNumber()).toBeCloseTo(Number(EXCEL_EXAMPLE_AC.inputVat), 2);
    expect(total.vatPayable.toNumber()).toBeCloseTo(Number(EXCEL_EXAMPLE_AC.vatPayable), 2);
    expect(total.totalCost.toNumber()).toBeCloseTo(Number(EXCEL_EXAMPLE_AC.totalCost), 2);
    expect(total.profit.toNumber()).toBeCloseTo(Number(EXCEL_EXAMPLE_AC.profit), 2);
    expect(calc.monthlyRevenue.toNumber()).toBeCloseTo(total.revenue.toNumber(), 2);
    expect(calc.monthlyProfit.toNumber()).toBeCloseTo(total.profit.toNumber(), 2);

    const { scheme } = await createExcelGoldenScheme(request);
    const done = await calculate(request, scheme.id);
    const apiResult = await getResults(request, scheme.id);
    expect(money(apiResult.monthlyRevenue)).toBeCloseTo(Number(EXCEL_EXAMPLE_AC.revenue), 1);
    expect(money(apiResult.monthlyTotalCost)).toBeCloseTo(Number(EXCEL_EXAMPLE_AC.totalCost), 1);
    expect(money(apiResult.monthlyProfit)).toBeCloseTo(Number(EXCEL_EXAMPLE_AC.profit), 1);
    const vatItem = (apiResult.payload as { costBreakdown: { code: string; amount: string }[] }).costBreakdown.find((i) => i.code === "tax_cost");
    expect(money(vatItem!.amount)).toBeCloseTo(Number(EXCEL_EXAMPLE_AC.vatPayable), 1);
    expect(done.result).toBeTruthy();
  });

  test("Scenario 02 纯租赁：initialInvestment=0，展示无需回收初始投资", async ({ request }) => {
    const { scheme } = await createExcelGoldenScheme(request);
    await calculate(request, scheme.id);
    const result = await getResults(request, scheme.id);
    const cf = await getCashFlow(request, scheme.id);
    const month0 = cf.find((r) => r.monthIndex === 0)!;
    expect(money(month0.currentNetCashFlow)).toBeCloseTo(0, 2);
    expect(result.firstPositiveMonth).toBe(0);
    expect(formatFirstPositiveMonth(0)).toBe("无需回收初始投资");
    expect(formatFirstPositiveMonth(0)).not.toBe("首次转正：0期");
  });

  test("Scenario 03 非纯租赁 + 30 个月分期", async ({ request }) => {
    const { scheme } = await createExcelGoldenScheme(request);
    await putScheme(request, scheme.id, {
      leaseType: "HIRE_PURCHASE",
      vehicle: {
        leaseType: "HIRE_PURCHASE",
        downPaymentPerVehicle: "60000",
        installmentMonths: 30,
        monthlyRentPerVehicle: "13900",
      },
      finance: { projectOperatingMonths: 30, operatingMonthsYear: 12, depreciationMonths: 60 },
    });
    await calculate(request, scheme.id);
    const cf = await getCashFlow(request, scheme.id);
    const byMonth = new Map(cf.map((r) => [r.monthIndex, r]));
    const rent = (m: number) => money(byMonth.get(m)!.vehicleCashOut);
    const revenue = (m: number) => money(byMonth.get(m)!.revenueCashIn);
    const yearRent = (year: number) =>
      cf.filter((r) => r.monthIndex >= (year - 1) * 12 + 1 && r.monthIndex <= year * 12).reduce((n, r) => n + money(r.vehicleCashOut), 0);
    expect(rent(1)).toBeGreaterThan(0);
    expect(rent(12)).toBeGreaterThan(0);
    expect(rent(24)).toBeGreaterThan(0);
    expect(rent(30)).toBeGreaterThan(0);
    expect(rent(31)).toBe(0);
    expect(yearRent(1)).toBeCloseTo(rent(1) * 12, 2);
    expect(yearRent(2)).toBeCloseTo(rent(1) * 12, 2);
    expect(yearRent(3)).toBeCloseTo(rent(1) * 6, 2);
    expect(yearRent(4)).toBe(0);
    expect(revenue(1)).toBeGreaterThan(0);
    expect(revenue(30)).toBeGreaterThan(0);
    expect(revenue(31)).toBe(0);
  });

  test("Scenario 04 42 个月项目不得截断到 36，第 5 年无租金", async ({ request }) => {
    const { scheme } = await createExcelGoldenScheme(request);
    await putScheme(request, scheme.id, {
      leaseType: "HIRE_PURCHASE",
      calculationYears: 5,
      vehicle: { leaseType: "HIRE_PURCHASE", downPaymentPerVehicle: "60000", installmentMonths: 42, monthlyRentPerVehicle: "13900" },
      finance: { projectOperatingMonths: 42, operatingMonthsYear: 12, calculationYears: 5, depreciationMonths: 60 },
    });
    await calculate(request, scheme.id);
    const cf = await getCashFlow(request, scheme.id);
    const rent = (m: number) => money(cf.find((r) => r.monthIndex === m)!.vehicleCashOut);
    expect(rent(36)).toBeGreaterThan(0);
    expect(rent(42)).toBeGreaterThan(0);
    expect(rent(43)).toBe(0);
    const year4 = cf.filter((r) => r.monthIndex >= 37 && r.monthIndex <= 48).reduce((n, r) => n + money(r.vehicleCashOut), 0);
    const year5 = cf.filter((r) => r.monthIndex >= 49 && r.monthIndex <= 60).reduce((n, r) => n + money(r.vehicleCashOut), 0);
    expect(year4).toBeCloseTo(rent(42) * 6, 2);
    expect(year5).toBe(0);
  });

  test("Scenario 05 多路段混合运价：多计价口径，收入守恒", async ({ request }) => {
    const project = await createProject(request);
    const scheme = await createScheme(request, project.id, { schemeName: "混合运价", leaseType: "PURE_LEASE", fleetSize: 2 });
    await putScheme(request, scheme.id, {
      leaseType: "PURE_LEASE",
      vehicle: { leaseType: "PURE_LEASE", downPaymentPerVehicle: "0", installmentMonths: 12, monthlyRentPerVehicle: "5000", driverCostType: "PER_VEHICLE_MONTH", driverCost: "0" },
      finance: { operatingMonthsYear: 12, receivableCycle: 0 },
    });
    const route = await addRoute(request, scheme.id, { routeName: "混合" });
    await addSegment(request, route.id, { segmentName: "A", originName: "A1", destinationName: "A2", distanceKm: "100", freightPrice: "80", freightPriceUnit: "PER_TON", loadTon: "20", tripsPerVehicleMonth: "8", loadedEnergyConsumption: "1.2", emptyEnergyConsumption: "0.9", electricityPrice: "0.8" });
    await addSegment(request, route.id, { segmentName: "B", originName: "B1", destinationName: "B2", distanceKm: "80", freightPrice: "900", freightPriceUnit: "PER_TRIP", loadTon: "18", tripsPerVehicleMonth: "6", loadedEnergyConsumption: "1.2", emptyEnergyConsumption: "0.9", electricityPrice: "0.8" });
    await addSegment(request, route.id, { segmentName: "C", originName: "C1", destinationName: "C2", distanceKm: "120", freightPrice: "1.5", freightPriceUnit: "PER_TON_KM", loadTon: "22", tripsPerVehicleMonth: "5", loadedEnergyConsumption: "1.2", emptyEnergyConsumption: "0.9", electricityPrice: "0.8" });
    await calculate(request, scheme.id);
    const result = await getResults(request, scheme.id);
    const payload = result.payload as {
      freightPricing: { mixed: boolean; label: string; averagePrice: string | null };
      routes: { monthlyRevenue: string; segments: { monthlyRevenue: string }[] }[];
    };
    expect(payload.freightPricing.mixed).toBeTruthy();
    expect(payload.freightPricing.label).toBe("多计价口径");
    expect(payload.freightPricing.averagePrice).toBeNull();
    const segSum = payload.routes[0].segments.reduce((n, s) => n + money(s.monthlyRevenue), 0);
    expect(segSum).toBeCloseTo(money(result.monthlyRevenue), 2);
    expect(segSum).toBeCloseTo(money(payload.routes[0].monthlyRevenue), 2);
  });

  test("Scenario 06 亏损项目：负利润、利润率、IRR 原因、无 NaN", async ({ request }) => {
    const { scheme } = await createExcelGoldenScheme(request);
    await putScheme(request, scheme.id, {
      vehicle: { monthlyRentPerVehicle: "80000", electricityPrice: "5" },
    });
    const detail = await getScheme(request, scheme.id);
    const segs = (detail.routes as { id: string; segments: { id: string }[] }[])[0].segments;
    for (const seg of segs) {
      await api(request, `/api/calculation-segments/${seg.id}`, {
        method: "PUT",
        data: { freightPrice: "8", electricityPrice: "5", distanceKm: "360", loadTon: "33", tripsPerVehicleMonth: "9", freightPriceUnit: "PER_TON", originName: "x", destinationName: "y", segmentName: "s", loadedEnergyConsumption: "1.6", emptyEnergyConsumption: "1.1" },
      });
    }
    const done = await calculate(request, scheme.id);
    const result = await getResults(request, scheme.id);
    expect(money(result.monthlyProfit)).toBeLessThan(0);
    expect(result.profitMargin === null || money(result.profitMargin) < 0).toBeTruthy();
    expect(JSON.stringify(result)).not.toMatch(/NaN|Infinity|undefined/);
    expect(JSON.stringify(done)).not.toMatch(/NaN|Infinity/);
    if (!result.irr) {
      expect(result.irrReason).toBeTruthy();
    }
  });

  test("Scenario 07 VAT 留抵：Calculator 两月 Case 与 API 留抵口径", async ({ request }) => {
    const month1 = settleMonthlyVat({
      openingVatCredit: new Decimal(0),
      outputVat: new Decimal(50000),
      inputVat: new Decimal(80000),
      handling: "CARRY_FORWARD",
    });
    expect(month1.vatCashOut.toString()).toBe("0");
    expect(month1.closingVatCredit.toString()).toBe("30000");
    const month2 = settleMonthlyVat({
      openingVatCredit: new Decimal(30000),
      outputVat: new Decimal(70000),
      inputVat: new Decimal(20000),
      handling: "CARRY_FORWARD",
    });
    expect(month2.vatCashOut.toString()).toBe("20000");
    expect(month2.closingVatCredit.toString()).toBe("0");

    const input = excelExampleInput();
    const calc = calculateScheme(input);
    const { scheme } = await createExcelGoldenScheme(request);
    await calculate(request, scheme.id);
    const cf = await getCashFlow(request, scheme.id);
    for (const row of cf) {
      expect(money(row.taxCashOut)).toBeGreaterThanOrEqual(0);
    }
    const apiMonth1 = cf.find((r) => r.monthIndex === 1)!;
    const calcMonth1 = calc.cashFlows.find((r) => r.monthIndex === 1)!;
    expect(money(apiMonth1.taxCashOut)).toBeCloseTo(Number(calcMonth1.taxCashOut.toFixed(2)), 2);
  });

  test("Scenario 08 Snapshot / Copy / Compare / DB 一致性", async ({ request }) => {
    const project = await createProject(request);
    const { scheme: a } = await createExcelGoldenScheme(request, { projectId: project.id, schemeName: "方案A" });
    const a1 = await calculate(request, a.id);
    const snapA1 = String((a1.result as { snapshotId: string }).snapshotId);
    const resultA1 = await getResults(request, a.id);
    await putScheme(request, a.id, { vehicle: { monthlyRentPerVehicle: "18000" } });
    const a2 = await calculate(request, a.id);
    const snapA2 = String((a2.result as { snapshotId: string }).snapshotId);
    const hist = await getResults(request, a.id, snapA1);
    const latest = await getResults(request, a.id);
    expect(snapA1).not.toBe(snapA2);
    expect(hist.monthlyProfit).toBe(resultA1.monthlyProfit);
    expect(latest.monthlyProfit).not.toBe(resultA1.monthlyProfit);

    const b = await api<{ id: string }>(request, `/api/calculation-schemes/${a.id}/copy`, { method: "POST", data: {} });
    const bDetail = await getScheme(request, b.id);
    expect(bDetail.status).toBe("draft");
    expect((bDetail.results as unknown[] | undefined)?.length ?? 0).toBe(0);
    const bRoutes = bDetail.routes as { id: string; segments: { id: string }[] }[];
    const aRoutes = (await getScheme(request, a.id)).routes as { id: string; segments: { id: string }[] }[];
    expect(bRoutes[0].id).not.toBe(aRoutes[0].id);
    expect(bRoutes[0].segments[0].id).not.toBe(aRoutes[0].segments[0].id);
    await putScheme(request, b.id, { vehicle: { monthlyRentPerVehicle: "11000" } });
    const b1 = await calculate(request, b.id);

    const compare = await api<{ schemes: { id: string; monthlyProfit: string }[] }>(request, "/api/calculation-schemes/compare", {
      method: "POST",
      data: { schemeIds: [a.id, b.id] },
    });
    expect(compare.schemes).toHaveLength(2);
    expect(compare.schemes[0].monthlyProfit).not.toBe(compare.schemes[1].monthlyProfit);

    await api(request, `/api/calculation-schemes/${a.id}/set-baseline`, { method: "POST" });
    await api(request, `/api/calculation-schemes/${b.id}/set-baseline`, { method: "POST" });
    const aAfter = await getScheme(request, a.id);
    const bAfter = await getScheme(request, b.id);
    expect(aAfter.status).not.toBe("baseline");
    expect(bAfter.status).toBe("baseline");

    const versions = await api<{ versions: { snapshotId: string }[] }>(request, `/api/calculation-schemes/${a.id}/versions`);
    expect(versions.versions.length).toBeGreaterThanOrEqual(2);

    const prisma = new PrismaClient();
    try {
      const projectRow = await prisma.project.findUnique({ where: { id: project.id } });
      expect(projectRow).toBeTruthy();
      const snapsA = await prisma.parameterSnapshot.findMany({ where: { schemeId: a.id } });
      const snapsB = await prisma.parameterSnapshot.findMany({ where: { schemeId: b.id } });
      const resultsA = await prisma.calculationResult.findMany({ where: { schemeId: a.id } });
      const resultsB = await prisma.calculationResult.findMany({ where: { schemeId: b.id } });
      const versionsA = await prisma.calculationSchemeVersion.findMany({ where: { schemeId: a.id } });
      const cfA = await prisma.cashFlowResult.findMany({ where: { schemeId: a.id } });
      expect(snapsA.length).toBeGreaterThanOrEqual(2);
      expect(snapsA[0].id).not.toBe(snapsA[1].id);
      expect(resultsA.length).toBeGreaterThanOrEqual(2);
      expect(resultsA[0].id).not.toBe(resultsA[1].id);
      expect(snapsB.some((s) => snapsA.some((x) => x.id === s.id))).toBeFalsy();
      expect(resultsB.length).toBeGreaterThanOrEqual(1);
      expect(versionsA.length).toBeGreaterThanOrEqual(2);
      expect(cfA.length).toBeGreaterThan(0);
      expect(b1.result).toBeTruthy();
    } finally {
      await prisma.$disconnect();
    }
  });
});
