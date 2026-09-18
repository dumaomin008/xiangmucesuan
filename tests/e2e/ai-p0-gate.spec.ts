import { expect, test } from "@playwright/test";
import { api, apiStatus } from "../helpers/http";
import { createProjectViaUi } from "./helpers";

test.describe("E2E AI P0 Gate", () => {
  test("缺运价时前端禁止测算，直接打 API 也不会执行引擎", async ({ page }) => {
    await createProjectViaUi(page);
    await page.getByRole("button", { name: "新建测算" }).first().click();
    await page.getByRole("button", { name: "开始 AI 导入" }).click();
    await page.waitForURL(/\/projects\/.+\/ai\/.+/);

    await page.getByRole("button", { name: "新增" }).click();
    const row = page.locator("table tbody tr").first();
    await expect(row).toBeVisible();
    const inputs = row.locator("input:not([type=checkbox])");
    await inputs.nth(1).fill("昆钢");
    await inputs.nth(1).blur();
    await inputs.nth(2).fill("北城");
    await inputs.nth(2).blur();
    await inputs.nth(3).fill("65");
    await inputs.nth(3).blur();
    await inputs.nth(4).fill("3000");
    await inputs.nth(4).blur();
    await inputs.nth(6).fill("20");
    await inputs.nth(6).blur();
    await row.locator("select").selectOption("PER_TON");
    await page.getByRole("button", { name: "确认全部线路" }).click();
    await expect(page.getByText(/还缺 \d+ 项关键参数/)).toBeVisible();
    await expect(page.locator(".fixed").getByText(/运价/)).toBeVisible();

    const calcButton = page.getByRole("button", { name: "确认并测算" });
    await expect(calcButton).toBeDisabled();

    const workspaceId = page.url().split("/ai/")[1]?.split(/[/?#]/)[0];
    expect(workspaceId).toBeTruthy();
    const projectId = page.url().match(/\/projects\/([^/]+)\//)?.[1];
    expect(projectId).toBeTruthy();

    const schemesBefore = await api<{ id: string }[]>(page.request, `/api/projects/${projectId}/calculation-schemes`);
    const blocked = await apiStatus(page.request, `/api/ai/workspaces/${workspaceId}/confirm`, {
      method: "POST",
      data: { mode: "calculate" },
    });
    expect(blocked.status).toBe(400);
    expect(blocked.body.code).toBe("P0_GATE_BLOCKED");
    expect(String(blocked.body.message)).toMatch(/不会调用测算引擎/);

    const after = await api<{ schemeId: string | null; status: string }>(page.request, `/api/ai/workspaces/${workspaceId}`);
    expect(after.schemeId).toBeNull();
    expect(after.status).not.toBe("calculated");
    const schemesAfter = await api<{ id: string }[]>(page.request, `/api/projects/${projectId}/calculation-schemes`);
    expect(schemesAfter.length).toBe(schemesBefore.length);

    const result = await api<{ result: unknown; schemeId: string | null }>(page.request, `/api/ai/workspaces/${workspaceId}/result`);
    expect(result.result).toBeNull();
    expect(result.schemeId).toBeNull();
    await expect(page).not.toHaveURL(/\/result/);
  });
});
