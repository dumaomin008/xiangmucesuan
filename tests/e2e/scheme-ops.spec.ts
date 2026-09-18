import { expect, test } from "@playwright/test";
import { calculate, createExcelGoldenScheme, getResults, parseUiMoney, putScheme, uid } from "../helpers/http";
import { metricValue, waitSaved } from "./helpers";

test.describe("E2E-08 方案复制和对比", () => {
  test("复制后改运价再测算，对比结果不同且不串数据", async ({ page, request }) => {
    const { project, scheme } = await createExcelGoldenScheme(request, { schemeName: `原方案 ${uid()}` });
    await calculate(request, scheme.id);
    const a1 = await getResults(request, scheme.id);
    await page.goto(`/projects/${project.id}/calculation`);
    await page.getByRole("button", { name: "复制方案" }).first().click();
    await page.waitForURL(/\/calculation\/.+/);
    await expect(page.getByLabel("测算方案名称")).toBeVisible();
    await page.getByRole("button", { name: "4. 收入与成本" }).click();
    const price = page.getByLabel("运价").first();
    const saved = waitSaved(page);
    await price.fill("60");
    await price.blur();
    await saved;
    await page.getByRole("button", { name: "5. 测算检查" }).click();
    await page.getByRole("button", { name: "开始测算" }).click();
    await page.waitForURL(/\/results/);
    const bProfit = parseUiMoney(await metricValue(page, "月利润").textContent());
    expect(bProfit).not.toBeCloseTo(Number(a1.monthlyProfit), 2);
    await page.goto(`/projects/${project.id}/calculation/compare`);
    await page.locator("button").filter({ hasText: "原方案" }).filter({ hasNotText: "副本" }).click();
    await page.locator("button").filter({ hasText: "副本" }).click();
    await page.getByRole("button", { name: "开始对比" }).click();
    await expect(page.getByRole("cell", { name: "月利润" })).toBeVisible();
    const profitRow = page.locator("tr").filter({ hasText: "月利润" });
    const cells = profitRow.locator("td");
    const left = parseUiMoney(await cells.nth(1).textContent());
    const right = parseUiMoney(await cells.nth(2).textContent());
    expect(left).not.toBe(right);
  });
});

test.describe("E2E-09 基准方案", () => {
  test("后设基准的方案成为唯一基准", async ({ page, request }) => {
    const { project, scheme } = await createExcelGoldenScheme(request, { schemeName: `甲方案 ${uid()}` });
    await calculate(request, scheme.id);
    const { scheme: b } = await createExcelGoldenScheme(request, { projectId: project.id, schemeName: `乙方案 ${uid()}` });
    await putScheme(request, b.id, { vehicle: { monthlyRentPerVehicle: "15000" } });
    await calculate(request, b.id);
    await page.goto(`/projects/${project.id}/calculation`);
    await page.locator("tr").filter({ hasText: "甲方案" }).getByRole("button", { name: "设为基准" }).click();
    await expect(page.locator("tr").filter({ hasText: "甲方案" })).toContainText("基准");
    await page.locator("tr").filter({ hasText: "乙方案" }).getByRole("button", { name: "设为基准" }).click();
    await expect(page.locator("tr").filter({ hasText: "乙方案" })).toContainText("基准");
    await expect(page.locator("tr").filter({ hasText: "甲方案" })).toContainText("已测算");
  });
});

test.describe("E2E-10 历史版本", () => {
  test("打开 A1 结果保持原值且不同于 A2", async ({ page, request }) => {
    const { project, scheme } = await createExcelGoldenScheme(request, { schemeName: `历史版本 ${uid()}` });
    await calculate(request, scheme.id);
    const a1 = await getResults(request, scheme.id);
    await putScheme(request, scheme.id, { vehicle: { monthlyRentPerVehicle: "17000" } });
    await calculate(request, scheme.id);
    const a2 = await getResults(request, scheme.id);
    expect(a1.monthlyProfit).not.toBe(a2.monthlyProfit);
    await page.goto(`/projects/${project.id}/calculation/${scheme.id}/versions`);
    await expect(page.getByRole("heading", { name: "版本记录" })).toBeVisible();
    await page.getByRole("link", { name: "查看该次结果" }).last().click();
    await page.waitForURL(/snapshotId=/);
    const histProfit = parseUiMoney(await metricValue(page, "月利润").textContent());
    expect(histProfit).toBeCloseTo(Number(a1.monthlyProfit), 2);
    expect(histProfit).not.toBeCloseTo(Number(a2.monthlyProfit), 2);
  });
});
