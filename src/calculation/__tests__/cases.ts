import { Decimal } from "@/lib/engine/decimal";
import {
  EXCEL_EXAMPLE_AC,
  excelExampleInput,
  sampleInput,
} from "@/lib/engine/__tests__/fixture";
import type { SchemeCalculationInput } from "@/lib/engine/types";

export type ConsistencyCaseId =
  | "excel_baseline"
  | "backend_sample"
  | "profitable"
  | "loss"
  | "boundary_zero"
  | "high_energy_price"
  | "finance_hire_purchase"
  | "multi_route"
  | "irr_scenario"
  | "sensitivity";

export type ConsistencyCase = {
  id: ConsistencyCaseId;
  name: string;
  input: () => SchemeCalculationInput;
  /** Excel 黄金值（有则比对） */
  excel?: Partial<typeof EXCEL_EXAMPLE_AC>;
  /** 期望利润符号：positive / negative / zero */
  profitSign?: "positive" | "negative" | "zero";
  /** 是否期望可解 IRR */
  expectIrr?: boolean;
  runSensitivity?: boolean;
};

/** 盈利案例：提高运价、降低能耗 */
export function profitableInput(): SchemeCalculationInput {
  const input = excelExampleInput();
  for (const seg of input.routes[0].segments) {
    seg.freightPrice = new Decimal(seg.freightPrice).mul(1.35).toString();
    seg.loadedEnergyConsumption = "1.2";
    seg.electricityPrice = "0.6";
  }
  input.schemeId = "case-profitable";
  input.schemeName = "正常盈利案例";
  return input;
}

/** 亏损案例：降低运价、推高电价与能耗 */
export function lossInput(): SchemeCalculationInput {
  const input = excelExampleInput();
  for (const seg of input.routes[0].segments) {
    seg.freightPrice = new Decimal(seg.freightPrice).mul(0.45).toString();
    seg.loadedEnergyConsumption = "2.8";
    seg.emptyEnergyConsumption = "2.0";
    seg.electricityPrice = "1.8";
    seg.tollPerTrip = "2500";
  }
  input.vehicle.monthlyRentPerVehicle = "18000";
  input.schemeId = "case-loss";
  input.schemeName = "明显亏损案例";
  return input;
}

/** 0 值 / 空载边界 */
export function boundaryZeroInput(): SchemeCalculationInput {
  const input = excelExampleInput();
  input.routes[0].segments = [input.routes[0].segments[0]];
  input.routes[0].segments[0].loadTon = "0";
  input.routes[0].segments[0].freightPriceUnit = "PER_TON";
  input.routes[0].segments[0].freightPrice = "100";
  input.routes[0].segments[0].distanceKm = "100";
  input.routes[0].segments[0].tripsPerVehicleMonth = "8";
  input.routes[0].segments[0].electricityPrice = "1";
  input.routes[0].segments[0].loadedEnergyConsumption = "2";
  input.routes[0].segments[0].emptyEnergyConsumption = "1";
  input.routes[0].segments[0].tollPerTrip = "0";
  input.routes[0].segments[0].loadingUnloadingFee = "0";
  input.routes[0].segments[0].informationFee = "0";
  input.routes[0].segments[0].driverCostPerTrip = "0";
  input.fleetSize = 1;
  input.vehicle.fleetSize = 1;
  input.schemeId = "case-boundary-zero";
  input.schemeName = "空载零收入边界";
  return input;
}

/** 高能耗 / 高电价 */
export function highEnergyPriceInput(): SchemeCalculationInput {
  const input = excelExampleInput();
  for (const seg of input.routes[0].segments) {
    seg.electricityPrice = "2.5";
    seg.loadedEnergyConsumption = "3.5";
    seg.emptyEnergyConsumption = "2.8";
  }
  input.schemeId = "case-high-energy";
  input.schemeName = "高能耗高电价";
  return input;
}

/** 融资 / 非纯租赁 */
export function financeHirePurchaseInput(): SchemeCalculationInput {
  const input = excelExampleInput();
  input.leaseType = "HIRE_PURCHASE";
  input.vehicle.leaseType = "HIRE_PURCHASE";
  input.vehicle.downPaymentPerVehicle = "60000";
  input.finance.depreciationMonths = 60;
  input.schemeId = "case-finance";
  input.schemeName = "融资非纯租赁";
  return input;
}

/** 多线路多路段 */
export function multiRouteInput(): SchemeCalculationInput {
  const base = sampleInput();
  const second = structuredClone(base.routes[0]);
  second.id = "r2";
  second.routeName = "杭州-宁波";
  second.routeCode = "HZ-NB";
  second.sortNo = 2;
  second.weight = 40;
  second.segments = second.segments.map((seg, idx) => ({
    ...seg,
    id: `r2-s${idx + 1}`,
    routeId: "r2",
    distanceKm: "120",
    freightPrice: "180",
    tripsPerVehicleMonth: "12",
  }));
  base.routes.push(second);
  base.schemeId = "case-multi-route";
  base.schemeName = "多线路多路段";
  return base;
}

/** IRR 可解场景：有初始投资外流 + 后续正经营现金流 */
export function irrScenarioInput(): SchemeCalculationInput {
  return financeHirePurchaseInput();
}

export const CONSISTENCY_CASES: ConsistencyCase[] = [
  {
    id: "excel_baseline",
    name: "Excel 基准案例",
    input: () => excelExampleInput(),
    excel: EXCEL_EXAMPLE_AC,
    profitSign: "positive",
  },
  {
    id: "backend_sample",
    name: "后端已有 sample 案例",
    input: () => sampleInput(),
    profitSign: "positive",
  },
  {
    id: "profitable",
    name: "正常盈利案例",
    input: profitableInput,
    profitSign: "positive",
  },
  {
    id: "loss",
    name: "亏损案例",
    input: lossInput,
    profitSign: "negative",
  },
  {
    id: "boundary_zero",
    name: "0 值/空载边界",
    input: boundaryZeroInput,
    profitSign: "negative",
  },
  {
    id: "high_energy_price",
    name: "高能耗/高电价",
    input: highEnergyPriceInput,
  },
  {
    id: "finance_hire_purchase",
    name: "融资场景",
    input: financeHirePurchaseInput,
    expectIrr: true,
  },
  {
    id: "multi_route",
    name: "多线路/多段",
    input: multiRouteInput,
  },
  {
    id: "irr_scenario",
    name: "IRR 场景",
    input: irrScenarioInput,
    expectIrr: true,
  },
  {
    id: "sensitivity",
    name: "敏感性分析",
    input: () => excelExampleInput(),
    runSensitivity: true,
  },
];
