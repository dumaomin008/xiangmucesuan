import { expect, test } from "@playwright/test";
import {
  addRoute,
  addSegment,
  api,
  apiStatus,
  calculate,
  createExcelGoldenScheme,
  createProject,
  createScheme,
  getCashFlow,
  getResults,
  getScheme,
  putScheme,
} from "../../helpers/http";

test.describe("HTTP API · Projects", () => {
  test("POST/GET/PUT 正常路径", async ({ request }) => {
    const created = await createProject(request);
    expect(created.id).toBeTruthy();
    const list = await api<{ id: string }[]>(request, "/api/projects");
    expect(list.some((p) => p.id === created.id)).toBeTruthy();
    const one = await api<{ projectName: string }>(request, `/api/projects/${created.id}`);
    expect(one.projectName).toContain("验收项目");
    const updated = await api<{ projectName: string }>(request, `/api/projects/${created.id}`, {
      method: "PUT",
      data: { projectName: "已更名项目" },
    });
    expect(updated.projectName).toBe("已更名项目");
    const patched = await api<{ customerName: string }>(request, `/api/projects/${created.id}`, {
      method: "PATCH",
      data: { customerName: "补丁客户" },
    });
    expect(patched.customerName).toBe("补丁客户");
  });

  test("缺字段 / 非法 JSON / 不存在 ID", async ({ request }) => {
    const missing = await apiStatus(request, "/api/projects", { method: "POST", data: { projectName: "" } });
    expect(missing.status).toBe(400);
    expect(missing.body.code).toBeTruthy();
    expect(missing.body.message).toBeTruthy();
    expect(missing.status).not.toBe(200);

    const badJson = await request.fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "text/plain", "x-demo-role": "MANAGER", "x-demo-user": "acceptance-bot" },
      data: "this is not json",
    });
    const badBody = await badJson.json();
    expect(badJson.status()).not.toBe(200);
    expect(badJson.status()).toBeGreaterThanOrEqual(400);
    expect(badBody.code).toBe("INVALID_JSON");
    expect(badBody.field).toBe("body");

    const missingId = await apiStatus(request, "/api/projects/does-not-exist");
    expect(missingId.status).toBe(404);
    expect(missingId.body.code).toBe("NOT_FOUND");
  });
});

test.describe("HTTP API · Calculation Schemes", () => {
  test("CRUD / copy / archive / baseline / compare / 仅草稿可删", async ({ request }) => {
    const project = await createProject(request);
    const a = await createScheme(request, project.id, { schemeName: "方案A", leaseType: "PURE_LEASE", fleetSize: 2 });
    expect(a.status).toBe("draft");
    const listed = await api<{ id: string }[]>(request, `/api/projects/${project.id}/calculation-schemes`);
    expect(listed.some((s) => s.id === a.id)).toBeTruthy();
    const detail = await getScheme(request, a.id);
    expect(detail.id).toBe(a.id);

    await putScheme(request, a.id, { schemeName: "方案A-改" });
    const renamed = await getScheme(request, a.id);
    expect(renamed.schemeName).toBe("方案A-改");

    const copied = await api<{ id: string; status: string; schemeName: string }>(request, `/api/calculation-schemes/${a.id}/copy`, {
      method: "POST",
      data: {},
    });
    expect(copied.status).toBe("draft");
    expect(copied.id).not.toBe(a.id);
    expect(copied.schemeName).toContain("副本");

    const delOk = await apiStatus(request, `/api/calculation-schemes/${copied.id}`, { method: "DELETE" });
    expect(delOk.status).toBe(200);

    const { scheme: excel } = await createExcelGoldenScheme(request, { projectId: project.id, schemeName: "可测算A" });
    const calcA = await calculate(request, excel.id);
    expect(calcA.result).toBeTruthy();
    const { scheme: excelB } = await createExcelGoldenScheme(request, { projectId: project.id, schemeName: "可测算B" });
    await putScheme(request, excelB.id, { vehicle: { monthlyRentPerVehicle: "15000" } });
    await calculate(request, excelB.id);

    const baseline = await api<{ status: string }>(request, `/api/calculation-schemes/${excel.id}/set-baseline`, { method: "POST" });
    expect(baseline.status).toBe("baseline");
    const lock = await apiStatus(request, `/api/calculation-schemes/${excel.id}`, {
      method: "PUT",
      data: { schemeName: "不该改" },
    });
    expect(lock.status).toBe(400);

    const second = await api<{ status: string; id: string }>(request, `/api/calculation-schemes/${excelB.id}/set-baseline`, { method: "POST" });
    expect(second.status).toBe("baseline");
    const after = await getScheme(request, excel.id);
    expect(after.status).not.toBe("baseline");

    const archived = await api<{ status: string }>(request, `/api/calculation-schemes/${excel.id}/archive`, { method: "POST" });
    expect(archived.status).toBe("archived");
    const delArchived = await apiStatus(request, `/api/calculation-schemes/${excel.id}`, { method: "DELETE" });
    expect(delArchived.status).toBe(400);
    expect(String(delArchived.body.message)).toContain("草稿");

    const compare = await api<{ schemes: { id: string; monthlyProfit: string | null }[] }>(request, "/api/calculation-schemes/compare", {
      method: "POST",
      data: { schemeIds: [excel.id, excelB.id] },
    });
    expect(compare.schemes).toHaveLength(2);
  });

  test("不存在方案", async ({ request }) => {
    const res = await apiStatus(request, "/api/calculation-schemes/missing-id");
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("NOT_FOUND");
  });
});

