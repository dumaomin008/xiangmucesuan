import { expect, type Page } from "@playwright/test";
import { uid } from "../helpers/http";

export async function createProjectViaUi(page: Page, name?: string) {
  const projectName = name || `E2E项目 ${uid("UI")}`;
  await page.goto("/");
  await page.getByRole("button", { name: "新建项目" }).first().click();
  await page.getByLabel("项目名称").fill(projectName);
  await page.getByLabel("客户名称").fill("E2E客户");
  await page.getByLabel("项目经理").fill("E2E经理");
  await page.getByRole("button", { name: "创建并进入测算" }).click();
  await page.waitForURL(/\/projects\/.+\/calculation/);
  return projectName;
}

export async function createSchemeViaUi(page: Page, schemeName: string) {
  await page.getByRole("button", { name: "新建测算" }).first().click();
  await page.getByRole("button", { name: "手动创建方案" }).click();
  await expect(page.getByLabel("测算方案名称")).toBeVisible();
  await page.getByLabel("测算方案名称").fill(schemeName);
  await page.getByLabel("租赁形式").selectOption("PURE_LEASE");
}

export async function waitSaved(page: Page) {
  await page.waitForResponse(
    (res) =>
      res.request().method() === "PUT" &&
      /\/api\/(calculation-schemes|calculation-segments)\//.test(res.url()) &&
      res.ok(),
    { timeout: 10_000 },
  );
  await expect(page.getByText("已自动保存")).toBeVisible({ timeout: 5_000 });
}

export async function fillFirstSegment(page: Page, values: Partial<Record<string, string>> = {}) {
  await page.getByRole("button", { name: "新增线路" }).click();
  await page.getByRole("button", { name: "新增路段" }).click();
  const row = page.locator("table tbody tr").first();
  await expect(row).toBeVisible();
  const inputs = row.locator("input");
  const data = {
    segmentName: "主干路段",
    originName: "起点仓",
    destinationName: "终点仓",
    distanceKm: "180",
    freightPrice: "220",
    loadTon: "30",
    trips: "10",
    electricity: "0.82",
    loaded: "1.35",
    empty: "0.95",
    ...values,
  };
  await inputs.nth(0).fill(data.segmentName);
  await inputs.nth(1).fill(data.originName);
  await inputs.nth(2).fill(data.destinationName);
  await inputs.nth(3).fill(data.distanceKm);
  await inputs.nth(4).fill(data.freightPrice);
  await inputs.nth(5).fill(data.loadTon);
  await inputs.nth(6).fill(data.trips);
  await inputs.nth(7).fill(data.electricity);
  await inputs.nth(8).fill(data.loaded);
  await inputs.nth(9).fill(data.empty);
  await inputs.nth(4).blur();
}

export async function completeMinimalWizard(page: Page, schemeName: string) {
  await createSchemeViaUi(page, schemeName);
  await page.getByRole("button", { name: "下一步" }).click();
  await fillFirstSegment(page);
  await page.getByRole("button", { name: "下一步" }).click();
  await page.getByLabel("单车月租").fill("6500");
  await page.getByRole("button", { name: "下一步" }).click();
  await page.getByRole("button", { name: "下一步" }).click();
}

export function metricValue(page: Page, label: string) {
  return page.getByRole("button").filter({ hasText: label }).locator("div").nth(1);
}
