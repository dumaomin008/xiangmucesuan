import type { APIRequestContext } from "@playwright/test";
import { EXCEL_EXAMPLE_AC, excelExampleInput } from "../../src/lib/engine/__tests__/fixture";

export const EXCEL = EXCEL_EXAMPLE_AC;

export function uid(prefix = "T") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export type Json = Record<string, unknown>;

export async function api<T = Json>(
  request: APIRequestContext,
  path: string,
  options: { method?: string; data?: unknown; raw?: boolean } = {},
): Promise<T> {
  const res = await request.fetch(path, {
    method: options.method || "GET",
    data: options.data === undefined ? undefined : options.data,
    headers: {
      "Content-Type": "application/json",
      "x-demo-role": "MANAGER",
      "x-demo-user": "acceptance-bot",
    },
  });
  const body = await res.json().catch(() => ({}));
  if (options.raw) {
    return { status: res.status(), body } as T;
  }
  if (!res.ok()) {
    const err = new Error(`${res.status()} ${path} ${(body as Json).message || JSON.stringify(body)}`);
    (err as Error & { status?: number; payload?: unknown }).status = res.status();
    (err as Error & { status?: number; payload?: unknown }).payload = body;
    throw err;
  }
  return body as T;
}

export async function apiStatus(request: APIRequestContext, path: string, options: { method?: string; data?: unknown; headers?: Record<string, string> } = {}) {
  const res = await request.fetch(path, {
    method: options.method || "GET",
    data: options.data,
    headers: {
      "Content-Type": "application/json",
      "x-demo-role": "MANAGER",
      "x-demo-user": "acceptance-bot",
      ...(options.headers || {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status(), body: body as Json };
}

export async function createProject(request: APIRequestContext, name?: string) {
  const stamp = uid("PRJ");
  return api<{ id: string; projectCode: string; projectName: string }>(request, "/api/projects", {
    method: "POST",
    data: {
      projectName: name || `验收项目 ${stamp}`,
      projectCode: stamp,
      customerName: "验收客户",
      projectManager: "验收经理",
      projectStatus: "测算中",
    },
  });
}

export async function createScheme(request: APIRequestContext, projectId: string, data: Json = {}) {
  return api<{ id: string; status: string; schemeName: string }>(request, `/api/projects/${projectId}/calculation-schemes`, {
    method: "POST",
    data: {
      schemeName: data.schemeName || `验收方案 ${uid("CS")}`,
      fleetSize: data.fleetSize ?? 2,
      calculationYears: data.calculationYears ?? 5,
      leaseType: data.leaseType || "PURE_LEASE",
      ...data,
    },
  });
}

export async function getScheme(request: APIRequestContext, schemeId: string) {
  return api<Json>(request, `/api/calculation-schemes/${schemeId}`);
}

export async function putScheme(request: APIRequestContext, schemeId: string, patch: Json) {
  const current = await getScheme(request, schemeId);
  const vehicle = { ...((current.vehiclePlan as Json) || {}), ...((patch.vehicle as Json) || {}) };
  const finance = { ...((current.financeTaxPlan as Json) || {}), ...((patch.finance as Json) || {}) };
  return api(request, `/api/calculation-schemes/${schemeId}`, {
    method: "PUT",
    data: {
      schemeName: patch.schemeName ?? current.schemeName,
      description: patch.description ?? current.description,
      leaseType: patch.leaseType ?? current.leaseType,
      fleetSize: patch.fleetSize ?? current.fleetSize,
      calculationYears: patch.calculationYears ?? current.calculationYears,
      vehicle,
      finance,
    },
  });
}

export async function addRoute(request: APIRequestContext, schemeId: string, data: Json = {}) {
  return api<{ id: string }>(request, `/api/calculation-schemes/${schemeId}/routes`, {
    method: "POST",
    data: { routeName: data.routeName || "验收线路", routeCode: data.routeCode || "R01", ...data },
  });
}

export async function addSegment(request: APIRequestContext, routeId: string, data: Json) {
  return api<{ id: string }>(request, `/api/calculation-routes/${routeId}/segments`, {
    method: "POST",
    data,
  });
}

export async function calculate(request: APIRequestContext, schemeId: string) {
  return api<{ result: Json; scheme: Json; warnings: unknown[] }>(request, `/api/calculation-schemes/${schemeId}/calculate`, {
    method: "POST",
  });
}

export async function getResults(request: APIRequestContext, schemeId: string, snapshotId?: string) {
  const qs = snapshotId ? `?snapshotId=${snapshotId}` : "";
  return api<{
    monthlyRevenue: string;
    monthlyTotalCost: string;
    monthlyProfit: string;
    profitMargin: string | null;
    irr: string | null;
    irrReason: string | null;
    firstPositiveMonth: number | null;
    payload: Json;
  }>(request, `/api/calculation-schemes/${schemeId}/results${qs}`);
}

export async function getCashFlow(request: APIRequestContext, schemeId: string, snapshotId?: string) {
  const qs = snapshotId ? `?snapshotId=${snapshotId}` : "";
  return api<CashFlowRow[]>(request, `/api/calculation-schemes/${schemeId}/cash-flow${qs}`);
}

export type CashFlowRow = {
  monthIndex: number;
  revenueCashIn: string;
  operatingCashOut: string;
  vehicleCashOut: string;
  financingCashFlow: string;
  taxCashOut: string;
  currentNetCashFlow: string;
  cumulativeCashFlow: string;
};

const EXCEL_SEGMENTS = [
  { segmentName: "路段1", originName: "路段1起", destinationName: "路段1止", distanceKm: "360", freightPrice: "100", freightPriceUnit: "PER_TON", loadTon: "33", tripsPerVehicleMonth: "9", operatingMonthsYear: "10", tollPerTrip: "1170", loadingUnloadingFee: "0", informationFee: "400", loadedEnergyConsumption: "1.6", emptyEnergyConsumption: "1.1", electricityPrice: "0.79", driverCostPerTrip: "1500" },
  { segmentName: "路段2", originName: "路段2起", destinationName: "路段2止", distanceKm: "206", freightPrice: "80", freightPriceUnit: "PER_TON", loadTon: "33", tripsPerVehicleMonth: "9", operatingMonthsYear: "10", tollPerTrip: "0", loadingUnloadingFee: "0", informationFee: "0", loadedEnergyConsumption: "1.6", emptyEnergyConsumption: "1.1", electricityPrice: "0.79", driverCostPerTrip: "0" },
  { segmentName: "路段3", originName: "路段3起", destinationName: "路段3止", distanceKm: "550", freightPrice: "110", freightPriceUnit: "PER_TON", loadTon: "33", tripsPerVehicleMonth: "9", operatingMonthsYear: "10", tollPerTrip: "0", loadingUnloadingFee: "0", informationFee: "0", loadedEnergyConsumption: "1.6", emptyEnergyConsumption: "1.1", electricityPrice: "0.79", driverCostPerTrip: "0" },
];

export async function createExcelGoldenScheme(request: APIRequestContext, opts?: { projectId?: string; schemeName?: string }) {
  const project = opts?.projectId
    ? { id: opts.projectId }
    : await createProject(request, `Excel Golden ${uid()}`);
  const scheme = await createScheme(request, project.id, {
    schemeName: opts?.schemeName || "Excel V5 示例",
    fleetSize: 2,
    calculationYears: 5,
    leaseType: "PURE_LEASE",
  });
  await putScheme(request, scheme.id, {
    leaseType: "PURE_LEASE",
    fleetSize: 2,
    calculationYears: 5,
    vehicle: {
      fleetSize: 2,
      leaseType: "PURE_LEASE",
      downPaymentPerVehicle: "0",
      installmentMonths: 30,
      monthlyRentPerVehicle: "13900",
      managementFeePerVehicle: "2000",
      roadMaintenanceFee: "0",
      maintenanceFee: (55000 / 12).toString(),
      annualInspectionFee: (4000 / 12).toString(),
      insuranceFee: (30000 / 12).toString(),
      parkingFee: "0",
      heaterFee: (4000 / 12).toString(),
      consumableFee: "200",
      tireLifeKm: "80000",
      tireCount: 22,
      tireUnitPrice: "1100",
      driverCost: "0",
      driverCostType: "PER_TRIP",
    },
    finance: {
      receivableCycle: 0,
      workingCapitalLoanCycle: 1,
      workingCapitalInterestRate: "0.07",
      discountRate: "0.04",
      outputVatRate: "0.09",
      inputVatRule: "STANDARD_DEDUCT",
      calculationYears: 5,
      depreciationMonths: 60,
      operatingMonthsYear: 10,
    },
  });
  const route = await addRoute(request, scheme.id, { routeName: "示例多路段", routeCode: "EXCEL-1" });
  for (const seg of EXCEL_SEGMENTS) {
    await addSegment(request, route.id, seg);
  }
  return { project, scheme, route };
}

export function calculatorExcel() {
  return excelExampleInput();
}

export function closeTo(actual: string | number, expected: string | number, tol = 0.01) {
  const a = Number(actual);
  const e = Number(expected);
  const diff = Math.abs(a - e);
  if (diff > tol) {
    throw new Error(`expected ${e} ± ${tol}, got ${a} (diff ${diff})`);
  }
}

export function parseUiMoney(text: string | null | undefined) {
  if (!text) return NaN;
  const n = Number(text.replace(/[^\d.-]/g, ""));
  return n;
}
