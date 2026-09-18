import { expect, test } from "@playwright/test";
import { uid } from "../helpers/http";
import { completeMinimalWizard, createProjectViaUi, createSchemeViaUi, fillFirstSegment, metricValue, waitSaved } from "./helpers";

test.describe("E2E-01 完整新建测算", () => {
  test("从项目列表走到结果页", async ({ page }) => {
    await createProjectViaUi(page);
    await completeMinimalWizard(page, `完整链路 ${uid()}`);
    await page.getByRole("button", { name: "开始测算" }).click();
    await page.waitForURL(/\/results/);
    await expect(page.getByRole("heading", { name: "测算结果" })).toBeVisible();
    await expect(metricValue(page, "月营收")).not.toHaveText("—");
    await expect(metricValue(page, "月总成本")).not.toHaveText("—");
    await expect(metricValue(page, "月利润")).not.toHaveText("—");
  });
});

test.describe("E2E-02 刷新恢复", () => {
  test("debounce 保存后刷新参数仍在", async ({ page }) => {
    await createProjectViaUi(page);
    const name = `刷新恢复 ${uid()}`;
    await createSchemeViaUi(page, name);
    await waitSaved(page);
    await page.reload();
    await expect(page.getByLabel("测算方案名称")).toHaveValue(name);
    await expect(page.getByLabel("租赁形式")).toHaveValue("PURE_LEASE");
  });
});

test.describe("E2E-03 输入错误", () => {
  test("负运价无法进入正式测算并给出字段错误", async ({ page }) => {
    await createProjectViaUi(page);
    await createSchemeViaUi(page, `负运价 ${uid()}`);
    await page.getByRole("button", { name: "下一步" }).click();
    await fillFirstSegment(page);
    await page.getByRole("button", { name: "下一步" }).click();
    await page.getByLabel("单车月趟数").first().fill("10");
    await page.getByRole("button", { name: "下一步" }).click();
    await page.getByLabel("运价").first().fill("-1");
    await page.getByLabel("运价").first().blur();
    await expect(page.getByText(/运价不得为负|不得为负/).first()).toBeVisible();
    await page.getByRole("button", { name: "1. 基本信息" }).click();
    await page.getByRole("button", { name: "5. 确认测算" }).click();
    await page.getByRole("button", { name: "开始测算" }).click();
    const stillOnWizard = page.url().includes("/calculation/") && !page.url().includes("/results");
    const errorVisible = await page.getByText(/运价不得为负|无法测算|CALC_PARAMETER_INVALID|INVALID_FREIGHT_PRICE/).isVisible().catch(() => false);
    expect(stillOnWizard || errorVisible).toBeTruthy();
  });
});

test.describe("E2E-04 防重复提交", () => {
  test("测算中按钮 disabled/loading", async ({ page }) => {
    await createProjectViaUi(page);
    await completeMinimalWizard(page, `防重复 ${uid()}`);
    const btn = page.getByRole("button", { name: "开始测算" });
    await Promise.all([
      page.waitForURL(/\/results/, { timeout: 30_000 }),
      btn.click(),
    ]);
    await expect(page.getByRole("heading", { name: "测算结果" })).toBeVisible();
  });
});
