export type Segment = {
  id: string;
  segmentName: string;
  originName: string;
  destinationName: string;
  distanceKm: string;
  freightPrice: string;
  freightPriceUnit: string;
  loadTon: string;
  tripsPerVehicleMonth: string;
  operatingMonthsYear: string;
  electricityPrice: string;
  loadedEnergyConsumption: string;
  emptyEnergyConsumption: string;
  tollPerTrip: string;
  loadingUnloadingFee: string;
  informationFee: string;
  driverCostPerTrip: string;
  sortNo: number;
};

export type Route = {
  id: string;
  routeName: string;
  routeCode: string;
  description: string | null;
  weight: number | null;
  sortNo: number;
  segments: Segment[];
};

export type Vehicle = Record<string, string | number>;
export type Finance = Record<string, string | number | null>;

export type ProjectBrief = {
  id: string;
  projectName: string;
  projectCode: string;
  customerName: string;
  projectManager: string;
  projectStatus: string;
};

export type Scheme = {
  id: string;
  projectId: string;
  schemeName: string;
  description: string | null;
  leaseType: string;
  fleetSize: number;
  calculationYears: number;
  expectedStartDate: string | null;
  expectedEndDate: string | null;
  status: string;
  versionNo: string;
  updatedAt?: string;
  sourceSchemeId?: string | null;
  project?: ProjectBrief;
  routes: Route[];
  vehiclePlan: Vehicle;
  financeTaxPlan: Finance;
  overrides: { parameterCode: string; standardValue: string; overrideValue: string; overrideReason: string }[];
};

export type Meta = {
  leaseTypes: {
    code: string;
    name: string;
    showDownPayment: boolean;
    showInstallment: boolean;
    showMonthlyRent: boolean;
    downPaymentRequired: boolean;
    installmentRequired: boolean;
    monthlyRentRequired: boolean;
  }[];
  units: { code: string; name: string }[];
  vatRules: { code: string; name: string }[];
  driverCostTypes: { code: string; name: string }[];
};

export type Std = { parameterCode: string; parameterName: string; value: string; unit: string; category: string };

export type PreviewDto = {
  monthlyRevenue: string;
  monthlyTotalCost: string;
  monthlyProfit: string;
  profitMargin: string | null;
  profitMarginReason: string | null;
  monthlyVolume: string;
  monthlyMileage: string;
  vehicleMonthlyRevenue: string;
  vehicleMonthlyProfit: string | null;
  firstPositiveMonth: number | null;
  irr: string | null;
  irrReason: string | null;
  operatingMonthsYear: number;
  annualRevenue: string;
  annualTotalCost: string;
  annualProfit: string;
  annualVolume: string;
  costBreakdown: { code: string; name: string; amount: string; share: string | null }[];
};

export type Issue = { field: string; message: string; level?: "error" | "warning"; code?: string };

export const WIZARD_STEPS = [
  { key: "basic", label: "项目与方案" },
  { key: "scenario", label: "运输场景" },
  { key: "operations", label: "运营效率" },
  { key: "cost", label: "收入与成本" },
  { key: "confirm", label: "测算检查" },
] as const;

export const VEHICLE_FIELDS: { key: string; label: string; unit: string; std?: string; group: "vehicle" | "opex" | "insure" | "tire" | "driver" }[] = [
  { key: "downPaymentPerVehicle", label: "单车首付", unit: "元", group: "vehicle" },
  { key: "installmentMonths", label: "分期月份", unit: "月", group: "vehicle" },
  { key: "monthlyRentPerVehicle", label: "单车月租", unit: "元/车/月", group: "vehicle" },
  { key: "managementFeePerVehicle", label: "单车月管理费", unit: "元/车/月", std: "STD_MANAGEMENT_FEE", group: "opex" },
  { key: "roadMaintenanceFee", label: "路保费", unit: "元/车/月", std: "STD_ROAD_MAINTENANCE_FEE", group: "opex" },
  { key: "maintenanceFee", label: "维保费", unit: "元/车/月", std: "STD_MAINTENANCE_FEE", group: "opex" },
  { key: "parkingFee", label: "停车费", unit: "元/车/月", std: "STD_PARKING_FEE", group: "opex" },
  { key: "heaterFee", label: "柴暖费", unit: "元/车/月", std: "STD_HEATER_FEE", group: "opex" },
  { key: "consumableFee", label: "消耗费用", unit: "元/车/月", std: "STD_CONSUMABLE_FEE", group: "opex" },
  { key: "annualInspectionFee", label: "年审费", unit: "元/车/月", std: "STD_ANNUAL_INSPECTION_FEE", group: "insure" },
  { key: "insuranceFee", label: "保险费", unit: "元/车/月", std: "STD_INSURANCE_FEE", group: "insure" },
  { key: "tireLifeKm", label: "轮胎寿命", unit: "km", std: "STD_TIRE_LIFE", group: "tire" },
  { key: "tireCount", label: "单车轮胎数量", unit: "条", std: "STD_TIRE_COUNT", group: "tire" },
  { key: "tireUnitPrice", label: "轮胎均价", unit: "元/条", std: "STD_TIRE_PRICE", group: "tire" },
  { key: "driverCost", label: "司机成本", unit: "按口径", std: "STD_DRIVER_COST", group: "driver" },
];

export function schemeStatusLabel(status?: string | null) {
  if (status === "draft") return "草稿";
  if (status === "calculated") return "测算完成";
  if (status === "baseline") return "测算完成";
  if (status === "archived") return "已归档";
  return status || "待补充";
}
