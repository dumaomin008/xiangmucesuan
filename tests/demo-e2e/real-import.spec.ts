import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { buildTransportXlsx } from "../../src/demo/import/real/sample-docs";

const fixtureDir = path.join(process.cwd(), "tests/demo-e2e/fixtures");

async function loginAsSales(page: Page) {
  await page.goto("/#/login");
  await page.getByRole("button", { name: /林晨/ }).click();
  await expect(page.locator("h1", { hasText: "项目管理" })).toBeVisible();
}

test.beforeAll(async () => {
  mkdirSync(fixtureDir, { recursive: true });
  writeFileSync(path.join(fixtureDir, "transport-requirement.xlsx"), await buildTransportXlsx(30));
});

test.describe("真实资料导入", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        for (const key of Object.keys(localStorage)) {
          if (key.startsWith("pm.demo.")) localStorage.removeItem(key);
        }
      } catch {
        /* ignore */
      }
    });
  });

  test("上传 fixture → 真实来源 → 确认 → 引擎结果刷新仍在", async ({ page }) => {
    await loginAsSales(page);
    await page.goto("/#/calculation/import");
    await expect(page.locator("#calc-import-mode")).toContainText("real");
    await page.locator("#calc-import-file").setInputFiles(path.join(fixtureDir, "transport-requirement.xlsx"));
    await expect(page.locator("#calc-import-files")).toContainText("transport-requirement.xlsx");
    await page.locator("#calc-import-parse").click();
    await expect(page.locator("[data-import-review]")).toBeVisible({ timeout: 20000 });
    await expect(page.locator("[data-param-field='fleetSize']")).toContainText("30");

    page.once("dialog", (dialog) => {
      expect(dialog.message()).toContain("车辆配置");
      expect(dialog.message()).toContain("Sheet:");
      void dialog.accept();
    });
    await page.locator("[data-show-source='fleetSize']").click();

    await page.locator("[data-confirm-infer='operatingMonthsYear']").click();
    await page.locator("[data-accept-default='emptyEnergyConsumption']").click();
    await expect(page.locator("#calc-import-start")).toBeEnabled({ timeout: 10000 });
    await page.locator("#calc-import-start").click();
    await expect(page.locator(".calc-result-metrics")).toBeVisible({ timeout: 20000 });
    await expect(page.locator("#app")).not.toHaveText(/NaN|Infinity/);
    const url = page.url();
    await page.reload();
    if (await page.locator("#login-form").count()) {
      await loginAsSales(page);
      await page.goto(url);
    }
    await expect(page.locator(".calc-result-metrics")).toBeVisible();
    await expect(page.locator("#app")).not.toHaveText(/NaN|Infinity/);
  });

  test("区间和多候选进入确认，不替用户选值", async ({ page }) => {
    const semantic = path.join(fixtureDir, "semantic-confirm.xlsx");
    const { buildSemanticConfirmXlsx } = await import("../../src/demo/import/real/sample-docs");
    writeFileSync(semantic, await buildSemanticConfirmXlsx());
    await loginAsSales(page);
    await page.goto("/#/calculation/import");
    await expect(page.locator("#calc-import-mode")).toContainText("real");
    await page.locator("#calc-import-file").setInputFiles(semantic);
    await page.locator("#calc-import-parse").click();
    await expect(page.locator("[data-param-field='distanceKm']")).toContainText("80~85", { timeout: 20000 });
    await expect(page.locator("[data-param-field='fleetSize']")).toContainText("首批");
    await expect(page.locator("[data-param-field='fleetSize']")).toContainText("35");
    await expect(page.locator("#calc-import-start")).toBeDisabled();
  });

  test("同一文件改名后仍读出相同车辆数", async ({ page }) => {
    const renamed = path.join(fixtureDir, `rename-${Date.now()}.xlsx`);
    writeFileSync(renamed, await buildTransportXlsx(30));
    await loginAsSales(page);
    await page.goto("/#/calculation/import");
    await expect(page.locator("#calc-import-mode")).toContainText("real");
    await page.locator("#calc-import-file").setInputFiles(renamed);
    await page.locator("#calc-import-parse").click();
    await expect(page.locator("[data-param-field='fleetSize']")).toContainText("30", { timeout: 20000 });
    await expect(page.locator("[data-param-field='projectName']")).toContainText("正文解析样例项目Alpha");
  });
});
