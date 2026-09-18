import { expect, test } from "@playwright/test";
import { calculate, createExcelGoldenScheme, getResults, parseUiMoney, uid } from "../helpers/http";
import { completeMinimalWizard, createProjectViaUi, createSchemeViaUi, fillFirstSegment, metricValue } from "./helpers";

test.describe("终审 P0 逐步校验", () => {
  test("Step 2 缺卸货地不能进入 Step 3", async ({ page }) => {
    await createProjectViaUi(page);
    await createSchemeViaUi(page, `缺卸货地 ${uid()}`);
    await page.getByRole("button", { name: "下一步" }).click();
    await expect(page.getByText("运输线路")).toBeVisible();
    await page.getByRole("button", { name: "新增线路" }).click();
    await page.getByRole("button", { name: "新增路段" }).click();
    await page.getByLabel("装货地").first().fill("起点仓");
    await page.getByLabel("单程距离").first().fill("180");
    await page.getByLabel("单趟载重").first().fill("30");
    await page.getByRole("button", { name: "下一步" }).click();
    await expect(page.getByText("当前还有")).toBeVisible();
    await expect(page.getByRole("button", { name: /请填写卸货地/ })).toBeVisible();
    await expect(page.getByLabel("卸货地").first()).toBeVisible();
    await expect(page.getByLabel("单车月趟数")).toHaveCount(0);
  });

  test("Step 2 距离为 0 不能进入下一步", async ({ page }) => {
    await createProjectViaUi(page);
    await createSchemeViaUi(page, `距离为0 ${uid()}`);
    await page.getByRole("button", { name: "下一步" }).click();
    await fillFirstSegment(page, { destinationName: "终点仓", distanceKm: "0" });
    await page.getByRole("button", { name: "下一步" }).click();
    await expect(page.getByRole("button", { name: /单程距离必须大于 0/ })).toBeVisible();
  });

  test("Step 3 趟数为 0 不能进入下一步", async ({ page }) => {
    await createProjectViaUi(page);
    await createSchemeViaUi(page, `趟数为0 ${uid()}`);
    await page.getByRole("button", { name: "下一步" }).click();
    await fillFirstSegment(page);
    await page.getByRole("button", { name: "下一步" }).click();
    await page.getByLabel("单车月趟数").first().fill("0");
    await page.getByRole("button", { name: "下一步" }).click();
    await expect(page.getByRole("button", { name: /单车月趟数必须大于 0/ })).toBeVisible();
  });
});

test.describe("终审 P0 路线名称 debounce", () => {
  test("连续输入线路名称不会逐字 PUT + 全量刷新", async ({ page }) => {
    await createProjectViaUi(page);
    await createSchemeViaUi(page, `线路输入 ${uid()}`);
    await page.getByRole("button", { name: "下一步" }).click();
    await page.getByRole("button", { name: "新增线路" }).click();
    await expect(page.getByLabel("线路名称")).toBeVisible();
    let routePuts = 0;
    let schemeGets = 0;
    page.on("request", (req) => {
      if (req.method() === "PUT" && req.url().includes("/api/calculation-routes/")) routePuts += 1;
      if (req.method() === "GET" && /\/api\/calculation-schemes\/[^/]+$/.test(new URL(req.url()).pathname)) schemeGets += 1;
    });
    const name = page.getByLabel("线路名称");
    await name.fill("");
    const beforePuts = routePuts;
    const beforeGets = schemeGets;
    await name.pressSequentially("云南玉溪钢材运输线路", { delay: 30 });
    expect(routePuts - beforePuts).toBeLessThanOrEqual(1);
    expect(schemeGets - beforeGets).toBe(0);
    await expect(name).toHaveValue("云南玉溪钢材运输线路");
    await page.waitForTimeout(900);
    expect(routePuts - beforePuts).toBeGreaterThanOrEqual(1);
    expect(routePuts - beforePuts).toBeLessThanOrEqual(2);
  });
});

test.describe("终审 P0 保存竞争", () => {
  test("修改运价后立即测算使用新值", async ({ page, request }) => {
    await createProjectViaUi(page);
    await completeMinimalWizard(page, `保存竞争 ${uid()}`);
    await page.getByRole("button", { name: "4. 收入与成本" }).click();
    await page.getByLabel("运价").first().fill("999");
    await page.getByRole("button", { name: "下一步" }).click();
    await page.getByRole("button", { name: "开始测算" }).click();
    await page.waitForURL(/\/results/, { timeout: 30_000 });
    const url = page.url();
    const schemeId = url.match(/calculation\/([^/]+)\/results/)?.[1];
    expect(schemeId).toBeTruthy();
    const apiResult = await getResults(request, schemeId!);
    const scheme = await request.get(`/api/calculation-schemes/${schemeId}`);
    const body = await scheme.json();
    expect(body.routes[0].segments[0].freightPrice).toBe("999");
    expect(Number(apiResult.monthlyRevenue)).toBeGreaterThan(0);
  });
});

test.describe("终审 P1 结果页与方案来源", () => {
  test("结果页第一屏是年度决策 KPI，且不称为 AI 测算摘要", async ({ page, request }) => {
    const { project, scheme } = await createExcelGoldenScheme(request, { schemeName: `决策KPI ${uid()}` });
    await calculate(request, scheme.id);
    await page.goto(`/projects/${project.id}/calculation/${scheme.id}/results`);
    await expect(page.getByRole("heading", { name: "决策结果" })).toBeVisible();
    await expect(metricValue(page, "年运输量")).not.toHaveText("—");
    await expect(metricValue(page, "年收入")).not.toHaveText("—");
    await expect(metricValue(page, "年总成本")).not.toHaveText("—");
    await expect(metricValue(page, "年利润")).not.toHaveText("—");
    await expect(page.getByText("系统测算摘要")).toBeVisible();
    await expect(page.getByText("AI 测算摘要")).toHaveCount(0);
    await expect(page.getByText("所有数字来自确定性计算引擎，不是大模型生成。")).toBeVisible();
  });

  test("创建对比方案后显示来源和已调整项", async ({ page, request }) => {
    const { project, scheme } = await createExcelGoldenScheme(request, { schemeName: `来源方案 ${uid()}` });
    await calculate(request, scheme.id);
    await page.goto(`/projects/${project.id}/calculation/${scheme.id}/results`);
    await page.getByRole("button", { name: "创建对比方案" }).click();
    await page.waitForURL(/\/calculation\/.+/);
    await expect(page.getByText(/基于：/)).toBeVisible();
    await expect(page.getByText(/当前已调整/)).toBeVisible();
    await page.getByRole("button", { name: "查看差异" }).click();
    await expect(page.getByText("相对来源方案的参数差异")).toBeVisible();
  });
});

test.describe("终审 P1 命名", () => {
  test("第5步使用智能检查参数而不是 AI 检查", async ({ page }) => {
    await createProjectViaUi(page);
    await completeMinimalWizard(page, `智能检查 ${uid()}`);
    await expect(page.getByRole("button", { name: "智能检查参数" })).toBeVisible();
    await expect(page.getByRole("button", { name: "AI 检查当前步骤" })).toHaveCount(0);
    await expect(page.getByText("测算校验")).toBeVisible();
  });
});
