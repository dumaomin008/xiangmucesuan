/**
 * AI 对话式项目测算中心：领导演示主链路。
 * 数字必须能对上当前浏览器里的 Calculation Engine / 已保存结果。
 */
import { expect, test, type Page } from "@playwright/test";

async function loginAsSales(page: Page) {
  await page.goto("/#/login");
  await page.getByRole("button", { name: /林晨/ }).click();
  await expect(page.locator("h1", { hasText: "项目管理" })).toBeVisible();
}

async function openAiCenter(page: Page) {
  await page.getByRole("button", { name: "项目测算中心" }).click();
  await expect(page.locator("h1", { hasText: "项目测算中心" })).toBeVisible();
  await expect(page.locator("#ai-center")).toBeVisible();
}

async function ask(page: Page, text: string) {
  await page.locator("#ai-input").fill(text);
  await page.locator("#ai-form").evaluate((form) => (form as HTMLFormElement).requestSubmit());
  await expect(page.locator("#ai-send")).toHaveText("发送", { timeout: 20_000 });
  await expect(page.locator(".ai-loading")).toHaveCount(0);
}

async function reloginIfNeeded(page: Page, href?: string) {
  if (await page.locator("#login-form").count()) {
    await loginAsSales(page);
    if (href) await page.goto(href);
    else await openAiCenter(page);
  }
}