test.describe("HTTP API · Routes / Segments", () => {
  test("Create/Update/Delete/Copy/Reorder 与跨方案/负数", async ({ request }) => {
    const project = await createProject(request);
    const scheme = await createScheme(request, project.id);
    const r1 = await addRoute(request, scheme.id, { routeName: "线路一" });
    const r2 = await addRoute(request, scheme.id, { routeName: "线路二" });
    await api(request, `/api/calculation-schemes/${scheme.id}/routes/reorder`, {
      method: "PUT",
      data: { orderedIds: [r2.id, r1.id] },
    });
    const copiedRoute = await api<{ id: string; segments: unknown[] }>(request, `/api/calculation-routes/${r1.id}/copy`, { method: "POST" });
    expect(copiedRoute.id).not.toBe(r1.id);

    const seg = await addSegment(request, r1.id, {
      segmentName: "正路段",
      originName: "A",
      destinationName: "B",
      distanceKm: "100",
      freightPrice: "80",
      freightPriceUnit: "PER_TON",
      loadTon: "20",
      tripsPerVehicleMonth: "8",
    });
    const updated = await api<{ freightPrice: string }>(request, `/api/calculation-segments/${seg.id}`, {
      method: "PUT",
      data: { ...seg, freightPrice: "90", distanceKm: "120", originName: "A", destinationName: "B", segmentName: "正路段", loadTon: "20", tripsPerVehicleMonth: "8", freightPriceUnit: "PER_TON", electricityPrice: "0.8", loadedEnergyConsumption: "1.3", emptyEnergyConsumption: "0.9" },
    });
    expect(updated.freightPrice).toBe("90");

    const copiedSeg = await api<{ id: string }>(request, `/api/calculation-routes/${r1.id}/segments`, {
      method: "POST",
      data: { copyFromId: seg.id },
    });
    expect(copiedSeg.id).not.toBe(seg.id);

    const negative = await apiStatus(request, `/api/calculation-segments/${seg.id}`, {
      method: "PUT",
      data: { freightPrice: "-1" },
    });
    expect(negative.status).toBe(400);
    expect(negative.body.code).toBeTruthy();
    expect(negative.body.field).toBe("freightPrice");

    const other = await createScheme(request, project.id, { schemeName: "另一方案" });
    const otherRoute = await addRoute(request, other.id);
    const cross = await apiStatus(request, `/api/calculation-routes/${otherRoute.id}/segments`, {
      method: "POST",
      data: { copyFromId: seg.id },
    });
    expect(cross.status).toBe(403);

    const missingSeg = await apiStatus(request, `/api/calculation-segments/no-such`, { method: "DELETE" });
    expect(missingSeg.status).toBe(404);

    await api(request, `/api/calculation-segments/${copiedSeg.id}`, { method: "DELETE" });
    await api(request, `/api/calculation-routes/${copiedRoute.id}`, { method: "DELETE" });
  });
});

