import { Decimal, EngineError } from "@/lib/engine/decimal";

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const parsed: unknown = await req.json();
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new EngineError("INVALID_JSON", "body", "请求体不是合法 JSON 对象");
    }
    return parsed as Record<string, unknown>;
  } catch (err) {
    if (err instanceof EngineError) throw err;
    throw new EngineError("INVALID_JSON", "body", "请求体不是合法 JSON");
  }
}

export function assertNonNegative(value: unknown, field: string, label: string) {
  if (value === undefined || value === null || value === "") return;
  try {
    const n = new Decimal(String(value));
    if (!n.isFinite() || n.lt(0)) {
      throw new EngineError("CALC_PARAMETER_INVALID", field, `${label}不得为负`);
    }
  } catch (err) {
    if (err instanceof EngineError) throw err;
    throw new EngineError("CALC_PARAMETER_INVALID", field, `${label}不是合法数字`);
  }
}

export function assertPositiveInt(value: unknown, field: string, label: string) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) {
    throw new EngineError("CALC_PARAMETER_INVALID", field, `${label}必须为正整数`);
  }
}

export function assertVehicleNonNegative(vehicle: Record<string, unknown>) {
  const fields: [string, string][] = [
    ["downPaymentPerVehicle", "单车首付"],
    ["installmentMonths", "分期月份"],
    ["monthlyRentPerVehicle", "单车月租"],
    ["managementFeePerVehicle", "管理费"],
    ["roadMaintenanceFee", "路保费"],
    ["maintenanceFee", "维保费"],
    ["annualInspectionFee", "年审费"],
    ["insuranceFee", "保险费"],
    ["parkingFee", "停车费"],
    ["heaterFee", "柴暖费"],
    ["consumableFee", "消耗费用"],
    ["tireLifeKm", "轮胎寿命"],
    ["tireCount", "轮胎数量"],
    ["tireUnitPrice", "轮胎单价"],
    ["driverCost", "司机成本"],
  ];
  for (const [key, label] of fields) {
    if (key in vehicle) assertNonNegative(vehicle[key], key, label);
  }
}

export function assertFinanceNonNegative(finance: Record<string, unknown>) {
  const fields: [string, string][] = [
    ["receivableCycle", "回款周期"],
    ["workingCapitalLoanCycle", "贷款周期"],
    ["depreciationMonths", "折旧月数"],
    ["projectOperatingMonths", "项目经营月数"],
    ["operatingMonthsYear", "年运营月数"],
    ["workingCapitalInterestRate", "流动资金利率"],
    ["discountRate", "贴现率"],
    ["outputVatRate", "销项税率"],
  ];
  for (const [key, label] of fields) {
    if (key in finance) assertNonNegative(finance[key], key, label);
  }
}

export function assertSegmentNonNegative(segment: Record<string, unknown>) {
  const fields: [string, string][] = [
    ["distanceKm", "里程"],
    ["freightPrice", "运价"],
    ["loadTon", "载重"],
    ["tripsPerVehicleMonth", "月趟数"],
    ["electricityPrice", "电价"],
    ["loadedEnergyConsumption", "满载能耗"],
    ["emptyEnergyConsumption", "空载能耗"],
    ["tollPerTrip", "过路费"],
    ["loadingUnloadingFee", "装卸费"],
    ["informationFee", "信息费"],
    ["driverCostPerTrip", "司机成本"],
    ["operatingMonthsYear", "年运营月数"],
  ];
  for (const [key, label] of fields) {
    if (key in segment) assertNonNegative(segment[key], key, label);
  }
}
