import { expect, test } from "@playwright/test";
import { api, apiStatus, createProject } from "../../helpers/http";

type Workspace = {
  id: string;
  schemeId: string | null;
  status: string;
  routes: Array<{ id: string }>;
  calculation_request: { ready: boolean; blocking_p0: string[]; blocking?: Array<{ field_code: string; name: string }> };
};

async function createWorkspaceWithoutFreight(request: Parameters<typeof api>[0]) {
  const project = await createProject(request);
  const schemesBefore = await api<{ id: string }[]>(request, `/api/projects/${project.id}/calculation-schemes`);
  const workspace = await api<Workspace>(request, `/api/projects/${project.id}/ai/workspaces`, {
    method: "POST",
    data: { createMode: "AI_IMPORT", title: "P0 Gate 缺运价" },
  });
  const withRoute = await api<Workspace>(request, `/api/ai/workspaces/${workspace.id}/routes`, {
    method: "POST",
    data: { action: "add" },
  });
  const routeId = withRoute.routes[0].id;
  await api(request, `/api/ai/workspaces/${workspace.id}/routes/${routeId}`, {
    method: "PATCH",
    data: {
      origin_name: "昆钢",
      destination_name: "北城",
      distance_km: "65",
      volume_value: "3000",
      volume_unit: "吨/日",
      freight_price_unit: "PER_TON",
      vehicle_count: "20",
    },
  });
  const confirmed = await api<Workspace>(request, `/api/ai/workspaces/${workspace.id}/routes`, {
    method: "POST",
    data: { action: "confirm_all" },
  });
  return { project, workspaceId: workspace.id, schemesBefore, confirmed };
}

test.describe("AI P0 Gate · 禁止正式测算", () => {
  test("缺运价时 API 返回 400，不创建方案、不落测算结果", async ({ request }) => {
    const { project, workspaceId, schemesBefore, confirmed } = await createWorkspaceWithoutFreight(request);
    expect(confirmed.calculation_request.ready).toBe(false);
    expect(confirmed.calculation_request.blocking_p0).toContain("revenue.freight_price");

    const blocked = await apiStatus(request, `/api/ai/workspaces/${workspaceId}/confirm`, {
      method: "POST",
      data: { mode: "calculate" },
    });
    expect(blocked.status).toBe(400);
    expect(blocked.body.code).toBe("P0_GATE_BLOCKED");
    expect(String(blocked.body.message)).toMatch(/运价|关键参数/);
    expect(String(blocked.body.message)).toMatch(/不会调用测算引擎/);

    const after = await api<Workspace>(request, `/api/ai/workspaces/${workspaceId}`);
    expect(after.schemeId).toBeNull();
    expect(after.status).not.toBe("calculated");

    const schemesAfter = await api<{ id: string }[]>(request, `/api/projects/${project.id}/calculation-schemes`);
    expect(schemesAfter.length).toBe(schemesBefore.length);

    const result = await api<{ result: unknown; schemeId: string | null }>(request, `/api/ai/workspaces/${workspaceId}/result`);
    expect(result.result).toBeNull();
    expect(result.schemeId).toBeNull();
  });

  test("缺计价单位时同样阻断，引擎不执行", async ({ request }) => {
    const project = await createProject(request);
    const schemesBefore = await api<{ id: string }[]>(request, `/api/projects/${project.id}/calculation-schemes`);
    const workspace = await api<Workspace>(request, `/api/projects/${project.id}/ai/workspaces`, {
      method: "POST",
      data: { createMode: "AI_IMPORT" },
    });
    const withRoute = await api<Workspace>(request, `/api/ai/workspaces/${workspace.id}/routes`, {
      method: "POST",
      data: { action: "add" },
    });
    await api(request, `/api/ai/workspaces/${workspace.id}/routes/${withRoute.routes[0].id}`, {
      method: "PATCH",
      data: {
        origin_name: "昆钢",
        destination_name: "北城",
        distance_km: "65",
        volume_value: "3000",
        freight_price: "32",
        vehicle_count: "20",
      },
    });
    await api(request, `/api/ai/workspaces/${workspace.id}/routes`, { method: "POST", data: { action: "confirm_all" } });

    const blocked = await apiStatus(request, `/api/ai/workspaces/${workspace.id}/confirm`, {
      method: "POST",
      data: { mode: "calculate" },
    });
    expect(blocked.status).toBe(400);
    expect(blocked.body.code).toBe("P0_GATE_BLOCKED");
    expect(String(blocked.body.message)).toMatch(/计价单位|关键参数/);

    const after = await api<Workspace>(request, `/api/ai/workspaces/${workspace.id}`);
    expect(after.schemeId).toBeNull();
    const schemesAfter = await api<{ id: string }[]>(request, `/api/projects/${project.id}/calculation-schemes`);
    expect(schemesAfter.length).toBe(schemesBefore.length);
  });
});