test.describe("HTTP API · Calculate / Results / CashFlow", () => {
  test("正常测算 + 历史 snapshotId", async ({ request }) => {
    const { scheme } = await createExcelGoldenScheme(request);
    const first = await calculate(request, scheme.id);
    const r1 = await getResults(request, scheme.id);
    expect(Number(r1.monthlyRevenue)).toBeCloseTo(172260, 1);
    const snapshot1 = String(first.result.snapshotId);
    await putScheme(request, scheme.id, { vehicle: { monthlyRentPerVehicle: "16000" } });
    const second = await calculate(request, scheme.id);
    const r2 = await getResults(request, scheme.id);
    const hist = await getResults(request, scheme.id, snapshot1);
    expect(String(second.result.snapshotId)).not.toBe(snapshot1);
    expect(hist.monthlyRevenue).toBe(r1.monthlyRevenue);
    expect(hist.monthlyProfit).toBe(r1.monthlyProfit);
    expect(r2.monthlyProfit).not.toBe(r1.monthlyProfit);

    const cf = await getCashFlow(request, scheme.id);
    expect(cf.some((row) => row.monthIndex === 0)).toBeTruthy();
    expect(cf.some((row) => row.monthIndex === 1)).toBeTruthy();
    const histCf = await getCashFlow(request, scheme.id, snapshot1);
    expect(histCf[0].currentNetCashFlow).not.toBeUndefined();
  });

  test("无启用路段 / 负运价 / 不存在方案 / 重复请求", async ({ request }) => {
    const project = await createProject(request);
    const empty = await createScheme(request, project.id, {
      leaseType: "PURE_LEASE",
      monthlyRentPerVehicle: "6500",
      installmentMonths: 12,
    });
    const noSeg = await apiStatus(request, `/api/calculation-schemes/${empty.id}/calculate`, { method: "POST" });
    expect(noSeg.status).toBe(400);
    expect(noSeg.body.code).toBe("NO_ENABLED_SEGMENT");
    expect(String(noSeg.body.message)).toMatch(/线路|路段/);

    const { scheme } = await createExcelGoldenScheme(request);
    const schemeFull = await getScheme(request, scheme.id);
    const segId = (schemeFull.routes as { segments: { id: string }[] }[])[0].segments[0].id;
    const neg = await apiStatus(request, `/api/calculation-segments/${segId}`, { method: "PUT", data: { freightPrice: "-5" } });
    expect(neg.status).toBe(400);

    const missing = await apiStatus(request, "/api/calculation-schemes/nope/calculate", { method: "POST" });
    expect(missing.status).toBeGreaterThanOrEqual(400);

    const [a, b] = await Promise.all([
      apiStatus(request, `/api/calculation-schemes/${scheme.id}/calculate`, { method: "POST" }),
      apiStatus(request, `/api/calculation-schemes/${scheme.id}/calculate`, { method: "POST" }),
    ]);
    const statuses = [a.status, b.status].sort();
    expect(statuses.some((s) => s === 200 || s === 201)).toBeTruthy();
    expect([a, b].every((row) => row.status === 200 || row.status === 409 || row.status === 400)).toBeTruthy();
    if (a.status === 409 || b.status === 409) {
      expect([a.body.code, b.body.code]).toContain("CALC_IN_PROGRESS");
    }
  });
});

test.describe("HTTP API · Sensitivity", () => {
  test("-10% / 0% / +10%，0% 等于 baseline", async ({ request }) => {
    const { scheme } = await createExcelGoldenScheme(request);
    const calc = await calculate(request, scheme.id);
    const baseline = calc.result as { monthlyRevenue: string; monthlyTotalCost: string; monthlyProfit: string; profitMargin: string | null };
    const task = await api<{ id: string; results: { parameterChange: string; monthlyRevenue: string; monthlyCost: string; monthlyProfit: string; profitMargin: string | null; isBaseline: boolean }[] }>(
      request,
      `/api/calculation-schemes/${scheme.id}/sensitivity`,
      {
        method: "POST",
        data: { variableCode: "freight_price", changeMode: "PERCENT", minChange: "-10", maxChange: "10", step: "10" },
      },
    );
    const fetched = await api<{ results: typeof task.results }>(request, `/api/sensitivity/${task.id}`);
    const zero = fetched.results.find((r) => r.isBaseline || r.parameterChange === "0" || r.parameterChange === "0%");
    expect(zero).toBeTruthy();
    expect(Number(zero!.monthlyRevenue)).toBeCloseTo(Number(baseline.monthlyRevenue), 1);
    expect(Number(zero!.monthlyCost)).toBeCloseTo(Number(baseline.monthlyTotalCost), 1);
    expect(Number(zero!.monthlyProfit)).toBeCloseTo(Number(baseline.monthlyProfit), 1);
    if (baseline.profitMargin) {
      expect(Number(zero!.profitMargin)).toBeCloseTo(Number(baseline.profitMargin), 4);
    }
    expect(fetched.results.some((r) => r.parameterChange.includes("-10") || r.parameterChange === "-10")).toBeTruthy();
    expect(fetched.results.some((r) => r.parameterChange.includes("10") && !r.parameterChange.includes("-10"))).toBeTruthy();
  });
});

test.describe("HTTP API · 错误体", () => {
  test("错误响应含 code/message，且不是 200", async ({ request }) => {
    const res = await apiStatus(request, "/api/calculation-schemes/missing");
    expect(res.status).not.toBe(200);
    expect(res.body.code).toBeTruthy();
    expect(res.body.message).toBeTruthy();
    expect("field" in res.body).toBeTruthy();
  });
});
