import { expect, test } from "@playwright/test";
import { calculateExcelMonthlyPnl } from "../../src/lib/engine/excel-v5";
import { EXCEL_EXAMPLE_AC, excelExampleInput } from "../../src/lib/engine/__tests__/fixture";
import { calculate, createExcelGoldenScheme, getResults, parseUiMoney, putScheme, uid } from "../helpers/http";
import { metricValue } from "./helpers";

test.describe("E2E-05 结果页与 Golden 四层一致性", () => {
  test("结果页 KPI 与 API / Excel 一致", async ({ page, request }) => {
    const { total } = calculateExcelMonthlyPnl(excelExampleInput());
    const { project, scheme } = await createExcelGoldenScheme(request, { schemeName: `E2E Golden ${uid()}` });
    await calculate(request, scheme.id);
    const apiResult = await getResults(request, scheme.id);
    await page.goto(`/projects/${project.id}/calculation/${scheme.id}/results`);
    await expect(page.getByRole("heading", { name: "测算结果" })).toBeVisible();
    const uiRevenue = parseUiMoney(await metricValue(page, "月营收").textContent());
    const uiCost = parseUiMoney(await metricValue(page, "月总成本").textContent());
    const uiProfit = parseUiMoney(await metricValue(page, "月利润").textContent());
    expect(uiRevenue).toBeCloseTo(Number(apiResult.monthlyRevenue), 2);
    expect(uiCost).toBeCloseTo(Number(apiResult.monthlyTotalCost), 2);
    expect(uiProfit).toBeCloseTo(Number(apiResult.monthlyProfit), 2);
    expect(uiRevenue).toBeCloseTo(Number(EXCEL_EXAMPLE_AC.revenue), 2);
    expect(uiCost).toBeCloseTo(Number(EXCEL_EXAMPLE_AC.totalCost), 2);
    expect(uiProfit).toBeCloseTo(Number(EXCEL_EXAMPLE_AC.profit), 2);
    expect(uiRevenue).toBeCloseTo(total.revenue.toNumber(), 2);
    await expect(page.getByRole("heading", { name: "成本结构" })).toBeVisible();
    await expect(page.getByText("路段1")).toBeVisible();
  });
});

test.describe("E2E-06 现金流", () => {
  test("纯租赁显示无需回收初始投资，并有 0 期/月度/年度", async ({ page, request }) => {
    const { project, scheme } = await createExcelGoldenScheme(request, { schemeName: `E2E CF ${uid()}` });
    await calculate(request, scheme.id);
    await page.goto(`/projects/${project.id}/calculation/${scheme.id}/cash-flow`);
    await expect(page.getByRole("heading", { name: "现金流" })).toBeVisible();
    await expect(page.getByText("0期 / 初始投入").first()).toBeVisible();
    await expect(page.getByText("无需回收初始投资")).toBeVisible();
    await expect(page.getByText("首次转正：0期")).toHaveCount(0);
    await expect(page.getByRole("columnheader", { name: "月份" })).toBeVisible();
    await expect(page.getByText("年度现金流（由月度聚合，IRR 用这一套）")).toBeVisible();
    await expect(page.getByText("累计现金流").first()).toBeVisible();
  });
});

test.describe("E2E-07 敏感性", () => {
  test("执行 -10/0/+10，页面有结果且 0% 为基线", async ({ page, request }) => {
    const { project, scheme } = await createExcelGoldenScheme(request, { schemeName: `E2E SEN ${uid()}` });
    await calculate(request, scheme.id);
    const apiResult = await getResults(request, scheme.id);
    await page.goto(`/projects/${project.id}/calculation/${scheme.id}/sensitivity`);
    await page.getByLabel("分析变量").selectOption("freight_price");
    await page.getByLabel("最小变化").fill("-10");
    await page.getByLabel("最大变化").fill("10");
    await page.getByLabel("步长").fill("10");
    await page.getByRole("button", { name: "执行敏感性分析" }).click();
    await expect(page.getByText("参数变化")).toBeVisible();
    const baselineRow = page.locator("table tbody tr").filter({ hasText: "基准" }).first();
    await expect(baselineRow).toBeVisible();
    const revenueText = await baselineRow.locator("td").nth(1).textContent();
    const uiRevenue = parseUiMoney(revenueText);
    expect(uiRevenue).toBeCloseTo(Number(apiResult.monthlyRevenue), 2);
  });
});
