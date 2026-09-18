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
      /\/api\/(calculation-schemes|calculation-segments|calculation-routes|projects)\//.test(res.url()) &&
      res.ok(),
    { timeout: 10_000 },
  );
  await expect(page.getByText("已保存").first()).toBeVisible({ timeout: 5_000 });
}

export async function fillFirstSegment(page: Page, values: Partial<Record<string, string>> = {}) {
  await page.getByRole("button", { name: "新增线路" }).click();
  await page.getByRole("button", { name: "新增路段" }).click();
  const data = {
    originName: "起点仓",
    destinationName: "终点仓",
    distanceKm: "180",
    loadTon: "30",
    ...values,
  };
  await page.getByLabel("装货地").first().fill(data.originName);
  await page.getByLabel("卸货地").first().fill(data.destinationName);
  await page.getByLabel("单程距离").first().fill(data.distanceKm);
  await page.getByLabel("单趟载重").first().fill(data.loadTon);
  if (data.originName) await page.getByLabel("装货地").first().blur();
}

export async function fillOperatingAndCost(page: Page, values: Partial<Record<string, string>> = {}) {
  await page.getByRole("button", { name: "下一步" }).click();
  await page.getByLabel("单车月趟数").first().fill(values.trips || "10");
  await page.getByRole("button", { name: "下一步" }).click();
  await page.getByLabel("运价").first().fill(values.freightPrice || "220");
  await page.getByLabel("电价").first().fill(values.electricity || "0.82");
  await page.getByLabel("满载能耗").first().fill(values.loaded || "1.35");
  await page.getByLabel("空载能耗").first().fill(values.empty || "0.95");
  await page.getByLabel("单车月租").fill(values.monthlyRent || "6500");
  await page.getByLabel("运价").first().blur();
}

export async function completeMinimalWizard(page: Page, schemeName: string) {
  await createSchemeViaUi(page, schemeName);
  await page.getByRole("button", { name: "下一步" }).click();
  await fillFirstSegment(page);
  await fillOperatingAndCost(page);
  await page.getByRole("button", { name: "下一步" }).click();
}

export function metricValue(page: Page, label: string) {
  return page
    .getByRole("button")
    .filter({ has: page.getByText(label, { exact: true }) })
    .locator("div")
    .nth(1);
}
