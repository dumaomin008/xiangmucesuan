/**
 * 参数白名单来自真实测算输入（SchemeCalculationInput 及其 Segment / Vehicle 嵌套字段）。
 * LLM 不得发明字段，也不得写入测算结果。
 */
import type { SchemeCalculationOutput } from "@/lib/engine/types";
import { FIELD_GROUPS, FIELD_LABELS, REQUIRED_IMPORT_FIELDS, type ImportFieldKey } from "../types";

export type ParameterDefinition = {
  /** 嵌套在 SchemeCalculationInput 内的真实输入字段，不是 LLM 自造名 */
  field: ImportFieldKey;
  inputPath: string;
  label: string;
  aliases: string[];
  dataType: "number" | "string";
  canonicalUnit?: string;
  required: boolean;
  group: string;
  min?: number;
  max?: number;
  systemDefault?: string | number;
};

const numeric = (
  field: ImportFieldKey,
  inputPath: string,
  aliases: string[],
  extra: Partial<ParameterDefinition> = {},
): ParameterDefinition => ({
  field,
  inputPath,
  label: FIELD_LABELS[field],
  aliases,
  dataType: "number",
  required: REQUIRED_IMPORT_FIELDS.includes(field),
  group: FIELD_GROUPS[field],
  ...extra,
});

export const PARAMETER_REGISTRY: ParameterDefinition[] = [
  {
    field: "projectName",
    inputPath: "schemeName",
    label: FIELD_LABELS.projectName,
    aliases: ["项目名称", "项目名"],
    dataType: "string",
    required: false,
    group: "project",
  },
  {
    field: "customer",
    inputPath: "project.customer",
    label: FIELD_LABELS.customer,
    aliases: ["客户", "客户名称"],
    dataType: "string",
    required: false,
    group: "project",
  },
  {
    field: "region",
    inputPath: "project.region",
    label: FIELD_LABELS.region,
    aliases: ["区域", "项目区域"],
    dataType: "string",
    required: false,
    group: "project",
  },
  numeric("fleetSize", "fleetSize", ["车辆数", "车队规模", "牵引车", "fleetSize", "FleetSize"], {
    canonicalUnit: "台",
    min: 1,
    max: 2000,
  }),
  numeric("monthlyRentPerVehicle", "vehicle.monthlyRentPerVehicle", ["单车月租", "月租", "monthlyRent", "MonthlyRent"], {
    canonicalUnit: "元",
    min: 0,
    max: 200000,
  }),
  numeric("distanceKm", "routes.segments.distanceKm", ["单程里程", "里程", "运距", "distanceKm"], {
    canonicalUnit: "km",
    min: 0,
    max: 5000,
  }),
  numeric("loadTon", "routes.segments.loadTon", ["载重", "额定载重", "loadTon"], {
    canonicalUnit: "吨",
    min: 0,
    max: 200,
  }),
  numeric("tripsPerVehicleMonth", "routes.segments.tripsPerVehicleMonth", ["单车月趟次", "月趟次", "趟次"], {
    canonicalUnit: "趟",
    min: 0,
    max: 400,
  }),
  numeric("freightPrice", "routes.segments.freightPrice", ["运价", "运费单价", "freightPrice"], {
    canonicalUnit: "元",
    min: 0,
    max: 100000,
  }),
  {
    field: "freightPriceUnit",
    inputPath: "routes.segments.freightPriceUnit",
    label: FIELD_LABELS.freightPriceUnit,
    aliases: ["运价单位", "计价方式"],
    dataType: "string",
    required: false,
    group: "revenue",
  },
  {
    field: "routeName",
    inputPath: "routes.routeName",
    label: FIELD_LABELS.routeName,
    aliases: ["线路", "线路名称"],
    dataType: "string",
    required: false,
    group: "transport",
  },
  {
    field: "originName",
    inputPath: "routes.segments.originName",
    label: FIELD_LABELS.originName,
    aliases: ["起点", "始发"],
    dataType: "string",
    required: false,
    group: "transport",
  },
  {
    field: "destinationName",
    inputPath: "routes.segments.destinationName",
    label: FIELD_LABELS.destinationName,
    aliases: ["终点", "到达"],
    dataType: "string",
    required: false,
    group: "transport",
  },
  numeric("electricityPrice", "routes.segments.electricityPrice", ["电价", "场站电价", "electricityPrice"], {
    canonicalUnit: "元/kWh",
    min: 0,
    max: 10,
  }),
  numeric("loadedEnergyConsumption", "routes.segments.loadedEnergyConsumption", ["重载能耗", "满载能耗", "loadedEnergy"], {
    canonicalUnit: "kWh/km",
    min: 0,
    max: 10,
  }),
  numeric("emptyEnergyConsumption", "routes.segments.emptyEnergyConsumption", ["空载能耗"], {
    canonicalUnit: "kWh/km",
    min: 0,
    max: 10,
    systemDefault: "0.9",
  }),
  numeric("driverCostPerTrip", "routes.segments.driverCostPerTrip", ["司机单趟成本", "司机单趟", "司机成本"], {
    canonicalUnit: "元/趟",
    min: 0,
    max: 50000,
  }),
  numeric("tollPerTrip", "routes.segments.tollPerTrip", ["路桥费", "过路费"], {
    canonicalUnit: "元",
    min: 0,
    max: 20000,
  }),
  numeric("operatingMonthsYear", "routes.segments.operatingMonthsYear", ["年运营月数", "运营月数"], {
    canonicalUnit: "月",
    min: 1,
    max: 12,
  }),
];

export const REGISTRY_BY_FIELD = new Map(PARAMETER_REGISTRY.map((d) => [d.field, d]));

/** 测算结果字段：AI 与解析器一律不得写入 */
export const KPI_FIELD_BLACKLIST = [
  "monthlyRevenue",
  "monthlyFixedCost",
  "monthlyVariableCost",
  "monthlyFinanceCost",
  "monthlyTaxCost",
  "monthlyTotalCost",
  "monthlyProfit",
  "profitMargin",
  "vehicleMonthlyRevenue",
  "vehicleMonthlyProfit",
  "irr",
  "npv",
  "paybackPeriod",
  "cashFlow",
  "cashFlows",
  "cumulativeCashFlow",
  "annualCashFlows",
  "projectId",
] as const satisfies readonly (keyof SchemeCalculationOutput | "npv" | "paybackPeriod" | "cashFlow" | "projectId")[];

export function isBlockedField(field: string): boolean {
  const key = field.trim();
  return (KPI_FIELD_BLACKLIST as readonly string[]).includes(key) || !REGISTRY_BY_FIELD.has(key as ImportFieldKey);
}
