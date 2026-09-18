import { VEHICLE_FIELDS, type Issue, type Meta, type Scheme, type Std } from "./types";

export type FieldIssue = {
  field: string;
  message: string;
  step: number;
  current?: string;
};

function filledText(value: unknown) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function asNumber(value: unknown): number | null {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function issue(field: string, message: string, step: number, current?: string): FieldIssue {
  return { field, message, step, current };
}

export function validateStep1(scheme: Scheme): FieldIssue[] {
  const issues: FieldIssue[] = [];
  const project = scheme.project;
  if (project) {
    if (!filledText(project.projectName)) issues.push(issue("project.projectName", "请填写项目名称", 0, project.projectName));
    if (!filledText(project.customerName)) issues.push(issue("project.customerName", "请填写客户名称", 0, project.customerName));
    if (!filledText(project.projectManager)) issues.push(issue("project.projectManager", "请填写项目经理", 0, project.projectManager));
  }
  if (!filledText(scheme.schemeName)) issues.push(issue("schemeName", "请填写测算方案名称", 0, scheme.schemeName));
  if (!filledText(scheme.leaseType)) issues.push(issue("leaseType", "请选择租赁形式", 0, scheme.leaseType));
  const years = asNumber(scheme.calculationYears);
  if (years === null || years <= 0) {
    issues.push(issue("calculationYears", "测算年限必须大于 0", 0, String(scheme.calculationYears ?? "")));
  }
  const months = asNumber(scheme.financeTaxPlan.operatingMonthsYear ?? 12);
  if (months === null || months < 1 || months > 12) {
    issues.push(issue("operatingMonthsYear", "年运营月数必须在 1～12 之间", 0, String(scheme.financeTaxPlan.operatingMonthsYear ?? "")));
  }
  return issues;
}

export function validateStep2(scheme: Scheme): FieldIssue[] {
  const issues: FieldIssue[] = [];
  const routes = scheme.routes || [];
  if (routes.length === 0) {
    issues.push(issue("routes", "请至少新增 1 条运输线路", 1));
    return issues;
  }
  for (const route of routes) {
    if (!route.segments.length) {
      issues.push(issue(`route.${route.id}.segments`, `线路「${route.routeName || "未命名"}」至少需要 1 个路段`, 1));
    }
    for (const seg of route.segments) {
      const label = seg.segmentName || "路段";
      if (!filledText(seg.originName)) {
        issues.push(issue(`segment.${seg.id}.originName`, `${label}：请填写装货地`, 1, seg.originName));
      }
      if (!filledText(seg.destinationName)) {
        issues.push(issue(`segment.${seg.id}.destinationName`, `${label}：请填写卸货地`, 1, seg.destinationName));
      }
      const distance = asNumber(seg.distanceKm);
      if (distance === null || distance <= 0) {
        issues.push(issue(`segment.${seg.id}.distanceKm`, `${label}：单程距离必须大于 0`, 1, seg.distanceKm));
      }
      if (!filledText(seg.loadTon)) {
        issues.push(issue(`segment.${seg.id}.loadTon`, `${label}：请填写单趟载重`, 1, seg.loadTon));
      } else {
        const load = asNumber(seg.loadTon);
        if (load === null || load < 0) {
          issues.push(issue(`segment.${seg.id}.loadTon`, `${label}：单趟载重不得为负（空驶可填 0）`, 1, seg.loadTon));
        }
      }
    }
  }
  return issues;
}

export function validateStep3(scheme: Scheme): FieldIssue[] {
  const issues: FieldIssue[] = [];
  const fleet = asNumber(scheme.fleetSize);
  if (fleet === null || fleet <= 0) {
    issues.push(issue("fleetSize", "车队规模必须大于 0", 2, String(scheme.fleetSize ?? "")));
  }
  const months = asNumber(scheme.financeTaxPlan.operatingMonthsYear ?? 12);
  if (months === null || months < 1 || months > 12) {
    issues.push(issue("operatingMonthsYear", "年运营月数必须在 1～12 之间", 2, String(scheme.financeTaxPlan.operatingMonthsYear ?? "")));
  }
  const segments = scheme.routes.flatMap((route) => route.segments);
  if (segments.length === 0) {
    issues.push(issue("routes", "请先在运输场景中新增线路和路段", 1));
  }
  for (const seg of segments) {
    const label = seg.segmentName || "路段";
    const trips = asNumber(seg.tripsPerVehicleMonth);
    if (trips === null || trips <= 0) {
      issues.push(issue(`segment.${seg.id}.tripsPerVehicleMonth`, `${label}：单车月趟数必须大于 0`, 2, seg.tripsPerVehicleMonth));
    }
  }
  return issues;
}

export function validateStep4(scheme: Scheme, meta: Meta | null, std: Std[], reasons: Record<string, string>): FieldIssue[] {
  const issues: FieldIssue[] = [];
  const lease = meta?.leaseTypes.find((item) => item.code === scheme.leaseType);
  const segments = scheme.routes.flatMap((route) => route.segments);

  for (const seg of segments) {
    const label = seg.segmentName || "路段";
    if (!filledText(seg.freightPrice)) {
      issues.push(issue(`segment.${seg.id}.freightPrice`, `${label}：请填写运价`, 3, seg.freightPrice));
    } else {
      const price = asNumber(seg.freightPrice);
      if (price === null) issues.push(issue(`segment.${seg.id}.freightPrice`, `${label}：运价必须是数字`, 3, seg.freightPrice));
      else if (price < 0) issues.push(issue(`segment.${seg.id}.freightPrice`, `${label}：运价不得为负`, 3, seg.freightPrice));
    }
    if (!filledText(seg.freightPriceUnit)) {
      issues.push(issue(`segment.${seg.id}.freightPriceUnit`, `${label}：请选择运价单位`, 3, seg.freightPriceUnit));
    }
    if (!filledText(seg.electricityPrice)) {
      issues.push(issue(`segment.${seg.id}.electricityPrice`, `${label}：请填写电价`, 3, seg.electricityPrice));
    } else {
      const electricity = asNumber(seg.electricityPrice);
      if (electricity === null || electricity < 0) {
        issues.push(issue(`segment.${seg.id}.electricityPrice`, `${label}：电价不得为负`, 3, seg.electricityPrice));
      }
    }
    if (!filledText(seg.loadedEnergyConsumption)) {
      issues.push(issue(`segment.${seg.id}.loadedEnergyConsumption`, `${label}：请填写满载能耗`, 3, seg.loadedEnergyConsumption));
    } else {
      const energy = asNumber(seg.loadedEnergyConsumption);
      if (energy === null || energy < 0) {
        issues.push(issue(`segment.${seg.id}.loadedEnergyConsumption`, `${label}：满载能耗不得为负`, 3, seg.loadedEnergyConsumption));
      }
    }
    if (!filledText(seg.emptyEnergyConsumption)) {
      issues.push(issue(`segment.${seg.id}.emptyEnergyConsumption`, `${label}：请填写空载能耗`, 3, seg.emptyEnergyConsumption));
    } else {
      const energy = asNumber(seg.emptyEnergyConsumption);
      if (energy === null || energy < 0) {
        issues.push(issue(`segment.${seg.id}.emptyEnergyConsumption`, `${label}：空载能耗不得为负`, 3, seg.emptyEnergyConsumption));
      }
    }
  }

  if (lease?.downPaymentRequired) {
    const v = asNumber(scheme.vehiclePlan.downPaymentPerVehicle);
    if (v === null || v <= 0) {
      issues.push(issue("downPaymentPerVehicle", "当前租赁形式要求填写单车首付", 3, String(scheme.vehiclePlan.downPaymentPerVehicle ?? "")));
    }
  }
  if (lease?.installmentRequired) {
    const v = asNumber(scheme.vehiclePlan.installmentMonths);
    if (v === null || v <= 0) {
      issues.push(issue("installmentMonths", "当前租赁形式要求填写分期月份", 3, String(scheme.vehiclePlan.installmentMonths ?? "")));
    }
  }
  if (lease?.monthlyRentRequired) {
    const v = asNumber(scheme.vehiclePlan.monthlyRentPerVehicle);
    if (v === null || v <= 0) {
      issues.push(issue("monthlyRentPerVehicle", "当前租赁形式要求填写单车月租", 3, String(scheme.vehiclePlan.monthlyRentPerVehicle ?? "")));
    }
  }

  for (const field of VEHICLE_FIELDS) {
    if (!field.std) continue;
    const stdItem = std.find((p) => p.parameterCode === field.std);
    if (!stdItem) continue;
    const current = String(scheme.vehiclePlan[field.key] ?? "");
    if (current === stdItem.value) continue;
    const existing = scheme.overrides.find((item) => item.parameterCode === field.std);
    const reason = reasons[field.std!] ?? existing?.overrideReason ?? "";
    // 与引擎对齐：已有覆盖记录，或本会话已打开调整原因时，原因必填。
    // 历史/Golden 方案里「值≠标准但无覆盖记录」允许继续，不额外阻断。
    const reasonTouched = Object.prototype.hasOwnProperty.call(reasons, field.std!);
    if ((existing || reasonTouched) && !filledText(reason)) {
      issues.push(issue(`override.${field.std}`, `覆盖公司标准「${field.label}」必须填写调整原因`, 3, current));
    }
  }

  return issues;
}

export function validateWizardStep(
  step: number,
  scheme: Scheme,
  meta: Meta | null,
  std: Std[],
  reasons: Record<string, string>,
): FieldIssue[] {
  if (step === 0) return validateStep1(scheme);
  if (step === 1) return validateStep2(scheme);
  if (step === 2) return validateStep3(scheme);
  if (step === 3) return validateStep4(scheme, meta, std, reasons);
  return [];
}

const SEGMENT_FIELD_MAP: Record<string, string> = {
  distance_km: "distanceKm",
  freight_price: "freightPrice",
  freight_price_unit: "freightPriceUnit",
  load_ton: "loadTon",
  trips_per_vehicle_month: "tripsPerVehicleMonth",
  energy: "loadedEnergyConsumption",
  electricity_price: "electricityPrice",
  loaded_energy_consumption: "loadedEnergyConsumption",
  operating_months_year: "operatingMonthsYear",
};

const SCHEME_FIELD_MAP: Record<string, string> = {
  fleet_size: "fleetSize",
  lease_type: "leaseType",
  calculation_years: "calculationYears",
  operating_months_year: "operatingMonthsYear",
  down_payment_per_vehicle: "downPaymentPerVehicle",
  installment_months: "installmentMonths",
  monthly_rent_per_vehicle: "monthlyRentPerVehicle",
  output_vat_rate: "outputVatRate",
  working_capital_interest_rate: "workingCapitalInterestRate",
  discount_rate: "discountRate",
  receivable_cycle: "receivableCycle",
  working_capital_loan_cycle: "workingCapitalLoanCycle",
  project_operating_months: "projectOperatingMonths",
  tire_life_km: "tireLifeKm",
  tire_count: "tireCount",
  driver_cost: "driverCost",
  routes: "routes",
};

export function engineFieldToUi(field: string): string {
  const segment = field.match(/^segment\.(.+)\.(.+)$/);
  if (segment) {
    return `segment.${segment[1]}.${SEGMENT_FIELD_MAP[segment[2]] || segment[2]}`;
  }
  if (field.startsWith("route.") && field.endsWith(".segments")) return "routes";
  if (field.startsWith("override.")) return field;
  return SCHEME_FIELD_MAP[field] || field;
}

export function stepForField(field: string): number {
  if (
    field.startsWith("project.") ||
    ["schemeName", "leaseType", "calculationYears", "operatingMonthsYear", "expectedStartDate", "expectedEndDate", "description"].includes(field)
  ) {
    return 0;
  }
  if (
    field === "routes" ||
    field.includes("originName") ||
    field.includes("destinationName") ||
    field.includes("distanceKm") ||
    field.includes(".loadTon") ||
    field.endsWith("loadTon") ||
    field.includes("segmentName") ||
    field.includes("routeName") ||
    field.includes(".segments")
  ) {
    return 1;
  }
  if (field === "fleetSize" || field.includes("tripsPerVehicleMonth")) return 2;
  return 3;
}

export function mapEngineIssue(issue: Issue): FieldIssue {
  const field = engineFieldToUi(issue.field);
  return {
    field,
    message: issue.message,
    step: stepForField(field),
  };
}

export function currentValueForField(scheme: Scheme, field: string): string {
  if (field === "schemeName") return scheme.schemeName;
  if (field === "leaseType") return scheme.leaseType;
  if (field === "fleetSize") return String(scheme.fleetSize ?? "");
  if (field === "calculationYears") return String(scheme.calculationYears ?? "");
  if (field === "operatingMonthsYear") return String(scheme.financeTaxPlan.operatingMonthsYear ?? "");
  if (field.startsWith("project.") && scheme.project) {
    const key = field.slice("project.".length) as keyof NonNullable<Scheme["project"]>;
    return String(scheme.project[key] ?? "");
  }
  const segMatch = field.match(/^segment\.(.+)\.(.+)$/);
  if (segMatch) {
    const seg = scheme.routes.flatMap((route) => route.segments).find((item) => item.id === segMatch[1]);
    if (!seg) return "";
    return String(seg[segMatch[2] as keyof typeof seg] ?? "");
  }
  if (field.startsWith("override.")) {
    const code = field.slice("override.".length);
    const mapped = VEHICLE_FIELDS.find((item) => item.std === code);
    if (mapped) return String(scheme.vehiclePlan[mapped.key] ?? "");
  }
  if (Object.prototype.hasOwnProperty.call(scheme.vehiclePlan, field)) {
    return String(scheme.vehiclePlan[field] ?? "");
  }
  if (Object.prototype.hasOwnProperty.call(scheme.financeTaxPlan, field)) {
    return String(scheme.financeTaxPlan[field] ?? "");
  }
  return "";
}

export function mergeIssues(local: FieldIssue[], engine: Issue[] = []): FieldIssue[] {
  const mapped = engine.map((item) => {
    const issueItem = mapEngineIssue(item);
    return issueItem;
  });
  const seen = new Set<string>();
  const result: FieldIssue[] = [];
  for (const item of [...local, ...mapped]) {
    const key = `${item.field}::${item.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

export function errorMap(issues: FieldIssue[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const item of issues) {
    if (!map[item.field]) map[item.field] = item.message;
  }
  return map;
}

export function scrollToField(field: string) {
  if (typeof document === "undefined") return;
  const el = document.querySelector(`[data-field="${CSS.escape(field)}"]`);
  el?.scrollIntoView({ behavior: "smooth", block: "center" });
}
