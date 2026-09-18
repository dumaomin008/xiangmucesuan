/**
 * 终审 Demo：浏览器真实 E2E（静态 Demo + LocalStorage + 浏览器引擎）
 * 独立于 Next.js acceptance，不依赖 Prisma。
 */
import { expect, test, type Page } from "@playwright/test";

async function loginAsSales(page: Page) {
  await page.goto("/#/login");
  await page.getByRole("button", { name: /林晨/ }).click();
  await expect(page.locator("h1", { hasText: "项目管理" })).toBeVisible();
}

async function openProjectCalc(page: Page, projectId = "PRJ-DEMO-001") {
  await page.goto(`/#/projects/${projectId}`);
  await expect(page.locator("h1")).toBeVisible();
  await page.getByRole("button", { name: "进入测算" }).click();
  await expect(page.locator("h1", { hasText: "项目测算" })).toBeVisible();
}

test.describe("终审 Demo 主链路", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        const keys = Object.keys(localStorage);
        for (const key of keys) {
          if (key.startsWith("pm.demo.")) localStorage.removeItem(key);
        }
      } catch {
        /* ignore */
      }
    });
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(`pageerror:${err.message}`));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(`console:${msg.text()}`);
    });
    (page as Page & { __demoErrors?: string[] }).__demoErrors = errors;
  });

  test("登录→项目→测算→新建→改参→测算→保存→刷新→复制→对比→AI→返回", async ({ page }) => {
    await loginAsSales(page);
    await openProjectCalc(page);

    await expect(page.getByText("项目自动带入")).toBeVisible();
    await expect(page.getByRole("heading", { name: "方案对比" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "变化率" })).toBeVisible();

    await page.getByRole("button", { name: "新建方案" }).click();
    await expect(page.getByText("演示基准参数").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "开始测算" })).toBeVisible();
    await expect(page.getByText("待确认").first()).toBeVisible();

    const priceBefore = await page.locator("#calc-price").inputValue();
    const nextPrice = String(Number(priceBefore) * 1.15);
    await page.locator("#calc-price").fill(nextPrice);
    await page.locator("#calc-elec").fill("1.2");
    await page.locator("#calc-energy").fill("1.5");
    await page.locator("#calc-distance").fill("50");
    await page.locator("#calc-trips").fill("25");
    await page.locator("#calc-fleet").fill("22");
    await page.locator("#calc-load").fill("32");
    await page.locator("#calc-driver").fill("80");
    await page.locator("#calc-rent").fill("9800");

    await expect(page.getByText("参数已变更，请重新测算").or(page.getByText("演示基准参数待确认"))).toBeVisible();

    await page.getByRole("button", { name: "开始测算" }).click();
    await expect(page.locator(".calc-result-metrics")).toBeVisible();
    await expect(page.getByText("月收入")).toBeVisible();
    await expect(page.getByText("单车月利润")).toBeVisible();
    await expect(page.getByText("最后测算时间")).toBeVisible();
    await expect(page.getByText("已测算").first()).toBeVisible();

    const revenueText = await page.locator(".calc-result-metric", { hasText: "月收入" }).locator(".metric-value").innerText();
    expect(revenueText).not.toMatch(/NaN|Infinity/);

    const scenarioUrl = page.url();

    await page.reload();
    await page.goto(scenarioUrl);
    // 刷新后可能掉登录态；重新登录再进同一方案
    if (await page.locator("#login-form").count()) {
      await loginAsSales(page);
      await page.goto(scenarioUrl);
    }
    await expect(page.locator("#calc-price")).toHaveValue(nextPrice);
    await expect(page.locator(".calc-result-metrics")).toBeVisible();

    await page.getByRole("button", { name: "复制方案" }).click();
    await expect(page.locator("h1")).toContainText("副本");
    await page.locator("#calc-price").fill(String(Number(nextPrice) * 0.9));
    await expect(page.getByText("参数已变更，请重新测算")).toBeVisible();
    await page.getByRole("button", { name: "重新测算并保存" }).click();
    await expect(page.locator(".calc-result-metrics")).toBeVisible();

    await page.getByRole("button", { name: "返回方案列表" }).click();
    await expect(page.getByRole("heading", { name: "方案对比" })).toBeVisible();

    // 打开任一已测算方案看 AI
    await page.getByRole("button", { name: "打开" }).first().click();
    await page.getByRole("button", { name: "本地解读" }).click();
    await expect(page.locator("#calc-ai-body")).toContainText(/本地解读|大模型|AI 暂不可用|测算结果解读|业务诊断/);
    await expect(page.locator(".calc-ai-panel")).toContainText("AI 项目测算助手");
    await page.locator("#calc-ai-open").click();
    await expect(page.locator("#calc-ai-drawer")).toBeVisible();
    await page.locator("#calc-ai-input").fill("这个项目月利润多少？");
    await page.locator("#calc-ai-send").click();
    await expect(page.locator("#calc-ai-chat")).toContainText(/月利润|引擎/);

    await page.locator("#calc-ai-close").click();
    await page.getByRole("button", { name: "返回项目详情" }).click();
    await expect(page.locator("h1")).toContainText("临港");

    const errors = (page as Page & { __demoErrors?: string[] }).__demoErrors || [];
    const blocking = errors.filter(
      (e) =>
        !e.includes("favicon") &&
        !e.includes("404") &&
        !/Failed to load resource.*favicon/i.test(e),
    );
    // AI 未配置时的 503 属于预期降级，不算阻断
    const realBlocking = blocking.filter((e) => !/503|AI_NOT_CONFIGURED|demo-ai/i.test(e));
    expect(realBlocking).toEqual([]);
  });

  test("项目隔离：A 方案不出现在 B", async ({ page }) => {
    await loginAsSales(page);
    await openProjectCalc(page, "PRJ-DEMO-001");
    const names001 = await page.locator(".calc-scenario-panel .object-name").allTextContents();
    expect(names001.some((n) => n.includes("基准"))).toBeTruthy();

    await page.goto("/#/projects/PRJ-DEMO-008/calculation");
    await expect(page.locator("h1", { hasText: "项目测算" })).toBeVisible();
    const names008 = await page.locator(".calc-scenario-panel .object-name").allTextContents();
    expect(names008.every((n) => !n.includes("临港"))).toBeTruthy();
    expect(names008.some((n) => n.includes("基准"))).toBeTruthy();
  });

  test("AI业务助手领导演示链路：诊断→改参确认→创建→加车→对比→敏感性→汇报→刷新仍在", async ({ page }) => {
    await loginAsSales(page);
    await openProjectCalc(page, "PRJ-DEMO-008");
    await page.getByRole("button", { name: "打开" }).first().click();
    await expect(page.locator(".calc-ai-panel")).toContainText("AI 项目测算助手");

    await page.locator("#calc-ai-open").click();
    await expect(page.locator("#calc-ai-drawer")).toBeVisible();

    async function ask(text: string) {
      await page.locator("#calc-ai-input").fill(text);
      await page.locator("#calc-ai-send").click();
      await expect(page.locator("#calc-ai-chat")).toContainText(text.slice(0, 6), { timeout: 15000 });
    }

    await ask("这个项目为什么利润比较低？");
    await expect(page.locator("#calc-ai-chat")).toContainText(/月利润|利润率|引擎|成本/, { timeout: 15000 });

    await ask("如果电价从0.8降到0.65呢？");
    await expect(page.locator("#calc-ai-confirm")).toBeVisible();
    await expect(page.locator("#calc-ai-confirm")).toContainText(/电价|0\.65|确认/);
    await page.locator("#calc-ai-confirm-btn").click();
    await expect(page.locator("#calc-ai-chat")).toContainText(/Calculation Engine|重新测算|引擎/, { timeout: 20000 });
    await expect(page.locator("#app")).not.toHaveText(/NaN|Infinity/);

    await ask("帮我做一个低电价方案");
    await expect(page.locator("#calc-ai-confirm")).toBeVisible();
    await page.locator("#calc-ai-confirm-btn").click();
    await expect(page.locator("#calc-ai-chat")).toContainText(/已创建方案/, { timeout: 20000 });

    await ask("车辆增加10台");
    await expect(page.locator("#calc-ai-confirm")).toBeVisible();
    await page.locator("#calc-ai-confirm-btn").click();
    await expect(page.locator("#calc-ai-chat")).toContainText(/重新测算|Calculation Engine|引擎/, { timeout: 20000 });

    await ask("帮我比较刚才两个方案");
    await expect(page.locator("#calc-ai-chat")).toContainText(/月利润|月收入/, { timeout: 15000 });

    await ask("哪些参数最影响利润？");
    await expect(page.locator("#calc-ai-chat")).toContainText(/敏感|引擎|利润/, { timeout: 20000 });

    await ask("帮我生成一段给领导汇报的结论");
    await expect(page.locator("#calc-ai-chat")).toContainText(/汇报结论|Calculation Engine/, { timeout: 15000 });

    const scenarioUrl = page.url();
    await page.locator("#calc-ai-close").click();
    await page.reload();
    if (await page.locator("#login-form").count()) {
      await loginAsSales(page);
      await page.goto(scenarioUrl);
    }
    await expect(page.locator(".calc-result-metrics")).toBeVisible();
    await expect(page.locator("#app")).not.toHaveText(/NaN|Infinity/);

    await page.getByRole("button", { name: "返回项目详情" }).click();
    await expect(page.locator("h1")).toBeVisible();

    const errors = (page as Page & { __demoErrors?: string[] }).__demoErrors || [];
    const realBlocking = errors.filter(
      (e) =>
        !e.includes("favicon") &&
        !e.includes("404") &&
        !/Failed to load resource.*favicon/i.test(e) &&
        !/503|AI_NOT_CONFIGURED|demo-ai/i.test(e),
    );
    expect(realBlocking).toEqual([]);
  });

  test("异常输入不白屏：空值/负数/非数字", async ({ page }) => {
    await loginAsSales(page);
    await openProjectCalc(page);
    await page.getByRole("button", { name: "打开" }).first().click();
    await page.locator("#calc-price").fill("");
    await page.getByRole("button", { name: "重新测算并保存" }).click();
    await expect(page.locator("body")).not.toBeEmpty();
    await expect(page.locator("#app")).not.toHaveText(/NaN|Infinity/);

    await page.locator("#calc-price").fill("-1");
    await page.getByRole("button", { name: "重新测算并保存" }).click();
    await expect(page.locator("#calc-field-error")).toContainText(/不能为负/);

    await page.locator("#calc-price").evaluate((el: HTMLInputElement) => {
      el.value = "abc";
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await page.getByRole("button", { name: "重新测算并保存" }).click();
    await expect(page.locator("#app")).not.toHaveText(/Infinity/);
    await expect(page.locator("#calc-field-error")).toContainText(/有效数字|不能为空|运价/);
  });

  test("V2 AI导入资料：新建测算→演示资料→解析→冲突/补参确认→引擎测算", async ({ page }) => {
    await loginAsSales(page);
    await page.goto("/#/calculation");
    await expect(page.locator("h1", { hasText: "项目测算中心" })).toBeVisible();
    await expect(page.getByRole("button", { name: /新建测算/ })).toBeVisible();
    await expect(page.locator(".calc-center-metrics")).toContainText("测算项目");
    await expect(page.locator(".calc-center-metrics")).not.toContainText("存储方式");

    await page.locator("#calc-center-ai-import").first().click();
    await expect(page).toHaveURL(/#\/calculation\/import/);
    await expect(page.locator("#calc-import-mode")).toContainText("demo");
    await expect(page.locator(".calc-import-page")).toContainText(/AI 导入|导入资料/);
    await page.locator("#calc-import-demo").click();
    await expect(page.locator("#calc-import-files")).toContainText("项目运输需求");
    await page.locator("#calc-import-parse").click();
    await expect(page.locator("[data-import-review]")).toBeVisible({ timeout: 15000 });
    await expect(page.locator("body")).toContainText(/冲突|缺失|AI推断/);

    // 处理所有冲突
    while ((await page.locator("[data-resolve-conflict]").count()) > 0) {
      const btn = page.locator("[data-resolve-conflict]").first();
      const field = await btn.getAttribute("data-resolve-conflict");
      await page.locator(`input[name="conflict-${field}"]`).first().check();
      await btn.click();
      await expect(page.locator(`[data-resolve-conflict="${field}"]`)).toHaveCount(0, { timeout: 10000 });
    }

    // 确认所有推断
    while ((await page.locator("[data-confirm-infer]").count()) > 0) {
      await page.locator("[data-confirm-infer]").first().click();
      await page.waitForTimeout(200);
    }

    // AI 补参
    await page.locator("#calc-import-ask").fill("月租9800，重载能耗1.45，司机单趟120");
    await page.locator("#calc-import-ask-send").click();
    await expect(page.locator("#calc-import-pending")).toBeVisible();
    await page.locator("#calc-import-apply-sup").click();
    await expect(page.locator("#calc-import-pending")).toBeHidden({ timeout: 10000 }).catch(() => null);

    // 若仍有缺失，逐项手填
    for (const field of ["monthlyRentPerVehicle", "loadedEnergyConsumption", "driverCostPerTrip"]) {
      const save = page.locator(`[data-manual-save="${field}"]`);
      if (await save.count()) {
        const defaults = { monthlyRentPerVehicle: "9800", loadedEnergyConsumption: "1.45", driverCostPerTrip: "120" };
        await page.locator(`[data-manual-field="${field}"]`).fill(defaults[field]);
        await save.click();
      }
    }

    await expect(page.locator("#calc-import-gate")).toContainText(/已就绪|可开始/, { timeout: 10000 });
    await expect(page.locator("#calc-import-start")).toBeEnabled({ timeout: 10000 });
    await page.locator("#calc-import-start").click();
    await expect(page.locator(".calc-result-metrics")).toBeVisible({ timeout: 20000 });
    await expect(page.locator("#app")).not.toHaveText(/NaN|Infinity/);
    await expect(page.locator(".calc-ai-panel")).toContainText("AI 项目测算助手");
  });
});