test.describe("AI 对话式项目测算中心", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.__AI_CENTER_FAST = true;
      try {
        if (sessionStorage.getItem("pm-e2e-booted") === "1") return;
        sessionStorage.setItem("pm-e2e-booted", "1");
        for (const key of Object.keys(localStorage)) {
          if (key.startsWith("pm.demo.") || key.startsWith("pm_demo") || key.startsWith("pm-ai")) localStorage.removeItem(key);
        }
        sessionStorage.removeItem("pm-calc-center-view");
        sessionStorage.removeItem("pm-ai-active-id");
      } catch {
        /* ignore */
      }
    });
  });

  test("A 进入 AI 项目测算中心", async ({ page }) => {
    await loginAsSales(page);
    await openAiCenter(page);
    await expect(page.locator("#app")).not.toContainText(/NaN|Infinity/);
    await expect(page.locator(".ai-side")).toBeVisible();
    await expect(page.locator("#ai-thread")).toBeVisible();
    await expect(page.locator(".ai-rail")).toBeVisible();
    await expect(page.locator("#ai-input")).toBeEnabled();
    await expect(page.getByRole("button", { name: "传统列表视图" })).toBeVisible();
    await expect(page.locator("[data-ai-service='ready']")).toContainText("AI 服务正常");
    await expect(page.locator("#ai-thread")).toContainText("分析一下最近的测算项目经营情况，并给我关键结论");
  });

  test("B 经营分析数字来自已保存结果", async ({ page }) => {
    let explainCalls = 0;
    await page.route("**/api/demo-ai/explain", async (route) => {
      explainCalls += 1;
      await route.fulfill({ status: 503, contentType: "text/plain", body: "down" });
    });
    await loginAsSales(page);
    await openAiCenter(page);
    await ask(page, "分析一下最近的测算项目经营情况，并给我关键结论");
    const answer = page.locator(".ai-msg").last();
    await expect(answer.locator(".ai-kpis")).toBeVisible();
    await expect(answer.locator(".ai-chart").first()).toBeVisible();
    await expect(answer.locator(".ai-table")).toBeVisible();
    await expect(answer.locator(".ai-conclusion")).toBeVisible();
    await expect(answer).not.toContainText(/NaN|Infinity/);

    const metrics = await page.evaluate(() => {
      const list = window.PmCalc.listScenarios("PRJ-DEMO-001") as Array<{
        results?: { calculatedAt?: string; metrics?: { monthlyRevenue: string; monthlyTotalCost: string; monthlyProfit: string; profitMargin: string | null } };
      }>;
      const scenario = [...list]
        .filter((item) => item.results?.metrics && item.results.calculatedAt)
        .sort((a, b) => String(b.results?.calculatedAt).localeCompare(String(a.results?.calculatedAt)))[0];
      const row = scenario.results!.metrics!;
      return {
        revenue: window.PmCalc.formatMoney(row.monthlyRevenue),
        cost: window.PmCalc.formatMoney(row.monthlyTotalCost),
        profit: window.PmCalc.formatMoney(row.monthlyProfit),
        margin: window.PmCalc.formatPercent(row.profitMargin),
      };
    });
    const row = answer.locator(".ai-table tr", { hasText: "临港" });
    await expect(row.locator("td").nth(1)).toHaveText(metrics.revenue);
    await expect(row.locator("td").nth(2)).toHaveText(metrics.cost);
    await expect(row.locator("td").nth(3)).toHaveText(metrics.profit);
    await expect(row.locator("td").nth(4)).toHaveText(metrics.margin);
    expect(explainCalls).toBe(0);
  });

  test("C 项目对比使用两个项目的引擎结果", async ({ page }) => {
    await loginAsSales(page);
    await openAiCenter(page);
    await ask(page, "对比杭州和临港项目的盈利能力");
    const answer = page.locator(".ai-msg").last();
    await expect(answer).toContainText("杭州");
    await expect(answer).toContainText("临港");
    await expect(answer.locator("th", { hasText: "月收入" })).toBeVisible();
    await expect(answer.locator("th", { hasText: "月成本" })).toBeVisible();
    await expect(answer.locator("th", { hasText: "月利润" })).toBeVisible();
    await expect(answer.locator("th", { hasText: "利润率" })).toBeVisible();
    await expect(answer.locator("th", { hasText: "车辆数" })).toBeVisible();

    const metrics = await page.evaluate(() => {
      const read = (projectId: string) => {
        const list = window.PmCalc.listScenarios(projectId) as Array<{
          results?: { calculatedAt?: string; metrics?: { monthlyRevenue: string; fleetSize?: number } };
        }>;
        const scenario = [...list]
          .filter((item) => item.results?.metrics && item.results.calculatedAt)
          .sort((a, b) => String(b.results?.calculatedAt).localeCompare(String(a.results?.calculatedAt)))[0];
        return {
          revenue: window.PmCalc.formatMoney(scenario.results!.metrics!.monthlyRevenue),
          fleet: scenario.results!.metrics!.fleetSize,
        };
      };
      return { lingang: read("PRJ-DEMO-001"), hangzhou: read("PRJ-DEMO-008") };
    });
    await expect(answer.locator(".ai-table tr", { hasText: "临港" }).locator("td").nth(1)).toHaveText(metrics.lingang.revenue);
    await expect(answer.locator(".ai-table tr", { hasText: "杭州" }).locator("td").nth(1)).toHaveText(metrics.hangzhou.revenue);
    if (metrics.lingang.fleet != null) {
      await expect(answer.locator(".ai-table tr", { hasText: "临港" })).toContainText(String(metrics.lingang.fleet));
    }
    const intent = await lastIntent(page);
    expect(intent).toBe("PROJECT_COMPARE");
  });

  test("D 电价敏感性调用引擎且新利润一致", async ({ page }) => {
    await loginAsSales(page);
    await openAiCenter(page);
    await ask(page, "如果临港项目电价上涨10%，利润会怎么样？");
    expect(await lastIntent(page)).toBe("SENSITIVITY_ANALYSIS");
    const expected = await page.evaluate(() => {
      const list = window.PmCalc.listScenarios("PRJ-DEMO-001") as Array<{
        inputs?: unknown;
        results?: { metrics?: { monthlyProfit: string } };
      }>;
      const scenario = [...list]
        .filter((item) => item.inputs && item.results?.metrics && item.results.calculatedAt)
        .sort((a, b) => String(b.results?.calculatedAt).localeCompare(String(a.results?.calculatedAt)))[0];
      const points = window.PmCalc.runSensitivity({
        input: scenario!.inputs,
        variable: "electricity_price",
        changeMode: "PERCENT",
        minChange: "-20",
        maxChange: "20",
        step: "5",
      }) as Array<{ parameterChange: string | number; monthlyProfit: string }>;
      const hit = points.find((row) => Number(row.parameterChange) === 10);
      return {
        before: window.PmCalc.formatMoney(scenario!.results!.metrics!.monthlyProfit),
        after: window.PmCalc.formatMoney(hit!.monthlyProfit),
      };
    });
    const summary = page.locator("[data-ai-sensitivity]").last();
    await expect(summary).toContainText("原月利润");
    await expect(summary).toContainText("调整后月利润");
    await expect(summary).toContainText("利润变化");
    await expect(summary).toContainText(expected.before);
    await expect(summary).toContainText(expected.after);
    await expect(page.locator("#ai-center")).not.toContainText(/NaN|Infinity/);
  });

  test("E 不支持的空驶率不编造利润", async ({ page }) => {
    await loginAsSales(page);
    await openAiCenter(page);
    await ask(page, "如果临港项目空驶率上涨10%，利润会怎么样？");
    const answer = page.locator(".ai-msg").last();
    await expect(answer).toContainText("暂不支持");
    await expect(answer).toContainText("不会编造");
    await expect(answer.locator(".ai-calc")).toHaveCount(0);
    await expect(answer.locator("[data-ai-sensitivity]")).toHaveCount(0);
    await expect(answer).not.toContainText("调整后月利润");
  });

  test("F 新建测算只给入口，不输出虚构结果", async ({ page }) => {
    await loginAsSales(page);
    await openAiCenter(page);
    await ask(page, "帮我测算一个新的运输项目");
    const answer = page.locator(".ai-msg").last();
    await expect(answer.getByRole("button", { name: "上传资料" })).toBeVisible();
    await expect(answer.getByRole("button", { name: "手动填写关键参数" })).toBeVisible();
    await expect(answer.getByRole("button", { name: "复制已有项目" })).toBeVisible();
    await expect(answer.locator(".ai-kpis")).toHaveCount(0);
    await expect(answer.locator(".ai-calc")).toHaveCount(0);
  });

  test("G 演示资料识别后经确认调用引擎", async ({ page }) => {
    await loginAsSales(page);
    await openAiCenter(page);
    await ask(page, "请用演示资料识别项目参数");
    const answer = page.locator(".ai-msg").last();
    await expect(answer).toContainText("识别");
    await expect(answer.locator(".ai-table")).toBeVisible();
    await expect(answer).toContainText(/待确认|冲突|推断/);
    await expect(answer.getByRole("button", { name: "确认并开始测算" })).toBeVisible();
    await answer.getByRole("button", { name: "修改参数" }).click();
    await expect(page.locator("[data-import-review]")).toBeVisible();
    await expect(page.locator("[data-param-status='CONFLICT'], [data-param-status='NEED_CONFIRMATION']").first()).toBeVisible();
    await expect(page.locator("[data-param-status='MISSING']").first()).toBeVisible();

    const gate = await page.evaluate(() => {
      const api = window.PmCalc.importApi;
      const id = document.querySelector("[data-import-review]")?.getAttribute("data-import-review");
      if (!id) return { ok: false, reasons: ["无会话"] };
      api.resolveConflict(id, "fleetSize", { alternativeIndex: 0 });
      const session = api.getSession(id);
      for (const item of session?.parameters || []) {
        if (item.status === "INFERRED") api.confirmInferred(id, item.field, true);
      }
      api.applySupplement(id, [
        { field: "monthlyRentPerVehicle", value: 9800, label: "单车月租", unit: "元" },
        { field: "loadedEnergyConsumption", value: 1.45, label: "重载能耗", unit: "kWh/km" },
        { field: "driverCostPerTrip", value: 120, label: "司机单趟成本", unit: "元/趟" },
      ]);
      return api.canStart(id);
    });
    expect(gate.ok, JSON.stringify(gate)).toBe(true);

    const reviewUrl = page.url();
    await page.reload();
    await reloginIfNeeded(page, reviewUrl);
    await expect(page.locator("#calc-import-start")).toBeEnabled();
    await page.locator("#calc-import-start").click();
    await expect(page.locator(".calc-result-metrics")).toBeVisible({ timeout: 20_000 });
    await expect(page.locator(".calc-result-metrics")).toContainText("月收入");
    await expect(page.locator("#app")).not.toContainText(/NaN|Infinity/);
    expect(page.url()).toMatch(/\/projects\/.+\/calculation\/.+/);
  });

  test("H DeepSeek 503 降级后仍可继续", async ({ page }) => {
    await page.route("**/api/demo-ai/explain", async (route) => {
      await route.fulfill({ status: 503, contentType: "text/plain", body: "unavailable" });
    });
    await loginAsSales(page);
    await openAiCenter(page);
    await page.evaluate(() => localStorage.setItem("pm-ai-mode", "deepseek"));
    await ask(page, "分析一下最近的测算项目经营情况，并给我关键结论");
    await expect(page.locator("[data-ai-fallback='1']")).toContainText("AI 在线解读暂时不可用，已使用本地分析结果，项目测算不受影响。");
    await expect(page.locator(".ai-kpis").first()).toBeVisible();
    await expect(page.locator("#app")).not.toContainText(/NaN|Infinity/);
    const stillThere = await page.evaluate(() => window.PmCalc.listScenarios("PRJ-DEMO-001").some((item) => item.results?.metrics));
    expect(stillThere).toBe(true);

    await ask(page, "对比杭州和临港项目的盈利能力");
    await expect(page.locator(".ai-msg").last()).toContainText("杭州");
    await page.getByRole("button", { name: "传统列表视图" }).click();
    await expect(page.getByRole("heading", { name: "项目测算列表" })).toBeVisible();
    await page.getByRole("button", { name: "新建测算" }).click();
    await expect(page.getByRole("dialog")).toContainText("新建测算");
  });

  test("I 传统列表不丢项目方案", async ({ page }) => {
    await loginAsSales(page);
    await openAiCenter(page);
    const before = await page.evaluate(() => window.PmCalc.listScenarios().length);
    await page.getByRole("button", { name: "传统列表视图" }).click();
    await expect(page.getByRole("heading", { name: "项目测算列表" })).toBeVisible();
    await expect(page.getByRole("button", { name: "新建测算" })).toBeVisible();
    const after = await page.evaluate(() => window.PmCalc.listScenarios().length);
    expect(after).toBe(before);
    expect(after).toBeGreaterThan(0);
  });

  test("J 刷新后对话和测算结果仍在", async ({ page }) => {
    await loginAsSales(page);
    await openAiCenter(page);
    await ask(page, "对比杭州和临港项目的盈利能力");
    await page.reload();
    await reloginIfNeeded(page);
    await openAiCenter(page);
    await expect(page.locator("#ai-thread")).toContainText("对比杭州和临港项目的盈利能力");
    await expect(page.locator("#app")).not.toContainText(/NaN|Infinity/);
    const kept = await page.evaluate(() => window.PmCalc.listScenarios("PRJ-DEMO-001").some((item) => item.results?.metrics));
    expect(kept).toBe(true);
    await ask(page, "分析一下最近的测算项目经营情况，并给我关键结论");
    await expect(page.locator(".ai-kpis").last()).toBeVisible();
  });

  test("重置演示回到 mock 首屏", async ({ page }) => {
    await loginAsSales(page);
    await openAiCenter(page);
    await page.evaluate(() => {
      localStorage.setItem("pm-ai-mode", "deepseek");
      localStorage.setItem("pm-ai-force-fail", "1");
    });
    await ask(page, "帮我测算一个新的运输项目");
    await page.locator(".ai-more summary").click();
    await page.getByRole("button", { name: "重置演示" }).click();
    await page.getByRole("button", { name: "确认恢复" }).click();
    await expect(page.locator("h1", { hasText: "项目测算中心" })).toBeVisible();
    await expect(page.locator("#ai-thread")).toContainText("分析一下最近的测算项目经营情况，并给我关键结论");
    await expect(page.locator(".ai-kpis").first()).toBeVisible();
    const mode = await page.evaluate(() => ({
      mode: localStorage.getItem("pm-ai-mode"),
      fail: localStorage.getItem("pm-ai-force-fail"),
    }));
    expect(mode.mode).toBe("mock");
    expect(mode.fail).toBeNull();
  });
});

async function lastIntent(page: Page) {
  return page.evaluate(() => {
    const list = JSON.parse(localStorage.getItem("pm-ai-conversations-v1") || "[]") as Array<{
      messages?: Array<{ role?: string; response?: { intent?: string } }>;
    }>;
    const messages = list[0]?.messages || [];
    return [...messages].reverse().find((item) => item.role === "assistant")?.response?.intent || "";
  });
}

declare global {
  interface Window {
    __AI_CENTER_FAST?: boolean;
    PmCalc: {
      listScenarios: (projectId?: string) => Array<{ results?: { metrics?: unknown; calculatedAt?: string }; inputs?: unknown }>;
      formatMoney: (value: unknown) => string;
      formatPercent: (value: unknown) => string;
      runSensitivity: (params: unknown) => unknown;
      importApi: {
        resolveConflict: (id: string, field: string, choice: { alternativeIndex: number }) => unknown;
        getSession: (id: string) => { parameters: Array<{ field: string; status: string }> } | null;
        confirmInferred: (id: string, field: string, accept: boolean) => unknown;
        applySupplement: (id: string, patches: Array<Record<string, unknown>>) => unknown;
        canStart: (id: string) => { ok: boolean; reasons?: string[] };
      };
    };
  }
}
